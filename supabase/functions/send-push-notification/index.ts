import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
}

// Structured logging helper
function createLogger(correlationId: string) {
  const log = (level: string, message: string, context: Record<string, unknown> = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'send-push-notification',
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
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
  const logger = createLogger(correlationId);
  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, workspace_id, payload } = await req.json() as {
      user_id?: string;
      workspace_id?: string;
      payload: PushPayload;
    };

    logger.info('Processing push notification request', { 
      userId: user_id, 
      workspaceId: workspace_id,
      payloadTitle: payload.title 
    });

    // Get push subscriptions
    let query = supabase
      .from('push_subscriptions')
      .select('*')
      .eq('is_active', true);

    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    if (workspace_id) {
      query = query.eq('workspace_id', workspace_id);
    }

    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      logger.error('Error fetching subscriptions', { error: subError.message });
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      logger.info('No subscriptions found', { userId: user_id, workspaceId: workspace_id });
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId } }
      );
    }

    logger.info('Found subscriptions', { count: subscriptions.length });

    let sentCount = 0;
    const failedSubscriptions: string[] = [];

    for (const subscription of subscriptions) {
      try {
        // Create an in-app notification as fallback
        await supabase.from('notifications').insert({
          user_id: subscription.user_id,
          workspace_id: subscription.workspace_id,
          type: 'push_notification',
          title: payload.title,
          message: payload.body,
          metadata: { 
            url: payload.url,
            tag: payload.tag,
            push_endpoint: subscription.endpoint,
            correlation_id: correlationId
          },
        });

        sentCount++;
      } catch (pushError) {
        const errorMessage = pushError instanceof Error ? pushError.message : 'Unknown error';
        logger.error('Failed to send push notification', { 
          subscriptionId: subscription.id,
          error: errorMessage 
        });
        failedSubscriptions.push(subscription.id);
      }
    }

    // Deactivate failed subscriptions
    if (failedSubscriptions.length > 0) {
      logger.warn('Deactivating failed subscriptions', { count: failedSubscriptions.length });
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .in('id', failedSubscriptions);
    }

    const duration = Date.now() - startTime;
    logger.info('Push notification job completed', { 
      sent: sentCount, 
      failed: failedSubscriptions.length,
      durationMs: duration 
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedSubscriptions.length,
        correlation_id: correlationId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const duration = Date.now() - startTime;
    
    logger.error('Fatal error in send-push-notification', { 
      error: errorMessage,
      durationMs: duration 
    });
    
    return new Response(
      JSON.stringify({ error: errorMessage, correlation_id: correlationId }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId },
        status: 500,
      }
    );
  }
});
