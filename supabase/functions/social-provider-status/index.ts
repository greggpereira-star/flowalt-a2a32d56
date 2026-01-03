import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Platform = 'meta' | 'google' | 'linkedin' | 'tiktok' | 'twitter';

interface ProviderConfig {
  clientIdEnv: string;
  clientSecretEnv: string;
  displayName: string;
  portalUrl: string;
  redirectPath: string;
}

interface ProviderStatus {
  status: 'not_configured' | 'partial' | 'ready';
  missing: string[];
  configured: string[];
  redirect_uri: string;
  displayName: string;
  portalUrl: string;
  activeConnections: number;
}

// Provider configurations
const PROVIDER_CONFIGS: Record<Platform, ProviderConfig> = {
  meta: {
    clientIdEnv: 'META_APP_ID',
    clientSecretEnv: 'META_APP_SECRET',
    displayName: 'Meta (Facebook/Instagram)',
    portalUrl: 'https://developers.facebook.com/apps',
    redirectPath: '/functions/v1/social-oauth-callback',
  },
  google: {
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    displayName: 'Google (YouTube)',
    portalUrl: 'https://console.cloud.google.com/apis/credentials',
    redirectPath: '/functions/v1/social-oauth-callback',
  },
  linkedin: {
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
    displayName: 'LinkedIn',
    portalUrl: 'https://www.linkedin.com/developers/apps',
    redirectPath: '/functions/v1/social-oauth-callback',
  },
  tiktok: {
    clientIdEnv: 'TIKTOK_CLIENT_KEY',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
    displayName: 'TikTok',
    portalUrl: 'https://developers.tiktok.com/apps',
    redirectPath: '/functions/v1/social-oauth-callback',
  },
  twitter: {
    clientIdEnv: 'TWITTER_CLIENT_ID',
    clientSecretEnv: 'TWITTER_CLIENT_SECRET',
    displayName: 'X (Twitter)',
    portalUrl: 'https://developer.twitter.com/en/portal/dashboard',
    redirectPath: '/functions/v1/social-oauth-callback',
  },
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
        JSON.stringify({ error: 'UNAUTHORIZED', message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED', message: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is super admin
    const { data: superAdmin } = await supabase
      .from('platform_super_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!superAdmin) {
      return new Response(
        JSON.stringify({ error: 'FORBIDDEN', message: 'Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check encryption key
    const encryptionKeyConfigured = !!Deno.env.get('TOKEN_ENCRYPTION_KEY');

    // Check each provider
    const providers: Record<Platform, ProviderStatus> = {} as Record<Platform, ProviderStatus>;
    
    for (const [platform, config] of Object.entries(PROVIDER_CONFIGS)) {
      const clientId = Deno.env.get(config.clientIdEnv);
      const clientSecret = Deno.env.get(config.clientSecretEnv);
      
      const missing: string[] = [];
      const configured: string[] = [];
      
      if (!clientId) {
        missing.push(config.clientIdEnv);
      } else {
        configured.push(config.clientIdEnv);
      }
      
      if (!clientSecret) {
        missing.push(config.clientSecretEnv);
      } else {
        configured.push(config.clientSecretEnv);
      }

      let status: 'not_configured' | 'partial' | 'ready';
      if (missing.length === 2) {
        status = 'not_configured';
      } else if (missing.length === 1) {
        status = 'partial';
      } else {
        status = 'ready';
      }

      // Count active connections for this platform
      // Map platform keys to database values
      const dbPlatforms = platform === 'meta' ? ['facebook', 'instagram'] : [platform];
      
      const { count } = await supabase
        .from('social_platforms')
        .select('*', { count: 'exact', head: true })
        .in('platform', dbPlatforms)
        .eq('is_active', true);

      providers[platform as Platform] = {
        status,
        missing,
        configured,
        redirect_uri: `${supabaseUrl}${config.redirectPath}`,
        displayName: config.displayName,
        portalUrl: config.portalUrl,
        activeConnections: count || 0,
      };
    }

    // Count total summary
    const readyCount = Object.values(providers).filter(p => p.status === 'ready').length;
    const partialCount = Object.values(providers).filter(p => p.status === 'partial').length;
    const notConfiguredCount = Object.values(providers).filter(p => p.status === 'not_configured').length;

    console.log(`Provider status check: ${readyCount} ready, ${partialCount} partial, ${notConfiguredCount} not configured`);

    // Log event
    await supabase.from('domain_events').insert({
      event_type: 'social.provider.status_checked',
      entity_type: 'system',
      entity_id: 'provider-status',
      payload: {
        checked_by: user.id,
        encryption_configured: encryptionKeyConfigured,
        summary: { ready: readyCount, partial: partialCount, not_configured: notConfiguredCount },
      },
      actor_id: user.id,
    });

    return new Response(
      JSON.stringify({
        providers,
        encryption_configured: encryptionKeyConfigured,
        summary: {
          ready: readyCount,
          partial: partialCount,
          not_configured: notConfiguredCount,
          total: Object.keys(providers).length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Provider status check error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'SERVER_ERROR', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
