import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Platform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter';

interface OAuthConfig {
  authUrl: string;
  scopes: string[];
  clientIdEnv: string;
  redirectPath: string;
}

// Platform OAuth configurations
const PLATFORM_CONFIGS: Record<Platform, OAuthConfig> = {
  instagram: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    // Note: we intentionally avoid requesting additional scopes by default.
    // Meta will reject scopes that are not enabled/approved for the app.
    // Once the app has the needed permissions approved, add them back here.
    scopes: [],
    clientIdEnv: 'META_APP_ID',
    redirectPath: '/functions/v1/social-oauth-callback',
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    // Note: we intentionally avoid requesting additional scopes by default.
    // Meta will reject scopes that are not enabled/approved for the app.
    // Once the app has the needed permissions approved, add them back here.
    scopes: [],
    clientIdEnv: 'META_APP_ID',
    redirectPath: '/functions/v1/social-oauth-callback',
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    scopes: [
      'r_liteprofile',
      'r_emailaddress',
      'w_member_social',
      'r_organization_social',
      'w_organization_social',
      'rw_organization_admin',
    ],
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    redirectPath: '/functions/v1/social-oauth-callback',
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    scopes: [
      'user.info.basic',
      'video.upload',
      'video.publish',
      'video.list',
    ],
    clientIdEnv: 'TIKTOK_CLIENT_KEY',
    redirectPath: '/functions/v1/social-oauth-callback',
  },
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
    ],
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    redirectPath: '/functions/v1/social-oauth-callback',
  },
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    scopes: [
      'tweet.read',
      'tweet.write',
      'users.read',
      'offline.access',
    ],
    clientIdEnv: 'TWITTER_CLIENT_ID',
    redirectPath: '/functions/v1/social-oauth-callback',
  },
};

// Generate PKCE code verifier and challenge
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // For simplicity, using plain challenge (S256 would require async crypto)
  const codeChallenge = codeVerifier;
  return { codeVerifier, codeChallenge };
}

// Generate cryptographically secure state
function generateState(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Validate JWT from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Use service role client to validate the JWT token
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Validate the token by getting the user - pass token directly
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired session. Please log in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for database operations
    const supabase = supabaseAdmin;

    const { platform, workspace_id, return_url } = await req.json();

    if (!platform || !workspace_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: platform, workspace_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Use authenticated user's ID
    const user_id = user.id;

    // ===========================================
    // ENTITLEMENTS CHECK - Server-side validation
    // ===========================================
    
    // Check social_publish entitlement
    const { data: publishEntitlement } = await supabase
      .from('workspace_entitlements_effective')
      .select('enabled, limit_value')
      .eq('workspace_id', workspace_id)
      .eq('entitlement_key', 'social_publish')
      .maybeSingle();

    if (!publishEntitlement?.enabled) {
      console.log(`OAuth blocked for workspace ${workspace_id}: social_publish not enabled`);
      
      // Log blocked attempt
      await supabase.from('domain_events').insert({
        workspace_id,
        event_type: 'social_oauth.blocked',
        entity_type: 'social_platform',
        entity_id: workspace_id,
        payload: {
          platform,
          reason: 'PLAN_REQUIRED',
          message: 'Entitlement social_publish not enabled',
        },
        actor_id: user_id,
      });

      return new Response(
        JSON.stringify({ 
          error: 'PLAN_REQUIRED',
          error_code: 'PLAN_REQUIRED',
          message: 'Conectar redes sociais requer um plano PRO ou superior.',
          requires_upgrade: true,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check platform limit
    const { data: limitEntitlement } = await supabase
      .from('workspace_entitlements_effective')
      .select('enabled, limit_value')
      .eq('workspace_id', workspace_id)
      .eq('entitlement_key', 'social_platforms_limit')
      .maybeSingle();

    if (limitEntitlement?.enabled && limitEntitlement.limit_value) {
      const { count } = await supabase
        .from('social_platforms')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspace_id)
        .eq('is_active', true);

      if (count !== null && count >= limitEntitlement.limit_value) {
        console.log(`OAuth blocked for workspace ${workspace_id}: limit reached (${count}/${limitEntitlement.limit_value})`);
        
        await supabase.from('domain_events').insert({
          workspace_id,
          event_type: 'social_oauth.blocked',
          entity_type: 'social_platform',
          entity_id: workspace_id,
          payload: {
            platform,
            reason: 'LIMIT_REACHED',
            current_count: count,
            limit: limitEntitlement.limit_value,
          },
          actor_id: user_id,
        });

        return new Response(
          JSON.stringify({ 
            error: 'LIMIT_REACHED',
            error_code: 'LIMIT_REACHED',
            message: `Você atingiu o limite de ${limitEntitlement.limit_value} plataformas do seu plano.`,
            requires_upgrade: true,
            limit: limitEntitlement.limit_value,
            current: count,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ===========================================
    // PROVIDER CONFIG CHECK
    // ===========================================

    const config = PLATFORM_CONFIGS[platform as Platform];
    if (!config) {
      return new Response(
        JSON.stringify({ error: `Unsupported platform: ${platform}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if client credentials are configured
    const clientId = Deno.env.get(config.clientIdEnv);
    if (!clientId) {
      console.log(`OAuth blocked for ${platform}: ${config.clientIdEnv} not configured`);
      
      // Log configuration missing event
      await supabase.from('domain_events').insert({
        workspace_id,
        event_type: 'social_oauth.blocked',
        entity_type: 'social_platform',
        entity_id: workspace_id,
        payload: {
          platform,
          reason: 'PROVIDER_NOT_CONFIGURED',
          missing_secret: config.clientIdEnv,
        },
        actor_id: user_id,
      });

      return new Response(
        JSON.stringify({ 
          error: 'PROVIDER_NOT_CONFIGURED',
          error_code: 'SECRETS_NOT_CONFIGURED',
          message: `Esta integração está em configuração pelo administrador do sistema.`,
          requires_setup: true,
          setup_instructions: getSetupInstructions(platform as Platform),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate state and PKCE
    const state = generateState();
    const { codeVerifier, codeChallenge } = generatePKCE();

    // Store OAuth state in database for verification
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min expiry
    
    const { error: stateError } = await supabase
      .from('oauth_states')
      .upsert({
        state,
        platform,
        workspace_id,
        user_id,
        code_verifier: codeVerifier,
        return_url: return_url || null,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      });

    if (stateError) {
      console.error('Error storing OAuth state:', stateError);
      return new Response(
        JSON.stringify({ error: "Failed to initiate OAuth flow" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build authorization URL
    const redirectUri = `${supabaseUrl}${config.redirectPath}`;
    const params = new URLSearchParams();
    
    params.set('client_id', clientId);
    params.set('redirect_uri', redirectUri);
    params.set('state', state);
    params.set('response_type', 'code');

    // Platform-specific parameters
    if (platform === 'twitter') {
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', 'plain');
      params.set('scope', config.scopes.join(' '));
    } else if (platform === 'linkedin') {
      params.set('scope', config.scopes.join(' '));
    } else if (platform === 'tiktok') {
      params.set('scope', config.scopes.join(','));
      params.set('client_key', clientId);
    } else if (platform === 'youtube') {
      params.set('scope', config.scopes.join(' '));
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
    } else {
      // Meta (Facebook/Instagram)
      // Only include scope if we have any to request.
      if (config.scopes.length > 0) {
        params.set('scope', config.scopes.join(','));
      }
    }

    const authUrl = `${config.authUrl}?${params.toString()}`;

    // Log OAuth start event
    await supabase.from('domain_events').insert({
      workspace_id,
      event_type: 'social_oauth.started',
      entity_type: 'social_platform',
      entity_id: state,
      payload: {
        platform,
        user_id,
        scopes: config.scopes,
      },
      actor_id: user_id,
    });

    console.log(`OAuth started for ${platform} in workspace ${workspace_id}`);

    return new Response(
      JSON.stringify({
        auth_url: authUrl,
        state,
        expires_at: expiresAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('OAuth start error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getSetupInstructions(platform: Platform): string[] {
  const instructions: Record<Platform, string[]> = {
    instagram: [
      '1. Acesse developers.facebook.com e crie um app',
      '2. Adicione o produto "Instagram Basic Display" ou "Instagram Graph API"',
      '3. Configure a URI de redirecionamento OAuth',
      '4. Copie o App ID e App Secret',
      '5. Adicione META_APP_ID e META_APP_SECRET nos secrets do projeto',
    ],
    facebook: [
      '1. Acesse developers.facebook.com e crie um app',
      '2. Adicione o produto "Facebook Login"',
      '3. Configure as permissões de páginas',
      '4. Copie o App ID e App Secret',
      '5. Adicione META_APP_ID e META_APP_SECRET nos secrets do projeto',
    ],
    linkedin: [
      '1. Acesse linkedin.com/developers e crie um app',
      '2. Solicite acesso à Marketing API',
      '3. Configure a URI de redirecionamento OAuth',
      '4. Copie o Client ID e Client Secret',
      '5. Adicione LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET nos secrets',
    ],
    tiktok: [
      '1. Acesse developers.tiktok.com e crie um app',
      '2. Solicite permissões de publicação',
      '3. Configure a URI de redirecionamento',
      '4. Copie o Client Key e Client Secret',
      '5. Adicione TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET nos secrets',
    ],
    youtube: [
      '1. Acesse console.cloud.google.com',
      '2. Crie um projeto e ative a YouTube Data API v3',
      '3. Configure a tela de consentimento OAuth',
      '4. Crie credenciais OAuth 2.0',
      '5. Adicione GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nos secrets',
    ],
    twitter: [
      '1. Acesse developer.twitter.com e crie um projeto',
      '2. Configure OAuth 2.0 com PKCE',
      '3. Solicite permissões de escrita',
      '4. Copie o Client ID e Client Secret',
      '5. Adicione TWITTER_CLIENT_ID e TWITTER_CLIENT_SECRET nos secrets',
    ],
  };
  return instructions[platform];
}
