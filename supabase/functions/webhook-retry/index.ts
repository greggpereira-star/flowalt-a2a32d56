import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_RETRIES = 5
const RETRY_DELAYS = [60, 300, 900, 3600, 14400] // 1min, 5min, 15min, 1h, 4h
const ALERT_THRESHOLD = 3 // Send email alert after 3 failed retries

// Structured logging helper
function createLogger(correlationId: string) {
  const log = (level: string, message: string, context: Record<string, unknown> = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'webhook-retry',
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

  try {
    logger.info('Starting webhook retry process')

    // Find deliveries that need retry
    const now = new Date()
    
    const { data: pendingDeliveries, error: fetchError } = await supabase
      .from('webhook_deliveries')
      .select(`
        *,
        subscription:webhook_subscriptions(*)
      `)
      .or('response_status.is.null,response_status.gte.400')
      .lt('retry_count', MAX_RETRIES)
      .or(`next_retry_at.is.null,next_retry_at.lte.${now.toISOString()}`)
      .limit(50)

    if (fetchError) {
      logger.error('Error fetching pending deliveries', { error: fetchError.message })
      throw fetchError
    }

    logger.info('Found deliveries to retry', { count: pendingDeliveries?.length || 0 })

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
    }

    if (!pendingDeliveries || pendingDeliveries.length === 0) {
      const duration = Date.now() - startTime
      logger.info('No pending deliveries to retry', { durationMs: duration })
      return new Response(JSON.stringify({ 
        message: 'No pending deliveries to retry',
        results,
        correlation_id: correlationId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId }
      })
    }

    // Process each delivery
    for (const delivery of pendingDeliveries) {
      results.processed++

      // Skip if subscription is inactive
      if (!delivery.subscription?.is_active) {
        logger.debug('Skipping delivery - subscription inactive', { deliveryId: delivery.id })
        results.skipped++
        continue
      }

      const subscriptionUrl = delivery.subscription.url
      const subscriptionSecret = delivery.subscription.secret

      logger.debug('Retrying delivery', { 
        deliveryId: delivery.id, 
        url: subscriptionUrl,
        retryCount: delivery.retry_count + 1 
      })

      try {
        // Attempt to deliver
        const response = await fetch(subscriptionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': subscriptionSecret,
            'X-Webhook-Event': delivery.event_type,
            'X-Webhook-Retry-Count': String(delivery.retry_count + 1),
            'X-Correlation-ID': correlationId,
          },
          body: JSON.stringify(delivery.payload),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        })

        const responseStatus = response.status
        let responseBody = ''
        
        try {
          responseBody = await response.text()
        } catch {
          responseBody = 'Unable to read response body'
        }

        const isSuccess = responseStatus >= 200 && responseStatus < 300

        // Calculate next retry time if failed
        const newRetryCount = delivery.retry_count + 1
        let nextRetryAt = null
        
        if (!isSuccess && newRetryCount < MAX_RETRIES) {
          const delaySeconds = RETRY_DELAYS[Math.min(newRetryCount, RETRY_DELAYS.length - 1)]
          nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString()
        }

        // Update delivery record
        const { error: updateError } = await supabase
          .from('webhook_deliveries')
          .update({
            response_status: responseStatus,
            response_body: responseBody.substring(0, 1000), // Limit response body size
            retry_count: newRetryCount,
            delivered_at: isSuccess ? new Date().toISOString() : null,
            next_retry_at: nextRetryAt,
          })
          .eq('id', delivery.id)

        if (updateError) {
          logger.error('Error updating delivery', { deliveryId: delivery.id, error: updateError.message })
        }

        if (isSuccess) {
          logger.info('Delivery succeeded', { deliveryId: delivery.id, status: responseStatus })
          results.successful++
        } else {
          logger.warn('Delivery failed', { 
            deliveryId: delivery.id, 
            status: responseStatus, 
            nextRetryAt,
            retryCount: newRetryCount 
          })
          results.failed++

          // Send email alert if threshold reached
          if (newRetryCount === ALERT_THRESHOLD) {
            await sendFailureAlert(delivery, responseStatus, responseBody, logger)
          }
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        logger.error('Error delivering webhook', { deliveryId: delivery.id, error: errorMessage })

        // Update with error
        const newRetryCount = delivery.retry_count + 1
        let nextRetryAt = null
        
        if (newRetryCount < MAX_RETRIES) {
          const delaySeconds = RETRY_DELAYS[Math.min(newRetryCount, RETRY_DELAYS.length - 1)]
          nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString()
        }

        await supabase
          .from('webhook_deliveries')
          .update({
            response_status: 0,
            response_body: `Error: ${errorMessage}`.substring(0, 1000),
            retry_count: newRetryCount,
            next_retry_at: nextRetryAt,
          })
          .eq('id', delivery.id)

        results.failed++
      }
    }

    const duration = Date.now() - startTime
    logger.info('Webhook retry process complete', { 
      ...results, 
      durationMs: duration 
    })

    return new Response(JSON.stringify({
      message: 'Webhook retry process complete',
      results,
      correlation_id: correlationId,
      duration_ms: duration
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId }
    })

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    const duration = Date.now() - startTime
    logger.error('Webhook retry fatal error', { error: errorMessage, durationMs: duration })
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      correlation_id: correlationId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId }
    })
  }
})

// Send email alert for failed webhooks
async function sendFailureAlert(
  delivery: { id: string; event_type: string; subscription?: { name: string; url: string; workspace_id: string } },
  responseStatus: number,
  responseBody: string,
  logger: ReturnType<typeof createLogger>
) {
  const resendKey = Deno.env.get('RESEND_FLOWALT') || Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    logger.debug('RESEND_API_KEY not configured, skipping email alert')
    return
  }

  const resend = new Resend(resendKey)

  try {
    // Get workspace admin emails
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: admins } = await supabase
      .from('workspace_members')
      .select(`
        user_id,
        profiles:user_id(email, full_name)
      `)
      .eq('workspace_id', delivery.subscription?.workspace_id)
      .limit(5)

    if (!admins?.length) {
      logger.debug('No admins found for workspace')
      return
    }

    const adminEmails = admins
      .map((a: any) => a.profiles?.email)
      .filter(Boolean) as string[]

    if (adminEmails.length === 0) {
      logger.debug('No admin emails found')
      return
    }

    const webhookName = delivery.subscription?.name || 'Webhook'
    const webhookUrl = delivery.subscription?.url || 'Unknown URL'

    await resend.emails.send({
      from: 'Alertas <onboarding@resend.dev>',
      to: adminEmails,
      subject: `⚠️ Webhook "${webhookName}" com falhas repetidas`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">⚠️ Alerta de Falha de Webhook</h2>
          
          <p>O webhook <strong>${webhookName}</strong> falhou múltiplas vezes e pode precisar de atenção.</p>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Webhook:</strong> ${webhookName}</p>
            <p style="margin: 0 0 8px 0;"><strong>URL:</strong> ${webhookUrl}</p>
            <p style="margin: 0 0 8px 0;"><strong>Evento:</strong> ${delivery.event_type}</p>
            <p style="margin: 0 0 8px 0;"><strong>Status HTTP:</strong> ${responseStatus}</p>
            <p style="margin: 0;"><strong>Tentativas:</strong> 3 de 5</p>
          </div>
          
          ${responseBody ? `
          <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Resposta do servidor:</strong></p>
            <pre style="margin: 0; font-size: 12px; overflow-x: auto;">${responseBody.substring(0, 500)}</pre>
          </div>
          ` : ''}
          
          <p>Por favor, verifique:</p>
          <ul>
            <li>Se o endpoint está acessível</li>
            <li>Se o servidor está retornando respostas válidas (2xx)</li>
            <li>Se há problemas de autenticação ou certificado SSL</li>
          </ul>
          
          <p style="color: #6b7280; font-size: 12px;">
            Este email foi enviado automaticamente pelo sistema de monitoramento de webhooks.
          </p>
        </div>
      `,
    })

    logger.info('Alert email sent', { deliveryId: delivery.id, recipients: adminEmails.length })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Failed to send alert email', { deliveryId: delivery.id, error: errorMessage })
  }
}
