import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Platform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter';

interface Asset {
  asset_type: string;
  asset_id: string;
  asset_name: string;
  asset_meta: Record<string, unknown>;
}

interface AssetsResult {
  success: boolean;
  assets: Asset[];
  error_code?: string;
  error_message?: string;
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

async function fetchMetaAssets(accessToken: string): Promise<Asset[]> {
  const assets: Asset[] = [];
  
  console.log('Fetching Meta assets with token length:', accessToken?.length || 0);
  
  // 1. Get Facebook Pages
  const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,picture{url}&access_token=${accessToken}`;
  console.log('Calling Facebook Pages API...');
  
  const pagesResponse = await fetch(pagesUrl);
  const pagesText = await pagesResponse.text();
  console.log('Pages API response status:', pagesResponse.status);
  
  let pagesData;
  try {
    pagesData = JSON.parse(pagesText);
  } catch {
    console.error('Failed to parse pages response:', pagesText.substring(0, 200));
    throw new Error('Invalid response from Facebook API');
  }
  
  if (!pagesResponse.ok) {
    console.error('Pages API error:', JSON.stringify(pagesData));
    // If user doesn't have pages, that's okay - continue without throwing
    if (pagesData.error?.code === 190) {
      throw new Error(pagesData.error?.message || 'Access token expired or invalid');
    }
  }
  
  console.log('Found pages:', pagesData.data?.length || 0);
  
  for (const page of pagesData.data || []) {
    assets.push({
      asset_type: 'facebook_page',
      asset_id: page.id,
      asset_name: page.name,
      asset_meta: {
        picture_url: page.picture?.data?.url,
        page_access_token: page.access_token,
      },
    });
    
    // 2. Check for Instagram Business Account linked to this page
    console.log(`Checking Instagram for page ${page.id}...`);
    const igResponse = await fetch(
      `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${accessToken}`
    );
    
    if (igResponse.ok) {
      const igData = await igResponse.json();
      const igAccount = igData.instagram_business_account;
      
      if (igAccount) {
        console.log(`Found Instagram account: @${igAccount.username}`);
        assets.push({
          asset_type: 'instagram_business',
          asset_id: igAccount.id,
          asset_name: `@${igAccount.username}`,
          asset_meta: {
            username: igAccount.username,
            profile_picture_url: igAccount.profile_picture_url,
            linked_page_id: page.id,
            page_access_token: page.access_token,
          },
        });
      }
    }
  }
  
  console.log(`Total Meta assets found: ${assets.length}`);
  return assets;
}

async function fetchYouTubeAssets(accessToken: string): Promise<Asset[]> {
  const assets: Asset[] = [];
  
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch channels');
  }
  
  const data = await response.json();
  
  for (const channel of data.items || []) {
    assets.push({
      asset_type: 'youtube_channel',
      asset_id: channel.id,
      asset_name: channel.snippet?.title || 'YouTube Channel',
      asset_meta: {
        description: channel.snippet?.description,
        thumbnail_url: channel.snippet?.thumbnails?.default?.url,
        subscriber_count: channel.statistics?.subscriberCount,
        video_count: channel.statistics?.videoCount,
      },
    });
  }
  
  return assets;
}

async function fetchLinkedInAssets(accessToken: string): Promise<Asset[]> {
  const assets: Asset[] = [];
  
  // Get personal profile
  const meResponse = await fetch('https://api.linkedin.com/v2/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  
  if (meResponse.ok) {
    const me = await meResponse.json();
    assets.push({
      asset_type: 'linkedin_personal',
      asset_id: me.id,
      asset_name: `${me.localizedFirstName} ${me.localizedLastName}`,
      asset_meta: {
        urn: `urn:li:person:${me.id}`,
      },
    });
  }
  
  // Try to get organization admin access
  try {
    const orgsResponse = await fetch(
      'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (orgsResponse.ok) {
      const orgsData = await orgsResponse.json();
      
      for (const acl of orgsData.elements || []) {
        const orgUrn = acl.organization;
        const orgId = orgUrn.replace('urn:li:organization:', '');
        
        // Fetch org details
        const orgResponse = await fetch(
          `https://api.linkedin.com/v2/organizations/${orgId}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        if (orgResponse.ok) {
          const org = await orgResponse.json();
          assets.push({
            asset_type: 'linkedin_organization',
            asset_id: orgId,
            asset_name: org.localizedName || `Organization ${orgId}`,
            asset_meta: {
              urn: orgUrn,
            },
          });
        }
      }
    }
  } catch {
    // Organization access is optional
    console.log('No organization access available');
  }
  
  return assets;
}

async function fetchTikTokAssets(accessToken: string): Promise<Asset[]> {
  const assets: Asset[] = [];
  
  const response = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch TikTok user');
  }
  
  const data = await response.json();
  const user = data.data?.user;
  
  if (user) {
    assets.push({
      asset_type: 'tiktok_account',
      asset_id: user.open_id,
      asset_name: user.display_name || 'TikTok Account',
      asset_meta: {
        avatar_url: user.avatar_url,
      },
    });
  }
  
  return assets;
}

async function fetchTwitterAssets(accessToken: string): Promise<Asset[]> {
  const assets: Asset[] = [];
  
  const response = await fetch(
    'https://api.twitter.com/2/users/me?user.fields=profile_image_url,description',
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch Twitter user');
  }
  
  const data = await response.json();
  const user = data.data;
  
  if (user) {
    assets.push({
      asset_type: 'twitter_account',
      asset_id: user.id,
      asset_name: `@${user.username}`,
      asset_meta: {
        username: user.username,
        profile_image_url: user.profile_image_url,
        description: user.description,
      },
    });
  }
  
  return assets;
}

async function fetchPlatformAssets(platform: Platform, accessToken: string): Promise<Asset[]> {
  switch (platform) {
    case 'instagram':
    case 'facebook':
      return fetchMetaAssets(accessToken);
    case 'youtube':
      return fetchYouTubeAssets(accessToken);
    case 'linkedin':
      return fetchLinkedInAssets(accessToken);
    case 'tiktok':
      return fetchTikTokAssets(accessToken);
    case 'twitter':
      return fetchTwitterAssets(accessToken);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
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

    // Verify JWT from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'UNAUTHORIZED', error_message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'UNAUTHORIZED', error_message: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { workspace_id, platform_connection_id } = await req.json();

    if (!workspace_id || !platform_connection_id) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'MISSING_PARAMS', error_message: 'Missing workspace_id or platform_connection_id' }),
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

    if (!roleData || !['owner', 'admin', 'coordinator'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error_code: 'FORBIDDEN', 
          error_message: 'Você não tem permissão para gerenciar conexões de plataformas.' 
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
        JSON.stringify({ success: false, error_code: 'NOT_FOUND', error_message: 'Platform connection not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!platformData.access_token_encrypted) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'NO_TOKEN', error_message: 'Reconecte a plataforma para obter novos tokens.' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt token
    const accessToken = decryptToken(platformData.access_token_encrypted);

    // Fetch assets from platform API
    console.log(`Fetching assets for ${platformData.platform}...`);
    const assets = await fetchPlatformAssets(platformData.platform as Platform, accessToken);
    console.log(`Found ${assets.length} assets`);

    // Clear existing assets and insert new ones
    await supabase
      .from('social_platform_assets')
      .delete()
      .eq('platform_connection_id', platform_connection_id);

    if (assets.length > 0) {
      const assetsToInsert = assets.map(asset => ({
        workspace_id,
        platform_id: platformData.platform,
        platform_connection_id,
        asset_type: asset.asset_type,
        asset_id: asset.asset_id,
        asset_name: asset.asset_name,
        asset_meta: asset.asset_meta,
      }));

      const { error: insertError } = await supabase
        .from('social_platform_assets')
        .insert(assetsToInsert);

      if (insertError) {
        console.error('Error inserting assets:', insertError);
        throw new Error('Failed to save assets');
      }
    }

    // Update connection status if no asset selected yet
    if (!platformData.platform_account_type || !platformData.account_id) {
      await supabase
        .from('social_platforms')
        .update({ connection_status: 'pending_assets' })
        .eq('id', platform_connection_id);
    }

    // Log event
    await supabase.from('domain_events').insert({
      workspace_id,
      event_type: 'social_platform.assets_fetched',
      entity_type: 'social_platform',
      entity_id: platform_connection_id,
      payload: {
        platform: platformData.platform,
        asset_count: assets.length,
        asset_types: [...new Set(assets.map(a => a.asset_type))],
      },
      actor_id: user.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        assets,
        status: assets.length > 0 ? 'pending_selection' : 'no_assets_found',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Assets fetch error:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error_code: 'FETCH_ERROR', 
        error_message: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
