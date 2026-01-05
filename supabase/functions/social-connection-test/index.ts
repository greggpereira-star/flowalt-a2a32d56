import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Platform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter';

interface TestResult {
  success: boolean;
  platform: string;
  account_id?: string;
  account_name?: string;
  asset_type?: string;
  permissions?: string[];
  error_code?: string;
  error_message?: string;
  gox_message?: string;
  requires_reconnect?: boolean;
  requires_asset_selection?: boolean;
}

// Simple decryption for tokens
function decryptToken(encrypted: string): string {
  const key = Deno.env.get('TOKEN_ENCRYPTION_KEY') || 'default-key-change-me';
  const decoded = atob(encrypted);
  const bytes = new Uint8Array([...decoded].map(c => c.charCodeAt(0)));
  const keyBytes = new TextEncoder().encode(key);
  const decrypted = bytes.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
  return new TextDecoder().decode(decrypted);
}

async function testAssetConnection(
  platform: Platform,
  accessToken: string,
  assetType: string,
  assetId: string
): Promise<TestResult> {
  try {
    let response: Response;
    let data: any;

    switch (platform) {
      case 'instagram':
      case 'facebook':
        if (assetType === 'facebook_page') {
          response = await fetch(
            `https://graph.facebook.com/v24.0/${assetId}?fields=id,name&access_token=${accessToken}`
          );
          
          if (!response.ok) {
            const error = await response.json();
            return {
              success: false,
              platform,
              error_code: error.error?.code?.toString() || 'API_ERROR',
              error_message: error.error?.message || 'Failed to verify page',
              gox_message: 'Página do Facebook não acessível. Verifique as permissões.',
              requires_reconnect: error.error?.code === 190,
            };
          }
          
          data = await response.json();
          return {
            success: true,
            platform,
            account_id: data.id,
            account_name: data.name,
            asset_type: 'facebook_page',
          };
        } else if (assetType === 'instagram_business') {
          response = await fetch(
            `https://graph.facebook.com/v24.0/${assetId}?fields=id,username&access_token=${accessToken}`
          );
          
          if (!response.ok) {
            const error = await response.json();
            return {
              success: false,
              platform,
              error_code: error.error?.code?.toString() || 'API_ERROR',
              error_message: error.error?.message || 'Failed to verify Instagram account',
              gox_message: 'Conta do Instagram Business não acessível. Verifique se a conta está vinculada.',
              requires_reconnect: error.error?.code === 190,
            };
          }
          
          data = await response.json();
          return {
            success: true,
            platform,
            account_id: data.id,
            account_name: `@${data.username}`,
            asset_type: 'instagram_business',
          };
        }
        
        // Fallback to /me for old connections without asset
        response = await fetch(
          `https://graph.facebook.com/v24.0/me?fields=id,name&access_token=${accessToken}`
        );
        
        if (!response.ok) {
          const error = await response.json();
          return {
            success: false,
            platform,
            error_code: error.error?.code?.toString() || 'API_ERROR',
            error_message: error.error?.message || 'Failed to verify token',
            gox_message: 'Token expirado ou inválido. Reconecte a plataforma.',
            requires_reconnect: error.error?.code === 190,
          };
        }
        
        data = await response.json();
        return {
          success: true,
          platform,
          account_id: data.id,
          account_name: data.name,
        };

      case 'youtube':
        if (assetType === 'youtube_channel' && assetId) {
          response = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${assetId}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
        } else {
          response = await fetch(
            'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
        }
        
        if (!response.ok) {
          const error = await response.json();
          return {
            success: false,
            platform,
            error_code: error.error?.code?.toString() || 'API_ERROR',
            error_message: error.error?.message || 'Failed to verify YouTube token',
            gox_message: 'Token do YouTube expirado ou inválido. Reconecte.',
            requires_reconnect: response.status === 401,
          };
        }
        
        data = await response.json();
        const channel = data.items?.[0];
        
        if (!channel) {
          return {
            success: false,
            platform,
            error_code: 'NO_CHANNEL',
            error_message: 'No YouTube channel found',
            gox_message: 'Nenhum canal do YouTube encontrado para esta conta.',
            requires_reconnect: false,
          };
        }
        
        return {
          success: true,
          platform,
          account_id: channel.id,
          account_name: channel.snippet?.title,
          asset_type: 'youtube_channel',
        };

      case 'linkedin':
        response = await fetch('https://api.linkedin.com/v2/me', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        
        if (!response.ok) {
          return {
            success: false,
            platform,
            error_code: 'UNAUTHORIZED',
            error_message: 'LinkedIn token invalid or expired',
            gox_message: 'Token do LinkedIn expirado. Reconecte a plataforma.',
            requires_reconnect: response.status === 401,
          };
        }
        
        data = await response.json();
        return {
          success: true,
          platform,
          account_id: data.id,
          account_name: `${data.localizedFirstName} ${data.localizedLastName}`,
          asset_type: assetType || 'linkedin_personal',
        };

      case 'tiktok':
        response = await fetch(
          'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name',
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        if (!response.ok) {
          return {
            success: false,
            platform,
            error_code: 'UNAUTHORIZED',
            error_message: 'TikTok token invalid or expired',
            gox_message: 'Token do TikTok expirado. Reconecte a plataforma.',
            requires_reconnect: true,
          };
        }
        
        data = await response.json();
        return {
          success: true,
          platform,
          account_id: data.data?.user?.open_id,
          account_name: data.data?.user?.display_name,
          asset_type: 'tiktok_account',
        };

      case 'twitter':
        response = await fetch('https://api.twitter.com/2/users/me', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        
        if (!response.ok) {
          return {
            success: false,
            platform,
            error_code: 'UNAUTHORIZED',
            error_message: 'X (Twitter) token invalid or expired',
            gox_message: 'Token do X/Twitter expirado. Reconecte a plataforma.',
            requires_reconnect: response.status === 401,
          };
        }
        
        data = await response.json();
        return {
          success: true,
          platform,
          account_id: data.data?.id,
          account_name: `@${data.data?.username}`,
          asset_type: 'twitter_account',
        };

      default:
        return {
          success: false,
          platform,
          error_code: 'UNSUPPORTED',
          error_message: `Platform ${platform} is not supported`,
          gox_message: `Plataforma ${platform} não suportada ainda.`,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      platform,
      error_code: 'NETWORK_ERROR',
      error_message: errorMessage,
      gox_message: 'Erro de rede ao testar conexão. Tente novamente.',
      requires_reconnect: false,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT from request (this function runs with verify_jwt=false in config)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error_code: 'UNAUTHORIZED',
          error_message: 'Missing authorization header',
          gox_message: 'Faça login novamente e tente de novo.',
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error_code: 'UNAUTHORIZED',
          error_message: 'Invalid token',
          gox_message: 'Sua sessão expirou. Faça login novamente.',
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { platform_id } = await req.json();

    if (!platform_id) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error_code: "MISSING_PARAMS",
          error_message: "Missing platform_id",
          gox_message: "ID da plataforma não informado.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get platform connection
    const { data: platformData, error: platformError } = await supabase
      .from('social_platforms')
      .select('*')
      .eq('id', platform_id)
      .single();

    if (platformError || !platformData) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error_code: "NOT_FOUND",
          error_message: "Platform connection not found",
          gox_message: "Conexão não encontrada. Conecte a plataforma novamente.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Role check (elevated roles only)
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('workspace_id', platformData.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['super_admin', 'owner', 'admin', 'coordinator'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({
          success: false,
          error_code: 'FORBIDDEN',
          error_message: 'Você não tem permissão para validar esta conexão.',
          gox_message: 'Sem permissão (requer owner/admin/coordinator).',
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===========================================
    // ENTITLEMENTS CHECK - Server-side validation
    // ===========================================
    const { data: publishEntitlement } = await supabase
      .from('workspace_entitlements_effective')
      .select('enabled')
      .eq('workspace_id', platformData.workspace_id)
      .eq('entitlement_key', 'social_publish')
      .maybeSingle();

    if (!publishEntitlement?.enabled) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error_code: 'PLAN_REQUIRED',
          error_message: 'Social publish feature not enabled for this workspace',
          gox_message: 'Conectar redes sociais requer um plano PRO ou superior.',
          requires_upgrade: true,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!platformData.access_token_encrypted) {
      return new Response(
        JSON.stringify({
          success: false,
          error_code: 'NO_TOKEN',
          error_message: 'No access token stored for this connection',
          gox_message: 'Reconecte a plataforma para obter novos tokens.',
          requires_reconnect: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if asset is selected (required for full validation)
    const assetType = platformData.platform_account_type;
    const assetId = platformData.account_id;
    
    if (!assetType || !assetId) {
      // Asset not selected - return warning but don't fail completely
      return new Response(
        JSON.stringify({
          success: false,
          error_code: 'ASSET_REQUIRED',
          error_message: 'No asset selected for this connection',
          gox_message: 'Selecione um ativo (Página/Conta/Canal) antes de concluir a conexão.',
          requires_asset_selection: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt token
    const accessToken = decryptToken(platformData.access_token_encrypted);

    // Test the connection with the selected asset
    const result = await testAssetConnection(
      platformData.platform as Platform,
      accessToken,
      assetType,
      assetId
    );

    // Update platform status based on result
    const updateData: Record<string, any> = {
      last_sync_at: new Date().toISOString(),
      last_tested_at: new Date().toISOString(),
    };

    if (result.success) {
      updateData.connection_status = 'connected';
      updateData.last_error = null;
      updateData.last_error_code = null;
      updateData.last_error_message = null;
    } else {
      updateData.connection_status = result.requires_reconnect ? 'expired' : 'error';
      updateData.last_error = result.error_message;
      updateData.last_error_code = result.error_code;
      updateData.last_error_message = result.gox_message || result.error_message;
    }

    await supabase
      .from('social_platforms')
      .update(updateData)
      .eq('id', platform_id);

    // Log test event
    await supabase.from('domain_events').insert({
      workspace_id: platformData.workspace_id,
      event_type: result.success ? 'social_platform.connection_tested' : 'social_connection.test_failed',
      entity_type: 'social_platform',
      entity_id: platform_id,
      payload: {
        ...result,
        asset_type: assetType,
        asset_id: assetId,
      },
    });

    console.log(`Connection test for ${platformData.platform} (${assetType}/${assetId}): ${result.success ? 'PASSED' : 'FAILED'}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Connection test error:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false,
        error_code: 'SERVER_ERROR',
        error_message: errorMessage,
        gox_message: 'Erro interno ao testar conexão. Tente novamente.',
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
