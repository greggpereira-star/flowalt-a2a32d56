import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, idempotency-key',
}

interface ApiKeyValidation {
  workspace_id: string
  permissions: string[]
}

interface RateLimitResult {
  allowed: boolean
  current_count: number
  reset_at: string
}

interface IdempotencyResult {
  found: boolean
  response_status: number | null
  response_body: any
}

// Rate limit configuration
const RATE_LIMIT_MAX_REQUESTS = 100 // requests per window
const RATE_LIMIT_WINDOW_MINUTES = 1 // window size in minutes

// Structured logging helper
function createLogger(correlationId: string, workspaceId?: string) {
  const log = (level: string, message: string, context: Record<string, unknown> = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'public-api',
      correlationId,
      workspaceId,
      message,
      ...context
    }
    if (level === 'error') {
      console.error(JSON.stringify(entry))
    } else if (level === 'warn') {
      console.warn(JSON.stringify(entry))
    } else {
      console.log(JSON.stringify(entry))
    }
  }

  return {
    info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
    debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
    setWorkspaceId: (wsId: string) => { workspaceId = wsId }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID()
  const logger = createLogger(correlationId)
  const startTime = Date.now()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Parse URL early for status endpoint
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const resource = pathParts[1] || ''

  // Handle status endpoint (no auth required)
  if (resource === 'status') {
    const dbStartTime = Date.now()
    
    // Check database connectivity
    const { error: dbError } = await supabase.from('workspaces').select('id').limit(1)
    const dbLatency = Date.now() - dbStartTime
    const dbStatus = dbError ? 'unhealthy' : 'healthy'

    const status = {
      status: dbError ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      correlation_id: correlationId,
      services: {
        database: {
          status: dbStatus,
          latency_ms: dbLatency
        },
        api: {
          status: 'healthy',
          rate_limit: {
            max_requests: RATE_LIMIT_MAX_REQUESTS,
            window_minutes: RATE_LIMIT_WINDOW_MINUTES
          }
        }
      },
      endpoints: ['cards', 'comments', 'time-entries', 'events', 'webhooks', 'transactions', 'clients', 'openapi', 'status']
    }

    logger.info('Status check', { dbStatus, dbLatency })

    return new Response(JSON.stringify(status), {
      status: dbError ? 503 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId }
    })
  }

  try {
    // Extract API key from header
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) {
      logger.warn('Missing API key')
      return new Response(
        JSON.stringify({ error: 'API key required', code: 'MISSING_API_KEY' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId } }
      )
    }

    // Validate API key
    const { data: keyData, error: keyError } = await supabase
      .rpc('validate_api_key', { api_key: apiKey })

    if (keyError || !keyData || keyData.length === 0) {
      logger.warn('Invalid API key', { keyPrefix: apiKey.substring(0, 8) })
      return new Response(
        JSON.stringify({ error: 'Invalid API key', code: 'INVALID_API_KEY' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId } }
      )
    }

    const { workspace_id, permissions } = keyData[0] as ApiKeyValidation
    logger.setWorkspaceId(workspace_id)
    logger.info('API request authenticated', { resource, method: req.method, permissions })

    // Get API key ID for rate limiting
    const keyPrefix = apiKey.substring(0, 8)
    const { data: apiKeyRecord } = await supabase
      .from('api_keys')
      .select('id')
      .eq('key_prefix', keyPrefix)
      .eq('workspace_id', workspace_id)
      .single()

    let rateLimitHeaders: Record<string, string> = {}

    if (apiKeyRecord) {
      // Check rate limit
      const { data: rateLimitData, error: rateLimitError } = await supabase
        .rpc('check_rate_limit', {
          p_api_key_id: apiKeyRecord.id,
          p_max_requests: RATE_LIMIT_MAX_REQUESTS,
          p_window_minutes: RATE_LIMIT_WINDOW_MINUTES
        })

      if (rateLimitError) {
        logger.error('Rate limit check failed', { error: rateLimitError.message })
      } else if (rateLimitData && rateLimitData.length > 0) {
        const rateLimit = rateLimitData[0] as RateLimitResult
        
        // Add rate limit headers to all responses
        rateLimitHeaders = {
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': Math.max(0, RATE_LIMIT_MAX_REQUESTS - rateLimit.current_count).toString(),
          'X-RateLimit-Reset': new Date(rateLimit.reset_at).getTime().toString(),
        }

        if (!rateLimit.allowed) {
          logger.warn('Rate limit exceeded', { keyPrefix, currentCount: rateLimit.current_count })
          return new Response(
            JSON.stringify({ 
              error: 'Rate limit exceeded', 
              code: 'RATE_LIMIT_EXCEEDED',
              retry_after: Math.ceil((new Date(rateLimit.reset_at).getTime() - Date.now()) / 1000)
            }),
            { 
              status: 429, 
              headers: { 
                ...corsHeaders, 
                ...rateLimitHeaders,
                'Content-Type': 'application/json',
                'X-Correlation-ID': correlationId,
                'Retry-After': Math.ceil((new Date(rateLimit.reset_at).getTime() - Date.now()) / 1000).toString()
              } 
            }
          )
        }
      }

      // Update last_used_at
      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', apiKeyRecord.id)
    }

    // Check idempotency key for mutating requests
    const idempotencyKey = req.headers.get('idempotency-key')
    const isMutatingRequest = ['POST', 'PUT', 'PATCH'].includes(req.method)

    if (idempotencyKey && isMutatingRequest) {
      // Validate idempotency key format (max 256 chars, alphanumeric + dashes)
      if (idempotencyKey.length > 256 || !/^[\w-]+$/.test(idempotencyKey)) {
        logger.warn('Invalid idempotency key format', { idempotencyKey: idempotencyKey.substring(0, 20) })
        return new Response(
          JSON.stringify({ 
            error: 'Invalid idempotency key format', 
            code: 'INVALID_IDEMPOTENCY_KEY',
            details: 'Idempotency key must be alphanumeric with dashes, max 256 characters'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId } }
        )
      }

      // Check for existing response
      const { data: idempotentData, error: idempotentError } = await supabase
        .rpc('get_idempotent_response', {
          p_workspace_id: workspace_id,
          p_idempotency_key: idempotencyKey
        })

      if (!idempotentError && idempotentData && idempotentData.length > 0) {
        const cached = idempotentData[0] as IdempotencyResult
        if (cached.found && cached.response_body !== null) {
          logger.info('Returning cached idempotent response', { idempotencyKey: idempotencyKey.substring(0, 20) })
          return new Response(
            JSON.stringify(cached.response_body),
            { 
              status: cached.response_status || 200, 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'X-Idempotent-Replayed': 'true',
                'X-Correlation-ID': correlationId
              } 
            }
          )
        }
      }
    }

    // resourceId from URL path
    const resourceId = pathParts[2]

    // Pagination params
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    // Route to appropriate handler and wrap response with rate limit headers
    let response: Response

    switch (resource) {
      case 'cards':
        response = await handleCards(req, supabase, workspace_id, permissions, resourceId, { page, limit, offset, url }, logger)
        break
      case 'comments':
        response = await handleComments(req, supabase, workspace_id, permissions, resourceId, { page, limit, offset, url }, logger)
        break
      case 'time-entries':
        response = await handleTimeEntries(req, supabase, workspace_id, permissions, resourceId, { page, limit, offset, url }, logger)
        break
      case 'events':
        response = await handleEvents(req, supabase, workspace_id, permissions, resourceId, { page, limit, offset, url }, logger)
        break
      case 'webhooks':
        response = await handleWebhooks(req, supabase, workspace_id, permissions, resourceId, logger)
        break
      case 'transactions':
        response = await handleTransactions(req, supabase, workspace_id, permissions, resourceId, { page, limit, offset, url }, logger)
        break
      case 'clients':
        response = await handleClients(req, supabase, workspace_id, permissions, resourceId, { page, limit, offset, url }, logger)
        break
      case 'openapi':
        response = handleOpenAPI()
        break
      default:
        logger.warn('Resource not found', { resource })
        response = new Response(
          JSON.stringify({ 
            error: 'Resource not found', 
            code: 'NOT_FOUND',
            available_resources: ['cards', 'comments', 'time-entries', 'events', 'webhooks', 'transactions', 'clients', 'openapi']
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Add rate limit headers and correlation ID to response
    const newHeaders = new Headers(response.headers)
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value)
    })
    newHeaders.set('X-Correlation-ID', correlationId)

    // Store idempotent response if applicable
    if (idempotencyKey && isMutatingRequest && response.status < 500) {
      const responseBody = await response.clone().text()
      await supabase.rpc('store_idempotent_response', {
        p_workspace_id: workspace_id,
        p_idempotency_key: idempotencyKey,
        p_request_path: url.pathname,
        p_request_method: req.method,
        p_response_status: response.status,
        p_response_body: responseBody ? JSON.parse(responseBody) : null
      })
    }

    const duration = Date.now() - startTime
    logger.info('Request completed', { 
      status: response.status, 
      durationMs: duration,
      resource,
      method: req.method 
    })

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('API Error', { error: errorMessage, durationMs: duration })
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId } }
    )
  }
})

// Logger type for handlers
type Logger = ReturnType<typeof createLogger>

// Cards handler
async function handleCards(
  req: Request, 
  supabase: any, 
  workspaceId: string, 
  permissions: string[],
  cardId: string | undefined,
  pagination: { page: number; limit: number; offset: number; url: URL },
  logger: Logger
) {
  const hasRead = permissions.includes('read') || permissions.includes('cards:read')
  const hasWrite = permissions.includes('write') || permissions.includes('cards:write')

  if (req.method === 'GET') {
    if (!hasRead) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (cardId) {
      // Get single card
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('id', cardId)
        .eq('workspace_id', workspaceId)
        .single()

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Card not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // List cards with filters
    let query = supabase
      .from('cards')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)

    // Apply filters
    const status = pagination.url.searchParams.get('status')
    const spaceId = pagination.url.searchParams.get('space_id')
    const folderId = pagination.url.searchParams.get('folder_id')
    const assigneeId = pagination.url.searchParams.get('assignee_id')

    if (status) query = query.eq('status', status)
    if (spaceId) query = query.eq('space_id', spaceId)
    if (folderId) query = query.eq('folder_id', folderId)
    if (assigneeId) query = query.contains('assignee_ids', [assigneeId])

    const { data, error, count } = await query

    if (error) {
      logger.error('Cards query error', { error: error.message })
      return new Response(
        JSON.stringify({ error: 'Failed to fetch cards', code: 'QUERY_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: count,
        total_pages: Math.ceil((count || 0) / pagination.limit)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (req.method === 'POST') {
    if (!hasWrite) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { data, error } = await supabase
      .from('cards')
      .insert({
        ...body,
        workspace_id: workspaceId
      })
      .select()
      .single()

    if (error) {
      logger.error('Card insert error', { error: error.message })
      return new Response(
        JSON.stringify({ error: 'Failed to create card', code: 'INSERT_ERROR', details: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Trigger webhook
    await triggerWebhook(supabase, workspaceId, 'card.created', data, logger)

    return new Response(JSON.stringify({ data }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (req.method === 'PATCH' && cardId) {
    if (!hasWrite) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { data, error } = await supabase
      .from('cards')
      .update(body)
      .eq('id', cardId)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      logger.error('Card update error', { error: error.message, cardId })
      return new Response(
        JSON.stringify({ error: 'Failed to update card', code: 'UPDATE_ERROR', details: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Trigger webhook
    await triggerWebhook(supabase, workspaceId, 'card.updated', data, logger)

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (req.method === 'DELETE' && cardId) {
    if (!hasWrite) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error } = await supabase
      .from('cards')
      .delete()
      .eq('id', cardId)
      .eq('workspace_id', workspaceId)

    if (error) {
      logger.error('Card delete error', { error: error.message, cardId })
      return new Response(
        JSON.stringify({ error: 'Failed to delete card', code: 'DELETE_ERROR' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Trigger webhook
    await triggerWebhook(supabase, workspaceId, 'card.deleted', { id: cardId }, logger)

    return new Response(null, { status: 204, headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Comments handler
async function handleComments(
  req: Request, 
  supabase: any, 
  workspaceId: string, 
  permissions: string[],
  commentId: string | undefined,
  pagination: { page: number; limit: number; offset: number; url: URL },
  logger: Logger
) {
  const hasRead = permissions.includes('read') || permissions.includes('comments:read')
  const hasWrite = permissions.includes('write') || permissions.includes('comments:write')

  if (req.method === 'GET') {
    if (!hasRead) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cardId = pagination.url.searchParams.get('card_id')
    if (!cardId) {
      return new Response(
        JSON.stringify({ error: 'card_id parameter required', code: 'BAD_REQUEST' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify card belongs to workspace
    const { data: card } = await supabase
      .from('cards')
      .select('id')
      .eq('id', cardId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!card) {
      return new Response(
        JSON.stringify({ error: 'Card not found', code: 'NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data, error, count } = await supabase
      .from('comments')
      .select('*', { count: 'exact' })
      .eq('card_id', cardId)
      .order('created_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch comments', code: 'QUERY_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: count,
        total_pages: Math.ceil((count || 0) / pagination.limit)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (req.method === 'POST') {
    if (!hasWrite) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    
    // Verify card belongs to workspace
    const { data: card } = await supabase
      .from('cards')
      .select('id')
      .eq('id', body.card_id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!card) {
      return new Response(
        JSON.stringify({ error: 'Card not found', code: 'NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data, error } = await supabase
      .from('comments')
      .insert(body)
      .select()
      .single()

    if (error) {
      logger.error('Comment insert error', { error: error.message })
      return new Response(
        JSON.stringify({ error: 'Failed to create comment', code: 'INSERT_ERROR', details: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await triggerWebhook(supabase, workspaceId, 'comment.created', data, logger)

    return new Response(JSON.stringify({ data }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Time entries handler
async function handleTimeEntries(
  req: Request, 
  supabase: any, 
  workspaceId: string, 
  permissions: string[],
  entryId: string | undefined,
  pagination: { page: number; limit: number; offset: number; url: URL },
  logger: Logger
) {
  const hasRead = permissions.includes('read') || permissions.includes('time:read')
  const hasWrite = permissions.includes('write') || permissions.includes('time:write')

  if (req.method === 'GET') {
    if (!hasRead) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let query = supabase
      .from('time_entries')
      .select('*, cards!inner(workspace_id)', { count: 'exact' })
      .eq('cards.workspace_id', workspaceId)
      .order('started_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)

    const cardId = pagination.url.searchParams.get('card_id')
    const userId = pagination.url.searchParams.get('user_id')
    const startDate = pagination.url.searchParams.get('start_date')
    const endDate = pagination.url.searchParams.get('end_date')

    if (cardId) query = query.eq('card_id', cardId)
    if (userId) query = query.eq('user_id', userId)
    if (startDate) query = query.gte('started_at', startDate)
    if (endDate) query = query.lte('started_at', endDate)

    const { data, error, count } = await query

    if (error) {
      logger.error('Time entries query error', { error: error.message })
      return new Response(
        JSON.stringify({ error: 'Failed to fetch time entries', code: 'QUERY_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({
      data: data?.map((d: any) => ({ ...d, cards: undefined })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: count,
        total_pages: Math.ceil((count || 0) / pagination.limit)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (req.method === 'POST') {
    if (!hasWrite) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    
    // Verify card belongs to workspace
    const { data: card } = await supabase
      .from('cards')
      .select('id')
      .eq('id', body.card_id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!card) {
      return new Response(
        JSON.stringify({ error: 'Card not found', code: 'NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data, error } = await supabase
      .from('time_entries')
      .insert(body)
      .select()
      .single()

    if (error) {
      logger.error('Time entry insert error', { error: error.message })
      return new Response(
        JSON.stringify({ error: 'Failed to create time entry', code: 'INSERT_ERROR', details: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await triggerWebhook(supabase, workspaceId, 'time_entry.logged', data, logger)

    return new Response(JSON.stringify({ data }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Events/Agenda handler
async function handleEvents(
  req: Request, 
  supabase: any, 
  workspaceId: string, 
  permissions: string[],
  eventId: string | undefined,
  pagination: { page: number; limit: number; offset: number; url: URL },
  logger: Logger
) {
  const hasRead = permissions.includes('read') || permissions.includes('events:read')
  const hasWrite = permissions.includes('write') || permissions.includes('events:write')

  if (req.method === 'GET') {
    if (!hasRead) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (eventId) {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .eq('workspace_id', workspaceId)
        .single()

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Event not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let query = supabase
      .from('events')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('start_time', { ascending: true })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)

    const startDate = pagination.url.searchParams.get('start_date')
    const endDate = pagination.url.searchParams.get('end_date')
    const eventType = pagination.url.searchParams.get('event_type')

    if (startDate) query = query.gte('start_time', startDate)
    if (endDate) query = query.lte('start_time', endDate)
    if (eventType) query = query.eq('event_type', eventType)

    const { data, error, count } = await query

    if (error) {
      logger.error('Events query error', { error: error.message })
      return new Response(
        JSON.stringify({ error: 'Failed to fetch events', code: 'QUERY_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: count,
        total_pages: Math.ceil((count || 0) / pagination.limit)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (req.method === 'POST') {
    if (!hasWrite) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { data, error } = await supabase
      .from('events')
      .insert({
        ...body,
        workspace_id: workspaceId
      })
      .select()
      .single()

    if (error) {
      logger.error('Event insert error', { error: error.message })
      return new Response(
        JSON.stringify({ error: 'Failed to create event', code: 'INSERT_ERROR', details: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await triggerWebhook(supabase, workspaceId, 'event.created', data, logger)

    return new Response(JSON.stringify({ data }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Webhooks management handler
async function handleWebhooks(
  req: Request, 
  supabase: any, 
  workspaceId: string, 
  permissions: string[],
  webhookId: string | undefined,
  logger: Logger
) {
  const hasAdmin = permissions.includes('admin') || permissions.includes('webhooks:admin')

  if (!hasAdmin) {
    return new Response(
      JSON.stringify({ error: 'Admin permissions required for webhook management', code: 'FORBIDDEN' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (req.method === 'GET') {
    if (webhookId) {
      const { data, error } = await supabase
        .from('webhook_subscriptions')
        .select('id, name, url, events, is_active, created_at')
        .eq('id', webhookId)
        .eq('workspace_id', workspaceId)
        .single()

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Webhook not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data, error } = await supabase
      .from('webhook_subscriptions')
      .select('id, name, url, events, is_active, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Webhooks query error', { error: error.message })
      return new Response(
        JSON.stringify({ error: 'Failed to fetch webhooks', code: 'QUERY_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Transactions/Financial handler
async function handleTransactions(
  req: Request, 
  supabase: any, 
  workspaceId: string, 
  permissions: string[],
  transactionId: string | undefined,
  pagination: { page: number; limit: number; offset: number; url: URL },
  logger: Logger
) {
  const hasRead = permissions.includes('read') || permissions.includes('finance:read')
  const hasWrite = permissions.includes('write') || permissions.includes('finance:write')

  if (req.method === 'GET') {
    if (!hasRead) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Required: finance:read', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (transactionId) {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, financial_categories(*), clients(*)')
        .eq('id', transactionId)
        .eq('workspace_id', workspaceId)
        .single()

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Transaction not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let query = supabase
      .from('transactions')
      .select('*, financial_categories(*), clients(*)', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('due_date', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)

    const type = pagination.url.searchParams.get('type')
    const status = pagination.url.searchParams.get('status')
    const clientId = pagination.url.searchParams.get('client_id')
    const startDate = pagination.url.searchParams.get('start_date')
    const endDate = pagination.url.searchParams.get('end_date')

    if (type) query = query.eq('type', type)
    if (status) query = query.eq('status', status)
    if (clientId) query = query.eq('client_id', clientId)
    if (startDate) query = query.gte('due_date', startDate)
    if (endDate) query = query.lte('due_date', endDate)

    const { data, error, count } = await query

    if (error) {
      logger.error('Transactions query error', { error: error.message })
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transactions', code: 'QUERY_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: count,
        total_pages: Math.ceil((count || 0) / pagination.limit)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (req.method === 'POST') {
    if (!hasWrite) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Required: finance:write', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        ...body,
        workspace_id: workspaceId
      })
      .select()
      .single()

    if (error) {
      logger.error('Transaction insert error', { error: error.message })
      return new Response(
        JSON.stringify({ error: 'Failed to create transaction', code: 'INSERT_ERROR', details: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await triggerWebhook(supabase, workspaceId, 'transaction.created', data, logger)

    return new Response(JSON.stringify({ data }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (req.method === 'PATCH' && transactionId) {
    if (!hasWrite) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Required: finance:write', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { data, error } = await supabase
      .from('transactions')
      .update(body)
      .eq('id', transactionId)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      logger.error('Transaction update error', { error: error.message, transactionId })
      return new Response(
        JSON.stringify({ error: 'Failed to update transaction', code: 'UPDATE_ERROR', details: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await triggerWebhook(supabase, workspaceId, 'transaction.updated', data, logger)

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Clients handler
async function handleClients(
  req: Request, 
  supabase: any, 
  workspaceId: string, 
  permissions: string[],
  clientId: string | undefined,
  pagination: { page: number; limit: number; offset: number; url: URL },
  logger: Logger
) {
  const hasRead = permissions.includes('read') || permissions.includes('clients:read')
  const hasWrite = permissions.includes('write') || permissions.includes('clients:write')

  if (req.method === 'GET') {
    if (!hasRead) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (clientId) {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .eq('workspace_id', workspaceId)
        .single()

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Client not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let query = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('name', { ascending: true })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)

    const isActive = pagination.url.searchParams.get('is_active')
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error, count } = await query

    if (error) {
      logger.error('Clients query error', { error: error.message })
      return new Response(
        JSON.stringify({ error: 'Failed to fetch clients', code: 'QUERY_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: count,
        total_pages: Math.ceil((count || 0) / pagination.limit)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (req.method === 'POST') {
    if (!hasWrite) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { data, error } = await supabase
      .from('clients')
      .insert({
        ...body,
        workspace_id: workspaceId
      })
      .select()
      .single()

    if (error) {
      logger.error('Client insert error', { error: error.message })
      return new Response(
        JSON.stringify({ error: 'Failed to create client', code: 'INSERT_ERROR', details: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await triggerWebhook(supabase, workspaceId, 'client.created', data, logger)

    return new Response(JSON.stringify({ data }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// OpenAPI documentation handler
function handleOpenAPI() {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'Flowalt Public API',
      version: '1.0.0',
      description: 'API pública para integração com o Flowalt - Gestão de projetos, cards, tempo e financeiro.',
      contact: { name: 'Flowalt Support' }
    },
    servers: [{ url: '/functions/v1/public-api', description: 'Production' }],
    security: [{ ApiKeyAuth: [] }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API key gerada no painel de Configurações'
        }
      },
      schemas: {
        Card: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'] },
            urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            due_date: { type: 'string', format: 'date-time' },
            estimated_hours: { type: 'number' },
            actual_hours: { type: 'number' },
            space_id: { type: 'string', format: 'uuid' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['income', 'expense'] },
            status: { type: 'string', enum: ['pending', 'paid', 'overdue', 'cancelled'] },
            amount: { type: 'number' },
            description: { type: 'string' },
            due_date: { type: 'string', format: 'date' },
            paid_date: { type: 'string', format: 'date' },
            client_id: { type: 'string', format: 'uuid' },
            category_id: { type: 'string', format: 'uuid' }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            total_pages: { type: 'integer' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            details: { type: 'string' }
          }
        }
      }
    },
    paths: {
      '/status': {
        get: {
          summary: 'Health check',
          description: 'Verifica o status da API e seus serviços',
          security: [],
          responses: {
            '200': { description: 'API healthy' },
            '503': { description: 'API degraded' }
          }
        }
      },
      '/cards': {
        get: {
          summary: 'Listar cards',
          tags: ['Cards'],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'space_id', in: 'query', schema: { type: 'string', format: 'uuid' } }
          ],
          responses: {
            '200': { description: 'Lista de cards com paginação' },
            '403': { description: 'Permissão insuficiente' }
          }
        },
        post: {
          summary: 'Criar card',
          tags: ['Cards'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Card' } } }
          },
          responses: {
            '201': { description: 'Card criado' },
            '400': { description: 'Dados inválidos' }
          }
        }
      },
      '/transactions': {
        get: {
          summary: 'Listar transações financeiras',
          tags: ['Financial'],
          parameters: [
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['income', 'expense'] } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'paid', 'overdue', 'cancelled'] } },
            { name: 'client_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'start_date', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'end_date', in: 'query', schema: { type: 'string', format: 'date' } }
          ],
          responses: {
            '200': { description: 'Lista de transações' },
            '403': { description: 'Requer permissão finance:read' }
          }
        },
        post: {
          summary: 'Criar transação',
          tags: ['Financial'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Transaction' } } }
          },
          responses: {
            '201': { description: 'Transação criada' },
            '403': { description: 'Requer permissão finance:write' }
          }
        }
      },
      '/clients': {
        get: {
          summary: 'Listar clientes',
          tags: ['Clients'],
          parameters: [
            { name: 'is_active', in: 'query', schema: { type: 'boolean' } }
          ],
          responses: { '200': { description: 'Lista de clientes' } }
        },
        post: {
          summary: 'Criar cliente',
          tags: ['Clients'],
          responses: { '201': { description: 'Cliente criado' } }
        }
      },
      '/webhooks': {
        get: {
          summary: 'Listar webhooks',
          tags: ['Webhooks'],
          description: 'Requer permissão webhooks:admin',
          responses: { '200': { description: 'Lista de webhooks' } }
        }
      }
    }
  }

  return new Response(JSON.stringify(spec), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Trigger webhook helper
async function triggerWebhook(supabase: any, workspaceId: string, eventType: string, payload: any, logger: Logger) {
  try {
    // Get active subscriptions for this event
    const { data: subscriptions } = await supabase
      .from('webhook_subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .contains('events', [eventType])

    if (!subscriptions || subscriptions.length === 0) return

    logger.debug('Triggering webhooks', { eventType, subscriptionCount: subscriptions.length })

    for (const sub of subscriptions) {
      // Create HMAC signature
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(sub.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )

      const eventId = crypto.randomUUID()
      const payloadString = JSON.stringify({
        event_id: eventId,
        event_type: eventType,
        event_version: '1.0',
        occurred_at: new Date().toISOString(),
        workspace_id: workspaceId,
        data: payload
      })

      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(payloadString)
      )

      const signatureHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      // Create delivery record
      const { data: delivery } = await supabase
        .from('webhook_deliveries')
        .insert({
          subscription_id: sub.id,
          event_type: eventType,
          payload: JSON.parse(payloadString)
        })
        .select()
        .single()

      // Send webhook with retry logic
      const sendWithRetry = async (attempt = 1, maxAttempts = 3) => {
        try {
          const response = await fetch(sub.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': `sha256=${signatureHex}`,
              'X-Webhook-Event': eventType,
              'X-Webhook-Event-ID': eventId,
              'X-Webhook-Timestamp': new Date().toISOString()
            },
            body: payloadString
          })

          const responseBody = await response.text().catch(() => '')
          await supabase
            .from('webhook_deliveries')
            .update({
              response_status: response.status,
              response_body: responseBody.substring(0, 1000),
              delivered_at: new Date().toISOString(),
              retry_count: attempt - 1
            })
            .eq('id', delivery.id)

          if (!response.ok && attempt < maxAttempts) {
            const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
            setTimeout(() => sendWithRetry(attempt + 1, maxAttempts), delay)
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          logger.error('Webhook delivery failed', { subscriptionId: sub.id, error: errorMessage, attempt })
          
          if (attempt < maxAttempts) {
            const delay = Math.pow(2, attempt) * 1000
            setTimeout(() => sendWithRetry(attempt + 1, maxAttempts), delay)
          } else {
            // Store in DLQ after all retries failed
            await supabase
              .from('webhook_deliveries')
              .update({
                response_status: 0,
                response_body: errorMessage,
                retry_count: attempt,
                next_retry_at: null
              })
              .eq('id', delivery.id)
          }
        }
      }

      sendWithRetry()
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Webhook trigger error', { error: errorMessage })
  }
}
