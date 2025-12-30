import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_RETRIES = 5
const RETRY_DELAYS = [60, 300, 900, 3600, 14400] // 1min, 5min, 15min, 1h, 4h

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    console.log('Starting webhook retry process...')

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
      console.error('Error fetching pending deliveries:', fetchError)
      throw fetchError
    }

    console.log(`Found ${pendingDeliveries?.length || 0} deliveries to retry`)

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
    }

    if (!pendingDeliveries || pendingDeliveries.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No pending deliveries to retry',
        results 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Process each delivery
    for (const delivery of pendingDeliveries) {
      results.processed++

      // Skip if subscription is inactive
      if (!delivery.subscription?.is_active) {
        console.log(`Skipping delivery ${delivery.id} - subscription inactive`)
        results.skipped++
        continue
      }

      const subscriptionUrl = delivery.subscription.url
      const subscriptionSecret = delivery.subscription.secret

      console.log(`Retrying delivery ${delivery.id} to ${subscriptionUrl}`)

      try {
        // Attempt to deliver
        const response = await fetch(subscriptionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': subscriptionSecret,
            'X-Webhook-Event': delivery.event_type,
            'X-Webhook-Retry-Count': String(delivery.retry_count + 1),
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
          console.error(`Error updating delivery ${delivery.id}:`, updateError)
        }

        if (isSuccess) {
          console.log(`Delivery ${delivery.id} succeeded with status ${responseStatus}`)
          results.successful++
        } else {
          console.log(`Delivery ${delivery.id} failed with status ${responseStatus}, next retry at ${nextRetryAt}`)
          results.failed++
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error(`Error delivering webhook ${delivery.id}:`, err)

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

    console.log('Webhook retry process complete:', results)

    return new Response(JSON.stringify({
      message: 'Webhook retry process complete',
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('Webhook retry error:', err)
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
