import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Platform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter';

// Graph API version - MUST match your Meta App settings
const GRAPH_VERSION = '24.0';

interface OAuthConfig {
  authUrl: string;
  scopes: string[];
  clientIdEnv: string;
  redirectPath: string;
}

/**
 * META SCOPES - Enterprise Grade Configuration (2024/2025)
 * 
 * CRITICAL: Only request scopes that are APPROVED in your Meta App Review.
 * 
 * The error "Invalid Scopes" means the scopes are NOT enabled in your Meta App's
 * Use Cases or haven't passed App Review yet.
 * 
 * SCOPE TIERS:
 * 
 * TIER 1 - Development Mode (no App Review needed):
 * - public_profile (always available)
 * - email (always available)
 * 
 * TIER 2 - Requires Use Case enablement + App Review:
 * - pages_show_list          - List Pages the user is admin of
 * - pages_read_engagement    - Read Page posts, comments, likes
 * - pages_manage_posts       - Create and manage Page posts
 * - instagram_basic          - Basic Instagram account info
 * - instagram_manage_insights- Instagram analytics
 * - instagram_content_publish- Publish to Instagram
 * 
 * DEPRECATED/LEGACY (NEVER USE):
 * - manage_pages (causes Invalid Scope - was replaced in 2020)
 * 
 * STRATEGY:
 * - We use a tiered approach: start with minimal scopes, fallback if needed
 * - If App Review is complete, use full scopes
 * - If in development, use only public_profile to at least authenticate
 */

/**
 * META SCOPES BY CAPABILITY
 * 
 * Based on official Meta documentation:
 * - pages_show_list: List Pages user is admin of
 * - pages_read_engagement: Read Page posts, comments, reactions
 * - pages_manage_posts: Create/edit/delete Page posts
 * - read_insights: Access Page insights (requires pages_read_engagement + pages_show_list)
 * - instagram_basic: Basic IG Business info
 * - instagram_content_publish: Post to IG
 * - instagram_manage_insights: IG analytics
 * 
 * CRITICAL: These scopes require:
 * 1. Use Case enabled in Meta App Dashboard
 * 2. App Review approval (except for test users in dev mode)
 */

// CAPABILITY-BASED SCOPE SETS
const META_CAPABILITY_SCOPES = {
  // List Pages only
  META_PAGES_LIST: ['pages_show_list'],
  
  // List + Read Pages
  META_PAGES_READ: ['pages_show_list', 'pages_read_engagement'],
  
  // Full Page management (publish)
  META_PAGES_PUBLISH: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
  
  // Page insights
  META_PAGES_INSIGHTS: ['pages_show_list', 'pages_read_engagement', 'read_insights'],
  
  // Instagram basic access
  META_IG_BASIC: ['pages_show_list', 'pages_read_engagement', 'instagram_basic'],
  
  // Instagram publishing
  META_IG_PUBLISH: ['pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish'],
  
  // Instagram insights
  META_IG_INSIGHTS: ['pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_manage_insights'],
};

/**
 * META SCOPES - FALLBACK STRATEGY (2025)
 * 
 * IMPORTANT: We now use AUTOMATIC FALLBACK approach:
 * - First connection: ONLY request public_profile (always works, no App Review needed)
 * - This ensures the OAuth ALWAYS succeeds
 * - When user tries to list pages or publish, we check if we have the needed scopes
 * - If not, we trigger a re-auth with the additional scopes
 * 
 * This avoids "Invalid Scopes" errors for apps that haven't completed App Review.
 */

// Initial connect - MUST include all scopes needed for both Facebook AND Instagram publishing
// CRITICAL: Without pages_show_list, social-connection-assets will return empty
// business_management is REQUIRED for Business Login to avoid "supported permission" error
// Instagram scopes are REQUIRED to publish to Instagram Business accounts
const META_SCOPES_CONNECT = [
  'public_profile',
  'email',
  'business_management',
  'pages_show_list',              // REQUIRED to list pages after OAuth
  'pages_read_engagement',        // REQUIRED to get page details/insights
  'pages_manage_posts',           // REQUIRED to publish to Facebook Pages
  'instagram_basic',              // REQUIRED to access Instagram Business accounts
  'instagram_content_publish',    // REQUIRED to publish to Instagram
];

// Scopes needed for listing pages
const META_SCOPES_PAGES_LIST = [
  'public_profile',
  'pages_show_list',
];

// Scopes needed for managing/publishing to pages  
const META_SCOPES_PAGES_PUBLISH = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement', 
  'pages_manage_posts',
];

// Full production scopes (all capabilities) - for apps with App Review complete
const META_SCOPES_FULL = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement', 
  'pages_manage_posts',
  'instagram_basic',
  'instagram_manage_insights',
  'instagram_content_publish',
];

// Minimal scopes for development/testing
// Keep aligned with CONNECT to avoid Business Login "supported permission" block.
// MUST include pages_show_list to list pages after OAuth completes
const META_SCOPES_MINIMAL = [
  'public_profile',
  'email',
  'business_management',
  'pages_show_list',          // REQUIRED to list pages
  'pages_read_engagement',    // REQUIRED to get page details
  'pages_manage_posts',       // REQUIRED to publish
];

// Facebook-only (no Instagram)
const META_SCOPES_FACEBOOK_ONLY = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
];

// Instagram-focused via Facebook Login
const META_SCOPES_INSTAGRAM = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
];

// Legacy/deprecated scopes - NEVER USE
const META_SCOPES_DEPRECATED = ['manage_pages', 'publish_pages'];

// Platform OAuth configurations
// CRITICAL: All Meta platforms MUST use facebook.com/dialog/oauth (NOT instagram.com)
const PLATFORM_CONFIGS: Record<Platform, OAuthConfig> = {
  instagram: {
    // CRITICAL: Instagram Business MUST use Facebook Login endpoint
    // Using instagram.com/oauth/authorize will cause "Invalid Scopes" for pages_* scopes
    authUrl: `https://www.facebook.com/v${GRAPH_VERSION}/dialog/oauth`,
    scopes: META_SCOPES_INSTAGRAM,
    clientIdEnv: 'META_APP_ID',
    redirectPath: '/functions/v1/social-oauth-callback',
  },
  facebook: {
    // Facebook Pages - uses same Facebook Login endpoint
    authUrl: `https://www.facebook.com/v${GRAPH_VERSION}/dialog/oauth`,
    scopes: META_SCOPES_FACEBOOK_ONLY,
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

// Generate PKCE code verifier and challenge (S256)
async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // S256 challenge
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

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

    const { platform, workspace_id, return_url, scope_strategy } = await req.json();

    if (!platform || !workspace_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: platform, workspace_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve return URL (MUST be absolute for Meta callback redirects)
    const originHeader = req.headers.get('origin') || req.headers.get('referer');
    let resolvedReturnUrl: string | null = null;
    if (typeof return_url === 'string' && return_url.length > 0) {
      try {
        resolvedReturnUrl = new URL(return_url).toString();
      } catch {
        if (originHeader) {
          try {
            const origin = new URL(originHeader).origin;
            resolvedReturnUrl = new URL(return_url.startsWith('/') ? return_url : `/${return_url}`, origin).toString();
          } catch {
            resolvedReturnUrl = null;
          }
        }
      }
    } else if (originHeader) {
      try {
        resolvedReturnUrl = new URL('/marketing', new URL(originHeader).origin).toString();
      } catch {
        resolvedReturnUrl = null;
      }
    }

    // Use authenticated user's ID
    const user_id = user.id;

    /**
     * Scope Strategy:
     * - 'full' (default): Use all production scopes - requires completed App Review
     * - 'minimal': Use only public_profile - works in development mode
     * - 'pages_only': Use pages scopes without Instagram - for Facebook-only connections
     */
    const effectiveScopeStrategy = scope_strategy || 'full';

    // ===========================================
    // ROLE CHECK - Only Owner, Admin, Coordinator can connect
    // ===========================================
    
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user_id)
      .maybeSingle();

    const allowedRoles = ['super_admin', 'owner', 'admin', 'coordinator'];
    if (!userRole || !allowedRoles.includes(userRole.role)) {
      console.log(`OAuth blocked for user ${user_id}: insufficient role (${userRole?.role || 'none'})`);
      
      await supabase.from('domain_events').insert({
        workspace_id,
        aggregate_type: 'social_media',
        aggregate_id: workspace_id,
        event_type: 'social_oauth.blocked',
        payload: {
          platform,
          reason: 'INSUFFICIENT_ROLE',
          user_role: userRole?.role || null,
          required_roles: allowedRoles,
          actor_id: user_id,
        },
      });

      return new Response(
        JSON.stringify({ 
          error: 'FORBIDDEN',
          error_code: 'INSUFFICIENT_ROLE',
          message: 'Apenas Owner, Admin ou Coordenador podem conectar plataformas.',
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
        aggregate_type: 'social_media',
        aggregate_id: workspace_id,
        event_type: 'social_oauth.blocked',
        payload: {
          platform,
          reason: 'PLAN_REQUIRED',
          message: 'Entitlement social_publish not enabled',
          actor_id: user_id,
        },
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
          aggregate_type: 'social_media',
          aggregate_id: workspace_id,
          event_type: 'social_oauth.blocked',
          payload: {
            platform,
            reason: 'LIMIT_REACHED',
            current_count: count,
            limit: limitEntitlement.limit_value,
            actor_id: user_id,
          },
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
        aggregate_type: 'social_media',
        aggregate_id: workspace_id,
        event_type: 'social_oauth.blocked',
        payload: {
          platform,
          reason: 'PROVIDER_NOT_CONFIGURED',
          missing_secret: config.clientIdEnv,
          actor_id: user_id,
        },
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

    // ===========================================
    // VALIDATE SCOPES (Meta hard-fail on legacy)
    // ===========================================
    const isMetaProvider = platform === 'facebook' || platform === 'instagram';
    
    if (isMetaProvider) {
      // Check if any legacy/deprecated scopes are accidentally configured
      const hasDeprecatedScopes = config.scopes.some(s => META_SCOPES_DEPRECATED.includes(s));
      if (hasDeprecatedScopes) {
        console.error(`CONFIG_INVALID_SCOPES: deprecated scopes found in config for ${platform}`);
        
        await supabase.from('domain_events').insert({
          workspace_id,
          aggregate_type: 'social_media',
          aggregate_id: workspace_id,
          event_type: 'social_oauth.blocked',
          payload: {
            platform,
            reason: 'CONFIG_INVALID_SCOPES',
            deprecated_scopes_found: META_SCOPES_DEPRECATED.filter(s => config.scopes.includes(s)),
            actor_id: user_id,
          },
        });

        return new Response(
          JSON.stringify({ 
            error: 'CONFIG_INVALID_SCOPES',
            error_code: 'CONFIG_INVALID_SCOPES',
            message: 'Configuração inválida: escopos legados detectados (manage_pages). Contate o suporte.',
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate state and PKCE
    const state = generateState();
    const { codeVerifier, codeChallenge } = await generatePKCE();

    // Store OAuth state in database for verification
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min expiry

    /**
     * AUTOMATIC FALLBACK STRATEGY for Meta:
     * 
     * 'connect' (NEW DEFAULT): Only public_profile - ALWAYS works, no App Review needed
     * 'pages_list': public_profile + pages_show_list - for listing pages
     * 'pages_publish': public_profile + pages_show_list + pages_read_engagement + pages_manage_posts
     * 'full': All scopes including Instagram - requires App Review
     * 'minimal': Same as connect (backwards compat)
     * 'pages_only': Same as pages_publish (backwards compat)
     */
    let scopesToUse: string[];
    
    if (isMetaProvider) {
      switch (effectiveScopeStrategy) {
        case 'connect':
        case 'minimal':
          // Initial connection - ONLY public_profile (always works)
          scopesToUse = [...META_SCOPES_CONNECT];
          console.log(`Using CONNECT (minimal) scopes for ${platform}: ${scopesToUse.join(',')}`);
          break;
        case 'pages_list':
          // Need to list pages
          scopesToUse = [...META_SCOPES_PAGES_LIST];
          console.log(`Using PAGES_LIST scopes for ${platform}: ${scopesToUse.join(',')}`);
          break;
        case 'pages_publish':
        case 'pages_only':
          // Need to manage/publish to pages
          scopesToUse = [...META_SCOPES_PAGES_PUBLISH];
          console.log(`Using PAGES_PUBLISH scopes for ${platform}: ${scopesToUse.join(',')}`);
          break;
        case 'full':
          // Full production scopes - requires App Review
          scopesToUse = [...META_SCOPES_FULL];
          console.log(`Using FULL scopes for ${platform}: ${scopesToUse.join(',')}`);
          break;
        default:
          // DEFAULT: Use minimal connect scopes to avoid Invalid Scopes errors
          scopesToUse = [...META_SCOPES_CONNECT];
          console.log(`Using DEFAULT (connect) scopes for ${platform}: ${scopesToUse.join(',')}`);
          break;
      }
    } else {
      scopesToUse = [...config.scopes];
    }
    
    const { error: stateError } = await supabase
      .from('oauth_states')
      .upsert({
        state,
        platform,
        workspace_id,
        user_id,
        code_verifier: codeVerifier,
        return_url: resolvedReturnUrl,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        // Store requested scopes for validation in callback
        scopes: scopesToUse,
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
      params.set('code_challenge_method', 'S256');
      params.set('scope', scopesToUse.join(' '));
    } else if (platform === 'linkedin') {
      params.set('scope', scopesToUse.join(' '));
    } else if (platform === 'tiktok') {
      params.set('scope', scopesToUse.join(','));
      params.set('client_key', clientId);
    } else if (platform === 'youtube') {
      params.set('scope', scopesToUse.join(' '));
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
    } else if (isMetaProvider) {
      // Meta (Facebook/Instagram) - comma-separated scopes, URL-encoded
      if (scopesToUse.length > 0) {
        params.set('scope', scopesToUse.join(','));
      }
      // PKCE is optional for Meta but recommended
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', 'S256');
      
      // Add auth_type=rerequest to force permission dialog
      // This is critical for re-auth flows when user didn't grant all scopes
      params.set('auth_type', 'rerequest');
    }

    const authUrl = `${config.authUrl}?${params.toString()}`;

    // Log OAuth start event with scopes info
    await supabase.from('domain_events').insert({
      workspace_id,
      aggregate_type: 'social_media',
      aggregate_id: workspace_id,
      event_type: 'social_oauth.started',
      payload: {
        platform,
        provider: isMetaProvider ? 'meta' : platform,
        user_id,
        state,
        auth_endpoint: config.authUrl,
        redirect_uri: redirectUri,
        graph_version: isMetaProvider ? GRAPH_VERSION : null,
        scopes_requested: scopesToUse,
        scopes_count: scopesToUse.length,
        scope_strategy: effectiveScopeStrategy,
        auth_url: authUrl,
      },
    });

    console.log(`OAuth started for ${platform} in workspace ${workspace_id} with strategy=${effectiveScopeStrategy}, scopes: ${scopesToUse.join(', ')}`);

    return new Response(
      JSON.stringify({
        auth_url: authUrl,
        state,
        expires_at: expiresAt,
        scopes_requested: scopesToUse,
        scope_strategy: effectiveScopeStrategy,
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
      '1. Acesse developers.facebook.com e crie um app do tipo "Business"',
      '2. Adicione os produtos: "Facebook Login for Business" e "Instagram Graph API"',
      '3. Em Casos de Uso, adicione: pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_manage_insights, instagram_content_publish',
      '4. Configure a URI de redirecionamento OAuth válida',
      '5. Copie o App ID e App Secret',
      '6. Adicione META_APP_ID e META_APP_SECRET nos secrets do projeto',
      '7. Para produção: complete o App Review para cada permissão',
    ],
    facebook: [
      '1. Acesse developers.facebook.com e crie um app do tipo "Business"',
      '2. Adicione o produto "Facebook Login for Business"',
      '3. Em Casos de Uso, adicione: pages_show_list, pages_read_engagement, pages_manage_posts',
      '4. Configure a URI de redirecionamento OAuth válida',
      '5. Copie o App ID e App Secret',
      '6. Adicione META_APP_ID e META_APP_SECRET nos secrets do projeto',
      '7. Para produção: complete o App Review para cada permissão',
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
