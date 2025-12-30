import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Structured logging helper
function log(level: 'info' | 'warn' | 'error', message: string, context: Record<string, unknown> = {}, correlationId?: string) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'cleanup-job',
    message,
    correlationId,
    ...context,
  };
  
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

Deno.serve(async (req) => {
  const correlationId = crypto.randomUUID();
  const startTime = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  log('info', 'Starting cleanup job', {}, correlationId);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      old_notifications: 0,
      old_api_logs: 0,
      old_structured_logs: 0,
      old_metrics: 0,
      expired_idempotency_keys: 0,
      old_rate_limits: 0,
    };

    // 1. Clean old notifications (> 90 days, already read)
    const notifCutoff = new Date();
    notifCutoff.setDate(notifCutoff.getDate() - 90);
    
    const { error: notifError } = await supabase
      .from('notifications')
      .delete()
      .eq('is_read', true)
      .lt('created_at', notifCutoff.toISOString());

    if (notifError) {
      log('error', 'Error cleaning notifications', { error: notifError.message }, correlationId);
    } else {
      log('info', 'Deleted old notifications', {}, correlationId);
    }

    // 2. Clean old API logs (> 30 days)
    const apiLogCutoff = new Date();
    apiLogCutoff.setDate(apiLogCutoff.getDate() - 30);
    
    const { error: apiLogError } = await supabase
      .from('api_logs')
      .delete()
      .lt('created_at', apiLogCutoff.toISOString());

    if (apiLogError) {
      log('error', 'Error cleaning API logs', { error: apiLogError.message }, correlationId);
    } else {
      log('info', 'Deleted old API logs', {}, correlationId);
    }

    // 3. Clean old structured logs (> 14 days for non-error, > 30 days for error)
    const structuredLogCutoff = new Date();
    structuredLogCutoff.setDate(structuredLogCutoff.getDate() - 14);
    
    const { error: structLogError } = await supabase
      .from('structured_logs')
      .delete()
      .not('log_level', 'in', '("error","fatal")')
      .lt('created_at', structuredLogCutoff.toISOString());

    if (structLogError) {
      log('error', 'Error cleaning structured logs', { error: structLogError.message }, correlationId);
    } else {
      log('info', 'Deleted old structured logs', {}, correlationId);
    }

    // Also clean old error logs (> 30 days)
    const errorLogCutoff = new Date();
    errorLogCutoff.setDate(errorLogCutoff.getDate() - 30);
    
    await supabase
      .from('structured_logs')
      .delete()
      .in('log_level', ['error', 'fatal'])
      .lt('created_at', errorLogCutoff.toISOString());

    // 4. Clean old system metrics (> 30 days)
    const metricsCutoff = new Date();
    metricsCutoff.setDate(metricsCutoff.getDate() - 30);
    
    const { error: metricsError } = await supabase
      .from('system_metrics')
      .delete()
      .lt('created_at', metricsCutoff.toISOString());

    if (metricsError) {
      log('error', 'Error cleaning metrics', { error: metricsError.message }, correlationId);
    } else {
      log('info', 'Deleted old metrics', {}, correlationId);
    }

    // 5. Clean expired idempotency keys
    const { error: idempError } = await supabase
      .from('api_idempotency_keys')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (idempError) {
      log('error', 'Error cleaning idempotency keys', { error: idempError.message }, correlationId);
    } else {
      log('info', 'Deleted expired idempotency keys', {}, correlationId);
    }

    // 6. Clean old rate limit records (> 1 hour)
    const rateLimitCutoff = new Date();
    rateLimitCutoff.setHours(rateLimitCutoff.getHours() - 1);
    
    const { error: rateLimitError } = await supabase
      .from('api_rate_limits')
      .delete()
      .lt('window_start', rateLimitCutoff.toISOString());

    if (rateLimitError) {
      log('error', 'Error cleaning rate limits', { error: rateLimitError.message }, correlationId);
    } else {
      log('info', 'Deleted old rate limit records', {}, correlationId);
    }

    const duration = Date.now() - startTime;

    // Record metrics
    await supabase.rpc('record_metric', {
      p_metric_type: 'job',
      p_metric_name: 'cleanup_job_duration_ms',
      p_metric_value: duration,
      p_dimensions: results,
      p_correlation_id: correlationId
    });

    log('info', 'Cleanup job completed', {
      duration_ms: duration,
      ...results
    }, correlationId);

    return new Response(
      JSON.stringify({
        success: true,
        correlation_id: correlationId,
        duration_ms: duration,
        message: 'Cleanup completed successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const duration = Date.now() - startTime;
    
    log('error', 'Fatal error in cleanup job', { 
      error: errorMessage, 
      duration_ms: duration 
    }, correlationId);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        correlation_id: correlationId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
        status: 500,
      }
    );
  }
});
