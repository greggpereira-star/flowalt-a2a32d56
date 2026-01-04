import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error_code: 'UNAUTHORIZED', error_message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error_code: 'UNAUTHORIZED', error_message: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { workspace_id, platform_connection_id, reason } = await req.json();

    if (!workspace_id || !platform_connection_id) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error_code: 'MISSING_PARAMS', 
          error_message: 'Parâmetros obrigatórios: workspace_id, platform_connection_id' 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===========================================
    // ROLE CHECK - Elevated roles only
    // ===========================================
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['owner', 'admin', 'coordinator'].includes(roleData.role)) {
      console.log(`Disconnect blocked for user ${user.id}: insufficient role (${roleData?.role})`);
      
      await supabase.from('domain_events').insert({
        workspace_id,
        event_type: 'social_platform.disconnect_blocked',
        entity_type: 'social_platform',
        entity_id: platform_connection_id,
        payload: {
          reason: 'PERMISSION_DENIED',
          user_role: roleData?.role,
        },
        actor_id: user.id,
      });

      return new Response(
        JSON.stringify({ 
          ok: false, 
          error_code: 'FORBIDDEN', 
          error_message: 'Você não tem permissão para desconectar plataformas. Requer role: owner, admin ou coordinator.' 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get platform connection
    const { data: platformData, error: platformError } = await supabase
      .from('social_platforms')
      .select('*')
      .eq('id', platform_connection_id)
      .eq('workspace_id', workspace_id)
      .single();

    if (platformError || !platformData) {
      return new Response(
        JSON.stringify({ ok: false, error_code: 'NOT_FOUND', error_message: 'Conexão não encontrada' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Soft delete - set is_active to false and clear tokens
    const { error: updateError } = await supabase
      .from('social_platforms')
      .update({
        is_active: false,
        connection_status: 'disconnected',
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
        last_error_code: null,
        last_error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', platform_connection_id);

    if (updateError) {
      console.error('Error disconnecting platform:', updateError);
      return new Response(
        JSON.stringify({ ok: false, error_code: 'UPDATE_FAILED', error_message: 'Falha ao desconectar plataforma' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clear associated assets
    await supabase
      .from('social_platform_assets')
      .delete()
      .eq('platform_connection_id', platform_connection_id);

    // Log disconnect event
    await supabase.from('domain_events').insert({
      workspace_id,
      event_type: 'social_platform.disconnected',
      entity_type: 'social_platform',
      entity_id: platform_connection_id,
      payload: {
        platform: platformData.platform,
        account_name: platformData.account_name,
        account_id: platformData.account_id,
        reason: reason || 'user_initiated',
        previous_status: platformData.connection_status,
      },
      actor_id: user.id,
    });

    console.log(`Platform ${platformData.platform} (${platformData.account_name}) disconnected by user ${user.id}`);

    return new Response(
      JSON.stringify({
        ok: true,
        message: `${platformData.platform} desconectado com sucesso`,
        platform: platformData.platform,
        account_name: platformData.account_name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Disconnect error:', errorMessage);
    return new Response(
      JSON.stringify({ ok: false, error_code: 'SERVER_ERROR', error_message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
