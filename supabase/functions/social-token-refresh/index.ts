import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Platform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter';

interface TokenRefreshResult {
  success: boolean;
  new_expires_at?: string;
  error_code?: string;
  error_message?: string;
  requires_reauth?: boolean;
}

// Simple encryption/decryption for tokens
function decryptToken(encrypted: string): string {
  const key = Deno.env.get('TOKEN_ENCRYPTION_KEY') || 'default-key-change-me';
  const decoded = atob(encrypted);
  const bytes = new Uint8Array([...decoded].map(c => c.charCodeAt(0)));
  const keyBytes = new TextEncoder().encode(key);
  const decrypted = bytes.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
  return new TextDecoder().decode(decrypted);
}

function encryptToken(token: string): string {
  const key = Deno.env.get('TOKEN_ENCRYPTION_KEY') || 'default-key-change-me';
  const encoded = new TextEncoder().encode(token);
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = encoded.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
  return btoa(String.fromCharCode(...encrypted));
}

function getClientIdEnv(platform: Platform): string {
  const envMap: Record<Platform, string> = {
    instagram: 'META_APP_ID',
    facebook: 'META_APP_ID',
    linkedin: 'LINKEDIN_CLIENT_ID',
    tiktok: 'TIKTOK_CLIENT_KEY',
    youtube: 'GOOGLE_CLIENT_ID',
    twitter: 'TWITTER_CLIENT_ID',
  };
  return envMap[platform];
}

function getClientSecretEnv(platform: Platform): string {
  const envMap: Record<Platform, string> = {
    instagram: 'META_APP_SECRET',
    facebook: 'META_APP_SECRET',
    linkedin: 'LINKEDIN_CLIENT_SECRET',
    tiktok: 'TIKTOK_CLIENT_SECRET',
    youtube: 'GOOGLE_CLIENT_SECRET',
    twitter: 'TWITTER_CLIENT_SECRET',
  };
  return envMap[platform];
}

async function refreshPlatformToken(
  platform: Platform,
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number } | null> {
  const clientId = Deno.env.get(getClientIdEnv(platform));
  const clientSecret = Deno.env.get(getClientSecretEnv(platform));

  if (!clientId || !clientSecret) {
    throw new Error(`Missing credentials for ${platform}`);
  }

  let response: Response;
  const params = new URLSearchParams();

  switch (platform) {
    case 'instagram':
    case 'facebook':
      // Meta uses long-lived tokens, refresh by exchanging
      response = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${clientId}&` +
        `client_secret=${clientSecret}&` +
        `fb_exchange_token=${refreshToken}`
      );
      break;

    case 'linkedin':
      params.set('grant_type', 'refresh_token');
      params.set('refresh_token', refreshToken);
      params.set('client_id', clientId);
      params.set('client_secret', clientSecret);
      
      response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      break;

    case 'tiktok':
      params.set('client_key', clientId);
      params.set('client_secret', clientSecret);
      params.set('grant_type', 'refresh_token');
      params.set('refresh_token', refreshToken);
      
      response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      break;

    case 'youtube':
      params.set('client_id', clientId);
      params.set('client_secret', clientSecret);
      params.set('grant_type', 'refresh_token');
      params.set('refresh_token', refreshToken);
      
      response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      break;

    case 'twitter':
      const credentials = btoa(`${clientId}:${clientSecret}`);
      params.set('grant_type', 'refresh_token');
      params.set('refresh_token', refreshToken);
      
      response = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: params.toString(),
      });
      break;

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Token refresh failed for ${platform}:`, errorText);
    return null;
  }

  return await response.json();
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
        JSON.stringify({ success: false, error_code: 'UNAUTHORIZED', error_message: 'Missing authorization header' } as TokenRefreshResult),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'UNAUTHORIZED', error_message: 'Invalid token' } as TokenRefreshResult),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request - can be called with platform_id
    const body = await req.json().catch(() => ({}));
    const { platform_id, batch_refresh } = body;

    // Batch refresh is intentionally disabled on this public endpoint (security)
    if (batch_refresh) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'FORBIDDEN', error_message: 'batch_refresh is not supported' } as TokenRefreshResult),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single platform refresh
    if (!platform_id) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'MISSING_PARAMS', error_message: 'Missing platform_id' } as TokenRefreshResult),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: platformData, error: platformError } = await supabase
      .from('social_platforms')
      .select('*')
      .eq('id', platform_id)
      .single();

    if (platformError || !platformData) {
      return new Response(
        JSON.stringify({ error: "Platform connection not found" }),
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

    if (!roleData || !['owner', 'admin', 'coordinator'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({
          success: false,
          error_code: 'FORBIDDEN',
          error_message: 'Você não tem permissão para renovar tokens desta workspace.',
        } as TokenRefreshResult),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!platformData.refresh_token_encrypted) {
      return new Response(
        JSON.stringify({
          success: false,
          error_code: 'NO_REFRESH_TOKEN',
          error_message: 'No refresh token available - reauthorization required',
          requires_reauth: true,
        } as TokenRefreshResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const refreshToken = decryptToken(platformData.refresh_token_encrypted);
    const newTokens = await refreshPlatformToken(
      platformData.platform as Platform,
      refreshToken
    );

    if (!newTokens) {
      await supabase
        .from('social_platforms')
        .update({
          connection_status: 'expired',
          last_error: 'Token refresh failed',
        })
        .eq('id', platform_id);

      // Log failure event
      await supabase.from('domain_events').insert({
        workspace_id: platformData.workspace_id,
        event_type: 'social_token.refresh_failed',
        entity_type: 'social_platform',
        entity_id: platform_id,
        payload: { platform: platformData.platform },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error_code: 'REFRESH_FAILED',
          error_message: 'Failed to refresh token - please reconnect the platform',
          requires_reauth: true,
        } as TokenRefreshResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update with new tokens
    const newExpiresAt = newTokens.expires_in
      ? new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
      : null;

    await supabase
      .from('social_platforms')
      .update({
        access_token_encrypted: encryptToken(newTokens.access_token),
        refresh_token_encrypted: newTokens.refresh_token
          ? encryptToken(newTokens.refresh_token)
          : platformData.refresh_token_encrypted,
        token_expires_at: newExpiresAt,
        connection_status: 'connected',
        last_sync_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', platform_id);

    // Log success event
    await supabase.from('domain_events').insert({
      workspace_id: platformData.workspace_id,
      event_type: 'social_token.refreshed',
      entity_type: 'social_platform',
      entity_id: platform_id,
      payload: {
        platform: platformData.platform,
        new_expires_at: newExpiresAt,
      },
    });

    console.log(`Token refreshed for ${platformData.platform} (${platform_id})`);

    return new Response(
      JSON.stringify({
        success: true,
        new_expires_at: newExpiresAt,
      } as TokenRefreshResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Token refresh error:', errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error_code: 'SERVER_ERROR',
        error_message: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
