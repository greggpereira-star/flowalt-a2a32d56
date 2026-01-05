import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Activate multiple assets for a platform connection
 * This allows social media managers to enable multiple accounts at once
 * All selected assets become available for scheduling posts
 */
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

    const { workspace_id, platform_connection_id, asset_ids } = await req.json();

    if (!workspace_id || !platform_connection_id || !asset_ids || !Array.isArray(asset_ids)) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error_code: 'MISSING_PARAMS', 
          error_message: 'Parâmetros obrigatórios: workspace_id, platform_connection_id, asset_ids (array)' 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (asset_ids.length === 0) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error_code: 'NO_ASSETS', 
          error_message: 'Selecione pelo menos um ativo' 
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

    if (!roleData || !['super_admin', 'owner', 'admin', 'coordinator'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error_code: 'FORBIDDEN', 
          error_message: 'Você não tem permissão para ativar ativos. Requer role: owner, admin ou coordinator.' 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Entitlements check
    const { data: publishEntitlement } = await supabase
      .from('workspace_entitlements_effective')
      .select('enabled')
      .eq('workspace_id', workspace_id)
      .eq('entitlement_key', 'social_publish')
      .maybeSingle();

    if (!publishEntitlement?.enabled) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error_code: 'PLAN_REQUIRED', 
          error_message: 'Conectar redes sociais requer um plano PRO ou superior.' 
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
        JSON.stringify({ ok: false, error_code: 'CONNECTION_NOT_FOUND', error_message: 'Conexão não encontrada' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all assets for this connection
    const { data: allAssets, error: assetsError } = await supabase
      .from('social_platform_assets')
      .select('*')
      .eq('platform_connection_id', platform_connection_id);

    if (assetsError) {
      console.error('Error fetching assets:', assetsError);
      return new Response(
        JSON.stringify({ ok: false, error_code: 'ASSETS_ERROR', error_message: 'Erro ao buscar ativos' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate that all requested asset_ids exist
    const existingAssetIds = new Set(allAssets?.map(a => a.asset_id) || []);
    const invalidIds = asset_ids.filter((id: string) => !existingAssetIds.has(id));
    
    if (invalidIds.length > 0) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error_code: 'INVALID_ASSETS', 
          error_message: `Ativos não encontrados: ${invalidIds.join(', ')}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark selected assets as active
    const { error: updateError } = await supabase
      .from('social_platform_assets')
      .update({ is_active: true })
      .eq('platform_connection_id', platform_connection_id)
      .in('asset_id', asset_ids);

    if (updateError) {
      console.error('Error activating assets:', updateError);
      return new Response(
        JSON.stringify({ ok: false, error_code: 'UPDATE_FAILED', error_message: 'Falha ao ativar ativos' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark non-selected assets as inactive
    const inactiveIds = [...existingAssetIds].filter(id => !asset_ids.includes(id));
    if (inactiveIds.length > 0) {
      await supabase
        .from('social_platform_assets')
        .update({ is_active: false })
        .eq('platform_connection_id', platform_connection_id)
        .in('asset_id', inactiveIds);
    }

    // Get the selected assets for display
    const selectedAssets = allAssets?.filter(a => asset_ids.includes(a.asset_id)) || [];
    
    // Use the first selected asset as the "primary" for display purposes
    const primaryAsset = selectedAssets[0];
    
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

    // Build display name from all selected assets
    const displayName = selectedAssets.length === 1 
      ? selectedAssets[0].asset_name
      : `${selectedAssets.length} contas`;

    // Update platform connection
    const { error: platformUpdateError } = await supabase
      .from('social_platforms')
      .update({
        platform_account_type: primaryAsset?.asset_type || null,
        account_id: primaryAsset?.asset_id || null,
        account_name: displayName,
        asset_selected_at: new Date().toISOString(),
        connection_status: newStatus,
        last_error_code: null,
        last_error_message: null,
        last_validated_at: new Date().toISOString(),
      })
      .eq('id', platform_connection_id);

    if (platformUpdateError) {
      console.error('Error updating platform:', platformUpdateError);
      return new Response(
        JSON.stringify({ ok: false, error_code: 'UPDATE_FAILED', error_message: 'Falha ao atualizar conexão' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log event
    await supabase.from('domain_events').insert({
      workspace_id,
      event_type: 'social_platform.assets_activated',
      entity_type: 'social_platform',
      entity_id: platform_connection_id,
      payload: {
        platform: platformData.platform,
        activated_count: asset_ids.length,
        asset_ids,
        asset_names: selectedAssets.map(a => a.asset_name),
      },
      actor_id: user.id,
    });

    console.log(`Activated ${asset_ids.length} assets for connection ${platform_connection_id}`);

    return new Response(
      JSON.stringify({
        ok: true,
        activated_count: asset_ids.length,
        assets: selectedAssets.map(a => ({
          asset_id: a.asset_id,
          asset_name: a.asset_name,
          asset_type: a.asset_type,
        })),
        connection_status: newStatus,
        display_name: displayName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Assets activate error:', errorMessage);
    return new Response(
      JSON.stringify({ ok: false, error_code: 'SERVER_ERROR', error_message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
