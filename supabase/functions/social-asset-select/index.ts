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

    const { workspace_id, platform_connection_id, asset_type, asset_id } = await req.json();

    if (!workspace_id || !platform_connection_id || !asset_type || !asset_id) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error_code: 'MISSING_PARAMS', 
          error_message: 'Parâmetros obrigatórios: workspace_id, platform_connection_id, asset_type, asset_id' 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user role (elevated only)
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['owner', 'admin', 'coordinator'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error_code: 'FORBIDDEN', 
          error_message: 'Você não tem permissão para selecionar ativos. Requer role: owner, admin ou coordinator.' 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify asset exists
    const { data: assetData, error: assetError } = await supabase
      .from('social_platform_assets')
      .select('*')
      .eq('platform_connection_id', platform_connection_id)
      .eq('asset_type', asset_type)
      .eq('asset_id', asset_id)
      .single();

    if (assetError || !assetData) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error_code: 'ASSET_NOT_FOUND', 
          error_message: 'Ativo não encontrado. Execute a busca de ativos novamente.' 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current platform connection
    const { data: platformData, error: platformError } = await supabase
      .from('social_platforms')
      .select('*')
      .eq('id', platform_connection_id)
      .eq('workspace_id', workspace_id)
      .single();

    if (platformError || !platformData) {
      return new Response(
        JSON.stringify({ ok: false, error_code: 'CONNECTION_NOT_FOUND', error_message: 'Conexão não encontrada' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine connection status based on token expiration
    let newStatus = 'connected';
    if (platformData.token_expires_at) {
      const expiresAt = new Date(platformData.token_expires_at);
      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      if (expiresAt < now) {
        newStatus = 'expired';
      } else if (expiresAt < oneWeekFromNow) {
        newStatus = 'expiring';
      }
    }

    // Update platform connection with selected asset
    const { error: updateError } = await supabase
      .from('social_platforms')
      .update({
        platform_account_type: asset_type,
        account_id: asset_id,
        account_name: assetData.asset_name,
        asset_selected_at: new Date().toISOString(),
        connection_status: newStatus,
        last_error_code: null,
        last_error_message: null,
      })
      .eq('id', platform_connection_id);

    if (updateError) {
      console.error('Error updating platform:', updateError);
      return new Response(
        JSON.stringify({ ok: false, error_code: 'UPDATE_FAILED', error_message: 'Falha ao salvar seleção' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log event
    await supabase.from('domain_events').insert({
      workspace_id,
      event_type: 'social_platform.asset_selected',
      entity_type: 'social_platform',
      entity_id: platform_connection_id,
      payload: {
        platform: platformData.platform,
        asset_type,
        asset_id,
        asset_name: assetData.asset_name,
        previous_asset_id: platformData.account_id,
      },
      actor_id: user.id,
    });

    console.log(`Asset selected: ${asset_type}/${asset_id} for connection ${platform_connection_id}`);

    return new Response(
      JSON.stringify({
        ok: true,
        selected: {
          asset_type,
          asset_id,
          asset_name: assetData.asset_name,
        },
        connection_status: newStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Asset select error:', errorMessage);
    return new Response(
      JSON.stringify({ ok: false, error_code: 'SERVER_ERROR', error_message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
