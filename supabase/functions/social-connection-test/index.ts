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
  permissions?: string[];
  error_code?: string;
  error_message?: string;
  requires_reconnect?: boolean;
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

async function testPlatformConnection(
  platform: Platform,
  accessToken: string
): Promise<TestResult> {
  try {
    let response: Response;
    let data: any;

    switch (platform) {
      case 'instagram':
      case 'facebook':
        // Test with a simple /me call
        response = await fetch(
          `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${accessToken}`
        );
        
        if (!response.ok) {
          const error = await response.json();
          return {
            success: false,
            platform,
            error_code: error.error?.code?.toString() || 'API_ERROR',
            error_message: error.error?.message || 'Failed to verify token',
            requires_reconnect: error.error?.code === 190, // Token expired
          };
        }
        
        data = await response.json();
        
        // Check permissions
        const permResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/permissions?access_token=${accessToken}`
        );
        const permData = await permResponse.json();
        const grantedPermissions = (permData.data || [])
          .filter((p: any) => p.status === 'granted')
          .map((p: any) => p.permission);
        
        return {
          success: true,
          platform,
          account_id: data.id,
          account_name: data.name,
          permissions: grantedPermissions,
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
            requires_reconnect: response.status === 401,
          };
        }
        
        data = await response.json();
        return {
          success: true,
          platform,
          account_id: data.id,
          account_name: `${data.localizedFirstName} ${data.localizedLastName}`,
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
            requires_reconnect: true,
          };
        }
        
        data = await response.json();
        return {
          success: true,
          platform,
          account_id: data.data?.user?.open_id,
          account_name: data.data?.user?.display_name,
        };

      case 'youtube':
        response = await fetch(
          'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        if (!response.ok) {
          const error = await response.json();
          return {
            success: false,
            platform,
            error_code: error.error?.code?.toString() || 'API_ERROR',
            error_message: error.error?.message || 'Failed to verify YouTube token',
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
            error_message: 'No YouTube channel found for this account',
            requires_reconnect: false,
          };
        }
        
        return {
          success: true,
          platform,
          account_id: channel.id,
          account_name: channel.snippet?.title,
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
            requires_reconnect: response.status === 401,
          };
        }
        
        data = await response.json();
        return {
          success: true,
          platform,
          account_id: data.data?.id,
          account_name: `@${data.data?.username}`,
        };

      default:
        return {
          success: false,
          platform,
          error_code: 'UNSUPPORTED',
          error_message: `Platform ${platform} is not supported`,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      platform,
      error_code: 'NETWORK_ERROR',
      error_message: errorMessage,
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

    const { platform_id } = await req.json();

    if (!platform_id) {
      return new Response(
        JSON.stringify({ error: "Missing platform_id" }),
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
        JSON.stringify({ error: "Platform connection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!platformData.access_token_encrypted) {
      return new Response(
        JSON.stringify({
          success: false,
          error_code: 'NO_TOKEN',
          error_message: 'No access token stored for this connection',
          requires_reconnect: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt token
    const accessToken = decryptToken(platformData.access_token_encrypted);

    // Test the connection
    const result = await testPlatformConnection(
      platformData.platform as Platform,
      accessToken
    );

    // Update platform status based on result
    const updateData: Record<string, any> = {
      last_sync_at: new Date().toISOString(),
    };

    if (result.success) {
      updateData.connection_status = 'connected';
      updateData.last_error = null;
    } else {
      updateData.connection_status = result.requires_reconnect ? 'expired' : 'error';
      updateData.last_error = result.error_message;
    }

    await supabase
      .from('social_platforms')
      .update(updateData)
      .eq('id', platform_id);

    // Log test event
    await supabase.from('domain_events').insert({
      workspace_id: platformData.workspace_id,
      event_type: result.success ? 'social_connection.test_passed' : 'social_connection.test_failed',
      entity_type: 'social_platform',
      entity_id: platform_id,
      payload: result,
    });

    console.log(`Connection test for ${platformData.platform}: ${result.success ? 'PASSED' : 'FAILED'}`);

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
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
