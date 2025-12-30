import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Structured logging helper
function createLogger(correlationId: string) {
  const log = (level: string, message: string, context: Record<string, unknown> = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'compute-snapshots',
      correlationId,
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
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID()
  const logger = createLogger(correlationId)
  const startTime = Date.now()

  logger.info('Starting snapshot computation')

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all active workspaces
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('status', 'active')

    if (wsError) {
      logger.error('Error fetching workspaces', { error: wsError.message })
      throw wsError
    }

    logger.info('Fetched active workspaces', { count: workspaces?.length || 0 })

    const snapshotTypes = ['coordination', 'financial', 'team']
    const results: { workspace_id: string; snapshots: string[]; errors: string[] }[] = []

    for (const workspace of workspaces || []) {
      const wsResult = { workspace_id: workspace.id, snapshots: [] as string[], errors: [] as string[] }

      for (const snapshotType of snapshotTypes) {
        try {
          const { error } = await supabase.rpc('compute_dashboard_snapshot', {
            p_workspace_id: workspace.id,
            p_snapshot_type: snapshotType
          })

          if (error) {
            logger.error('Error computing snapshot', { 
              workspaceId: workspace.id, 
              snapshotType, 
              error: error.message 
            })
            wsResult.errors.push(`${snapshotType}: ${error.message}`)
          } else {
            wsResult.snapshots.push(snapshotType)
          }
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : 'Unknown error'
          logger.error('Exception computing snapshot', { 
            workspaceId: workspace.id, 
            snapshotType, 
            error: errorMessage 
          })
          wsResult.errors.push(`${snapshotType}: ${errorMessage}`)
        }
      }

      results.push(wsResult)
    }

    // Record metric for monitoring
    const duration = Date.now() - startTime
    try {
      await supabase.rpc('record_metric', {
        p_metric_type: 'job',
        p_metric_name: 'compute_snapshots_duration_ms',
        p_metric_value: duration,
        p_dimensions: { workspaces_processed: workspaces?.length || 0 },
        p_correlation_id: correlationId
      })
    } catch (metricError) {
      logger.warn('Failed to record metric', { error: String(metricError) })
    }

    const successCount = results.reduce((acc, r) => acc + r.snapshots.length, 0)
    const errorCount = results.reduce((acc, r) => acc + r.errors.length, 0)

    logger.info('Snapshot computation completed', { 
      durationMs: duration,
      workspacesProcessed: workspaces?.length || 0,
      successCount,
      errorCount
    })

    return new Response(
      JSON.stringify({
        success: true,
        correlation_id: correlationId,
        duration_ms: duration,
        workspaces_processed: workspaces?.length || 0,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const duration = Date.now() - startTime
    
    logger.error('Fatal error in snapshot computation', { 
      error: errorMessage,
      durationMs: duration
    })
    
    return new Response(
      JSON.stringify({
        success: false,
        correlation_id: correlationId,
        error: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId } }
    )
  }
})
