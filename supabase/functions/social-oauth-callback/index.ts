import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Platform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter';

// Graph API version - keep in sync with social-oauth-start
const GRAPH_VERSION = '21.0';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

interface AccountInfo {
  account_id: string;
  account_name: string;
  account_type: string;
  profile_image_url?: string;
}

// Token exchange URLs
const TOKEN_URLS: Record<Platform, string> = {
  instagram: `https://graph.facebook.com/v${GRAPH_VERSION}/oauth/access_token`,
  facebook: `https://graph.facebook.com/v${GRAPH_VERSION}/oauth/access_token`,
  linkedin: 'https://www.linkedin.com/oauth/v2/accessToken',
  tiktok: 'https://open.tiktokapis.com/v2/oauth/token/',
  youtube: 'https://oauth2.googleapis.com/token',
  twitter: 'https://api.twitter.com/2/oauth2/token',
};

async function exchangeCodeForToken(
  platform: Platform,
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<TokenResponse> {
  const clientId = Deno.env.get(getClientIdEnv(platform))!;
  const clientSecret = Deno.env.get(getClientSecretEnv(platform))!;
  
  const tokenUrl = TOKEN_URLS[platform];
  const params = new URLSearchParams();

  params.set('code', code);
  params.set('redirect_uri', redirectUri);
  params.set('grant_type', 'authorization_code');

  if (platform === 'twitter') {
    params.set('client_id', clientId);
    if (codeVerifier) params.set('code_verifier', codeVerifier);
  } else if (platform === 'tiktok') {
    params.set('client_key', clientId);
    params.set('client_secret', clientSecret);
  } else if (platform === 'linkedin') {
    params.set('client_id', clientId);
    params.set('client_secret', clientSecret);
  } else if (platform === 'facebook' || platform === 'instagram') {
    // Meta token exchange
    params.set('client_id', clientId);
    params.set('client_secret', clientSecret);
    if (codeVerifier) params.set('code_verifier', codeVerifier);
  } else {
    params.set('client_id', clientId);
    params.set('client_secret', clientSecret);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  // Twitter uses Basic auth
  if (platform === 'twitter') {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    headers['Authorization'] = `Basic ${credentials}`;
  }

  console.log(`Exchanging code for token at ${tokenUrl}...`);
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Token exchange failed for ${platform}:`, errorText);
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Exchange short-lived token for long-lived token (Meta only)
 * Long-lived tokens last ~60 days
 */
async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<{ access_token: string; expires_in?: number }> {
  const clientId = Deno.env.get('META_APP_ID')!;
  const clientSecret = Deno.env.get('META_APP_SECRET')!;
  
  const url = `https://graph.facebook.com/v${GRAPH_VERSION}/oauth/access_token?` +
    `grant_type=fb_exchange_token&` +
    `client_id=${clientId}&` +
    `client_secret=${clientSecret}&` +
    `fb_exchange_token=${shortLivedToken}`;

  console.log('Exchanging for long-lived token...');
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.warn('Long-lived token exchange failed, using short-lived:', errorText);
    // Return original token if exchange fails
    return { access_token: shortLivedToken };
  }

  const data = await response.json();
  console.log(`Got long-lived token, expires_in: ${data.expires_in}`);
  
  return data;
}

async function fetchAccountInfo(platform: Platform, accessToken: string): Promise<AccountInfo> {
  let response: Response;
  let data: any;

  switch (platform) {
    case 'instagram':
    case 'facebook':
      // Get user info
      response = await fetch(
        `https://graph.facebook.com/v${GRAPH_VERSION}/me?fields=id,name,picture&access_token=${accessToken}`
      );
      data = await response.json();
      
      if (!response.ok) {
        console.error('Failed to fetch Meta user info:', data);
        throw new Error(data.error?.message || 'Failed to fetch user info');
      }
      
      return {
        account_id: data.id,
        account_name: data.name,
        account_type: 'user',
        profile_image_url: data.picture?.data?.url,
      };

    case 'linkedin':
      response = await fetch('https://api.linkedin.com/v2/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      data = await response.json();
      return {
        account_id: data.id,
        account_name: `${data.localizedFirstName} ${data.localizedLastName}`,
        account_type: 'personal',
      };

    case 'tiktok':
      response = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      data = await response.json();
      return {
        account_id: data.data?.user?.open_id || 'unknown',
        account_name: data.data?.user?.display_name || 'TikTok User',
        account_type: 'creator',
        profile_image_url: data.data?.user?.avatar_url,
      };

    case 'youtube':
      response = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      data = await response.json();
      const channel = data.items?.[0];
      return {
        account_id: channel?.id || 'unknown',
        account_name: channel?.snippet?.title || 'YouTube Channel',
        account_type: 'channel',
        profile_image_url: channel?.snippet?.thumbnails?.default?.url,
      };

    case 'twitter':
      response = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      data = await response.json();
      return {
        account_id: data.data?.id || 'unknown',
        account_name: `@${data.data?.username || 'user'}`,
        account_type: 'user',
        profile_image_url: data.data?.profile_image_url,
      };

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
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

// Simple encryption for tokens (in production, use proper vault)
function encryptToken(token: string): string {
  const key = Deno.env.get('TOKEN_ENCRYPTION_KEY') || 'default-key-change-me';
  // Simple XOR encryption - in production use AES-256
  const encoded = new TextEncoder().encode(token);
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = encoded.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
  return btoa(String.fromCharCode(...encrypted));
}

serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get OAuth callback parameters
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    const errorReason = url.searchParams.get('error_reason');

    if (error) {
      // Normalize Meta's invalid_scope to our standard code
      const normalizedError = error === 'invalid_scope' ? 'INVALID_SCOPE' : error.toUpperCase();
      console.error('OAuth error:', normalizedError, errorDescription, errorReason);

      // Try to redirect back to the original return_url stored in oauth_states
      let returnUrl: string | null = null;
      let platformForRedirect: string | null = null;
      let workspaceId: string | null = null;
      let userId: string | null = null;

      if (state) {
        const { data: oauthState } = await supabase
          .from('oauth_states')
          .select('*')
          .eq('state', state)
          .maybeSingle();

        if (oauthState) {
          returnUrl = oauthState.return_url || null;
          platformForRedirect = oauthState.platform || null;
          workspaceId = oauthState.workspace_id || null;
          userId = oauthState.user_id || null;

          // Log failure event
          if (workspaceId) {
            await supabase.from('domain_events').insert({
              workspace_id: workspaceId,
              event_type: 'social_oauth.failed',
              entity_type: 'social_platform',
              entity_id: state,
              payload: {
                platform: platformForRedirect,
                provider: platformForRedirect === 'facebook' || platformForRedirect === 'instagram' ? 'meta' : platformForRedirect,
                error_code: normalizedError,
                error_description: errorDescription || null,
                error_reason: errorReason || null,
              },
              actor_id: userId,
            });
          }

          // Clean up OAuth state
          await supabase.from('oauth_states').delete().eq('state', state);
        }
      }

      return createErrorRedirect(
        normalizedError,
        errorDescription || errorReason || 'OAuth authorization failed',
        returnUrl,
        platformForRedirect
      );
    }

    if (!code || !state) {
      return createErrorRedirect('MISSING_PARAMS', 'Missing code or state parameter');
    }

    // Validate state and get OAuth session (check not used)
    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .is('used_at', null)
      .single();

    if (stateError || !oauthState) {
      console.error('Invalid OAuth state:', stateError);
      return createErrorRedirect('INVALID_STATE', 'OAuth session expired or invalid');
    }

    // Check expiration
    if (new Date(oauthState.expires_at) < new Date()) {
      await supabase.from('oauth_states').delete().eq('state', state);
      return createErrorRedirect('EXPIRED', 'OAuth session expired');
    }

    // Mark state as used immediately to prevent replay attacks
    const { error: markUsedError } = await supabase
      .from('oauth_states')
      .update({ used_at: new Date().toISOString() })
      .eq('state', state)
      .is('used_at', null);

    if (markUsedError) {
      console.error('Failed to mark state as used:', markUsedError);
      return createErrorRedirect('REPLAY_DETECTED', 'State already used');
    }

    const platform = oauthState.platform as Platform;
    const workspaceId = oauthState.workspace_id;
    const userId = oauthState.user_id;
    const codeVerifier = oauthState.code_verifier;
    const returnUrl = oauthState.return_url || '/marketing';

    // Check credentials exist
    const clientSecret = Deno.env.get(getClientSecretEnv(platform));
    if (!clientSecret) {
      return createErrorRedirect('NOT_CONFIGURED', `${platform} credentials not configured`, returnUrl, platform);
    }

    // Exchange code for tokens
    const redirectUri = `${supabaseUrl}/functions/v1/social-oauth-callback`;
    let tokens = await exchangeCodeForToken(platform, code, redirectUri, codeVerifier);

    // For Meta platforms, try to get a long-lived token
    const isMetaPlatform = platform === 'facebook' || platform === 'instagram';
    if (isMetaPlatform && tokens.access_token) {
      const longLivedResult = await exchangeForLongLivedToken(tokens.access_token);
      tokens = {
        ...tokens,
        access_token: longLivedResult.access_token,
        expires_in: longLivedResult.expires_in || tokens.expires_in,
      };
    }

    // Fetch account info to validate token works
    const accountInfo = await fetchAccountInfo(platform, tokens.access_token);

    // Calculate token expiration
    const tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Parse scopes from response
    const scopesArray = tokens.scope?.split(/[,\s]+/).filter(Boolean) || [];

    // Store platform connection
    const { data: platformData, error: platformError } = await supabase
      .from('social_platforms')
      .upsert({
        workspace_id: workspaceId,
        platform,
        account_id: accountInfo.account_id,
        account_name: accountInfo.account_name,
        account_type: accountInfo.account_type,
        profile_image_url: accountInfo.profile_image_url,
        access_token_encrypted: encryptToken(tokens.access_token),
        refresh_token_encrypted: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        token_expires_at: tokenExpiresAt,
        scopes: scopesArray,
        is_active: true,
        // Set to pending_assets - user needs to select which page/account to use
        connection_status: 'pending_assets',
        last_sync_at: new Date().toISOString(),
        last_error: null,
        last_error_code: null,
        last_error_message: null,
        created_by: userId,
      }, {
        onConflict: 'workspace_id,platform,account_id',
      })
      .select()
      .single();

    if (platformError) {
      console.error('Error storing platform:', platformError);
      return createErrorRedirect('STORAGE_ERROR', 'Failed to save connection', returnUrl, platform);
    }

    // Log success event
    await supabase.from('domain_events').insert({
      workspace_id: workspaceId,
      event_type: 'social_oauth.completed',
      entity_type: 'social_platform',
      entity_id: platformData.id,
      payload: {
        platform,
        provider: isMetaPlatform ? 'meta' : platform,
        account_id: accountInfo.account_id,
        account_name: accountInfo.account_name,
        has_refresh_token: !!tokens.refresh_token,
        token_expires_at: tokenExpiresAt,
        scopes: scopesArray,
        is_long_lived: isMetaPlatform,
      },
      actor_id: userId,
    });

    // Clean up OAuth state
    await supabase.from('oauth_states').delete().eq('state', state);

    console.log(`OAuth completed for ${platform}: ${accountInfo.account_name} (token expires: ${tokenExpiresAt})`);

    // Redirect back to app
    let successUrl: URL;
    try {
      successUrl = new URL(returnUrl);
    } catch {
      // Backwards-compatible fallback for older stored states
      successUrl = new URL(returnUrl, supabaseUrl.replace('.supabase.co', '.lovable.app'));
    }

    successUrl.searchParams.set('oauth_success', 'true');
    successUrl.searchParams.set('platform', platform);

    return new Response(null, {
      status: 302,
      headers: {
        'Location': successUrl.toString(),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('OAuth callback error:', errorMessage);
    return createErrorRedirect('SERVER_ERROR', errorMessage);
  }
});

function createErrorRedirect(
  error: string,
  description: string,
  returnUrl?: string | null,
  platform?: string | null
): Response {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  let targetUrl: URL;
  if (returnUrl) {
    try {
      targetUrl = new URL(returnUrl);
    } catch {
      targetUrl = new URL(returnUrl, supabaseUrl.replace('.supabase.co', '.lovable.app'));
    }
  } else {
    targetUrl = new URL('/marketing', supabaseUrl.replace('.supabase.co', '.lovable.app'));
  }

  targetUrl.searchParams.set('oauth_error', error);
  targetUrl.searchParams.set('error_description', description);
  if (platform) targetUrl.searchParams.set('platform', platform);

  return new Response(null, {
    status: 302,
    headers: {
      'Location': targetUrl.toString(),
    },
  });
}
