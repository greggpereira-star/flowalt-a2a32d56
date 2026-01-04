import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta Preflight Edge Function
 * 
 * This function checks the Meta OAuth configuration before attempting OAuth.
 * It determines:
 * - If provider credentials are configured (META_APP_ID, META_APP_SECRET)
 * - What scopes are recommended based on requested capabilities
 * - If TOKEN_ENCRYPTION_KEY is configured
 * 
 * This allows the frontend to show appropriate GOX messages before
 * redirecting to OAuth (which would fail with Invalid Scopes if misconfigured).
 */

const GRAPH_VERSION = '24.0';

/**
 * Scope capability groups
 * 
 * IMPORTANT: Meta requires permissions to be approved in App Review before they work.
 * Development mode only allows: public_profile, email
 * 
 * For production, you need to complete App Review for each permission group.
 */
const SCOPE_CAPABILITIES = {
  // Minimum scopes - always work in development mode
  base: ['public_profile'],
  
  // Page management - requires App Review for "pages_show_list" use case
  pages_list: ['pages_show_list'],
  
  // Page engagement/insights - requires App Review
  pages_insights: ['pages_read_engagement'],
  
  // Page publishing - requires App Review
  pages_publish: ['pages_manage_posts'],
  
  // Instagram basic - requires App Review and IG Business account linked
  instagram_basic: ['instagram_basic'],
  
  // Instagram insights - requires App Review
  instagram_insights: ['instagram_manage_insights'],
  
  // Instagram publishing - requires App Review
  instagram_publish: ['instagram_content_publish'],
};

type Capability = 'pages' | 'pages_publish' | 'pages_insights' | 'instagram' | 'instagram_publish' | 'instagram_insights';

interface PreflightRequest {
  workspace_id: string;
  capabilities?: Capability[];
  platform?: 'facebook' | 'instagram';
}

interface PreflightResponse {
  provider_configured: boolean;
  encryption_configured: boolean;
  recommended_scopes: string[];
  all_scopes: string[];
  detected_issue: null | {
    code: string;
    message: string;
    action_for_admin: string;
    action_for_client: string;
  };
  // Diagnostic info for super admin
  diagnostic?: {
    has_app_id: boolean;
    has_app_secret: boolean;
    has_encryption_key: boolean;
    graph_version: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate JWT from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body: PreflightRequest = await req.json();
    const { workspace_id, capabilities = [], platform = 'facebook' } = body;

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user has role in workspace
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Access denied to workspace" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isSuperAdmin = roleData.role === 'owner' || roleData.role === 'admin';

    // Check provider configuration
    const appId = Deno.env.get('META_APP_ID');
    const appSecret = Deno.env.get('META_APP_SECRET');
    const encryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY');

    const hasAppId = !!appId && appId.length > 0;
    const hasAppSecret = !!appSecret && appSecret.length > 0;
    const hasEncryptionKey = !!encryptionKey && encryptionKey.length > 0;

    const providerConfigured = hasAppId && hasAppSecret;
    const encryptionConfigured = hasEncryptionKey;

    // Build recommended scopes based on capabilities
    const recommendedScopes = new Set<string>(SCOPE_CAPABILITIES.base);

    // Default capabilities based on platform
    const effectiveCapabilities = capabilities.length > 0 ? capabilities : 
      platform === 'instagram' 
        ? ['pages', 'instagram', 'instagram_publish', 'instagram_insights'] 
        : ['pages', 'pages_publish', 'pages_insights'];

    for (const cap of effectiveCapabilities) {
      switch (cap) {
        case 'pages':
          SCOPE_CAPABILITIES.pages_list.forEach(s => recommendedScopes.add(s));
          break;
        case 'pages_publish':
          SCOPE_CAPABILITIES.pages_publish.forEach(s => recommendedScopes.add(s));
          break;
        case 'pages_insights':
          SCOPE_CAPABILITIES.pages_insights.forEach(s => recommendedScopes.add(s));
          break;
        case 'instagram':
          SCOPE_CAPABILITIES.pages_list.forEach(s => recommendedScopes.add(s)); // Need pages to get IG
          SCOPE_CAPABILITIES.instagram_basic.forEach(s => recommendedScopes.add(s));
          break;
        case 'instagram_publish':
          SCOPE_CAPABILITIES.instagram_publish.forEach(s => recommendedScopes.add(s));
          break;
        case 'instagram_insights':
          SCOPE_CAPABILITIES.instagram_insights.forEach(s => recommendedScopes.add(s));
          break;
      }
    }

    // Build all possible scopes for diagnostics
    const allScopes = [
      ...SCOPE_CAPABILITIES.base,
      ...SCOPE_CAPABILITIES.pages_list,
      ...SCOPE_CAPABILITIES.pages_insights,
      ...SCOPE_CAPABILITIES.pages_publish,
      ...SCOPE_CAPABILITIES.instagram_basic,
      ...SCOPE_CAPABILITIES.instagram_insights,
      ...SCOPE_CAPABILITIES.instagram_publish,
    ];

    // Determine any issues
    let detectedIssue: PreflightResponse['detected_issue'] = null;

    if (!providerConfigured) {
      detectedIssue = {
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'As credenciais OAuth do Meta (META_APP_ID e/ou META_APP_SECRET) não estão configuradas.',
        action_for_admin: 'Acesse Meta for Developers, crie um App e adicione as credenciais nos Secrets do projeto.',
        action_for_client: 'A integração está sendo configurada. Contate o administrador.',
      };
    } else if (!encryptionConfigured) {
      detectedIssue = {
        code: 'ENCRYPTION_NOT_CONFIGURED',
        message: 'A chave de criptografia de tokens (TOKEN_ENCRYPTION_KEY) não está configurada.',
        action_for_admin: 'Adicione TOKEN_ENCRYPTION_KEY nos Secrets do projeto.',
        action_for_client: 'A integração está sendo configurada. Contate o administrador.',
      };
    }

    // Log preflight event
    await supabase.from('domain_events').insert({
      workspace_id,
      event_type: 'social_meta.preflight',
      entity_type: 'social_platform',
      entity_id: workspace_id,
      payload: {
        platform,
        provider_configured: providerConfigured,
        encryption_configured: encryptionConfigured,
        recommended_scopes: Array.from(recommendedScopes),
        capabilities: effectiveCapabilities,
        issue_code: detectedIssue?.code || null,
      },
      actor_id: user.id,
    });

    const response: PreflightResponse = {
      provider_configured: providerConfigured,
      encryption_configured: encryptionConfigured,
      recommended_scopes: Array.from(recommendedScopes),
      all_scopes: [...new Set(allScopes)],
      detected_issue: detectedIssue,
    };

    // Add diagnostic info for admins
    if (isSuperAdmin) {
      response.diagnostic = {
        has_app_id: hasAppId,
        has_app_secret: hasAppSecret,
        has_encryption_key: hasEncryptionKey,
        graph_version: GRAPH_VERSION,
      };
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Preflight error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
