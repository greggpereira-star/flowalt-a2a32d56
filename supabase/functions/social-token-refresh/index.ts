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

    // Parse request - can be called with platform_id or as a batch job
    const body = await req.json().catch(() => ({}));
    const { platform_id, batch_refresh } = body;

    // Batch refresh mode - refresh all expiring tokens
    if (batch_refresh) {
      const expiryThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
      
      const { data: expiringPlatforms, error } = await supabase
        .from('social_platforms')
        .select('*')
        .eq('is_active', true)
        .not('refresh_token_encrypted', 'is', null)
        .lt('token_expires_at', expiryThreshold)
        .order('token_expires_at', { ascending: true })
        .limit(50);

      if (error) {
        throw new Error(`Failed to fetch expiring platforms: ${error.message}`);
      }

      const results = {
        refreshed: 0,
        failed: 0,
        requires_reauth: [] as string[],
      };

      for (const platform of expiringPlatforms || []) {
        const refreshToken = decryptToken(platform.refresh_token_encrypted);
        const newTokens = await refreshPlatformToken(platform.platform as Platform, refreshToken);

        if (newTokens) {
          const expiresAt = newTokens.expires_in
            ? new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
            : null;

          await supabase
            .from('social_platforms')
            .update({
              access_token_encrypted: encryptToken(newTokens.access_token),
              refresh_token_encrypted: newTokens.refresh_token
                ? encryptToken(newTokens.refresh_token)
                : platform.refresh_token_encrypted,
              token_expires_at: expiresAt,
              connection_status: 'connected',
              last_sync_at: new Date().toISOString(),
              last_error: null,
            })
            .eq('id', platform.id);

          results.refreshed++;
        } else {
          await supabase
            .from('social_platforms')
            .update({
              connection_status: 'expired',
              last_error: 'Token refresh failed - reauthorization required',
            })
            .eq('id', platform.id);

          results.failed++;
          results.requires_reauth.push(platform.id);
        }
      }

      console.log(`Batch refresh: ${results.refreshed} refreshed, ${results.failed} failed`);

      return new Response(
        JSON.stringify(results),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single platform refresh
    if (!platform_id) {
      return new Response(
        JSON.stringify({ error: "Missing platform_id" }),
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
