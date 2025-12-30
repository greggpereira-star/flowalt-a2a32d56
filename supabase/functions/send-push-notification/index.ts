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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, workspace_id, payload } = await req.json() as {
      user_id?: string;
      workspace_id?: string;
      payload: PushPayload;
    };

    console.log('Sending push notification:', { user_id, workspace_id, payload });

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

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Note: For production, you would need to set up VAPID keys and use web-push library
    // This is a simplified implementation that stores the notification intent
    // In production, you would use a service like Firebase Cloud Messaging or web-push

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
          },
        });

        sentCount++;
      } catch (pushError) {
        console.error('Failed to send push:', pushError);
        failedSubscriptions.push(subscription.id);
      }
    }

    // Deactivate failed subscriptions
    if (failedSubscriptions.length > 0) {
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .in('id', failedSubscriptions);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedSubscriptions.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-push-notification:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
