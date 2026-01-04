import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Platform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter';

// Graph API version
const GRAPH_VERSION = '24.0';

interface Asset {
  asset_type: string;
  asset_id: string;
  asset_name: string;
  asset_meta: Record<string, unknown>;
}

interface AssetsResult {
  success: boolean;
  assets: Asset[];
  pages?: Asset[];
  instagram?: Asset[];
  warnings?: string[];
  reason_code?: string;
  reason_message?: string;
  error_code?: string;
  error_message?: string;
  reauth_strategy?: string; // For REQUIRES_REAUTH - tells frontend which strategy to use
}

/**
 * Reason codes for empty asset list (diagnosis)
 */
type AssetReasonCode = 
  | 'NO_PAGES_ADMIN'      // User is not admin of any Facebook Page
  | 'NO_IG_LINKED'        // No Instagram Business linked to Pages
  | 'MISSING_SCOPES'      // Token missing required scopes
  | 'REQUIRES_REAUTH'     // Need to re-authenticate with more scopes
  | 'TOKEN_INVALID'       // Token expired or revoked
  | 'TOKEN_EXPIRED'       // Token explicitly expired
  | 'API_ERROR';          // Generic API error

// Simple decryption for tokens
function decryptToken(encrypted: string): string {
  const key = Deno.env.get('TOKEN_ENCRYPTION_KEY') || 'default-key-change-me';
  const decoded = atob(encrypted);
  const bytes = new Uint8Array([...decoded].map(c => c.charCodeAt(0)));
  const keyBytes = new TextEncoder().encode(key);
  const decrypted = bytes.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
  return new TextDecoder().decode(decrypted);
}

// Simple encryption for tokens
function encryptToken(token: string): string {
  const key = Deno.env.get('TOKEN_ENCRYPTION_KEY') || 'default-key-change-me';
  const encoded = new TextEncoder().encode(token);
  const keyBytes = new TextEncoder().encode(key);
  const encrypted = encoded.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
  return btoa(String.fromCharCode(...encrypted));
}

/**
 * Fetch Meta Pages and Instagram Business accounts
 * Returns detailed diagnosis if empty
 */
async function fetchMetaAssets(accessToken: string): Promise<AssetsResult> {
  const assets: Asset[] = [];
  const pages: Asset[] = [];
  const instagram: Asset[] = [];
  const warnings: string[] = [];
  
  console.log('Fetching Meta assets with token length:', accessToken?.length || 0);
  
  // 1. Get Facebook Pages where user is admin
  // The 'tasks' field tells us what permissions we have on the page
  const pagesUrl = `https://graph.facebook.com/v${GRAPH_VERSION}/me/accounts?fields=id,name,access_token,picture{url},tasks&access_token=${accessToken}`;
  console.log('Calling Facebook Pages API...');
  
  const pagesResponse = await fetch(pagesUrl);
  const pagesText = await pagesResponse.text();
  console.log('Pages API response status:', pagesResponse.status);
  
  let pagesData: any;
  try {
    pagesData = JSON.parse(pagesText);
  } catch {
    console.error('Failed to parse pages response:', pagesText.substring(0, 200));
    return {
      success: false,
      assets: [],
      reason_code: 'API_ERROR',
      reason_message: 'Invalid response from Facebook API',
      error_code: 'API_ERROR',
      error_message: 'Invalid response from Facebook API',
    };
  }
  
  // Handle API errors
  if (!pagesResponse.ok || pagesData.error) {
    console.error('Pages API error:', JSON.stringify(pagesData));
    
    const errorCode = pagesData.error?.code;
    const errorMessage = pagesData.error?.message || 'Unknown error';
    
    // Token expired/invalid
    if (errorCode === 190) {
      return {
        success: false,
        assets: [],
        reason_code: 'TOKEN_INVALID',
        reason_message: 'O token de acesso expirou ou foi revogado. Reconecte a plataforma.',
        error_code: 'TOKEN_INVALID',
        error_message: errorMessage,
      };
    }
    
    // Permission denied (missing scopes)
    // This is the EXPECTED case when using fallback auth with only public_profile
    if (errorCode === 200 || errorCode === 10 || errorMessage.includes('permission') || errorMessage.includes('scope')) {
      console.log('Missing scopes detected - user needs to re-authenticate with pages_show_list');
      return {
        success: false,
        assets: [],
        reason_code: 'REQUIRES_REAUTH',
        reason_message: 'Para listar suas páginas, precisamos de permissões adicionais. Clique em "Adicionar permissões" para continuar.',
        error_code: 'REQUIRES_REAUTH',
        error_message: 'Missing pages_show_list scope',
        // Tell frontend which strategy to use for re-auth
        reauth_strategy: 'pages_list',
      };
    }
    
    return {
      success: false,
      assets: [],
      reason_code: 'API_ERROR',
      reason_message: errorMessage,
      error_code: 'API_ERROR',
      error_message: errorMessage,
    };
  }
  
  console.log('Found pages:', pagesData.data?.length || 0);
  
  // Check if user has no pages
  if (!pagesData.data || pagesData.data.length === 0) {
    return {
      success: true,
      assets: [],
      pages: [],
      instagram: [],
      warnings: ['Nenhuma Página do Facebook encontrada para este usuário.'],
      reason_code: 'NO_PAGES_ADMIN',
      reason_message: 'Você não é administrador de nenhuma Página do Facebook. Para conectar, você precisa ter uma Página onde você é administrador.',
    };
  }
  
  // Process each page
  for (const page of pagesData.data || []) {
    const tasks = page.tasks || [];
    
    // Check if user can publish (CREATE_CONTENT or MANAGE)
    const canPublish = tasks.includes('CREATE_CONTENT') || tasks.includes('MANAGE') || tasks.includes('ADVERTISE');
    
    const pageAsset: Asset = {
      asset_type: 'facebook_page',
      asset_id: page.id,
      asset_name: page.name,
      asset_meta: {
        picture_url: page.picture?.data?.url,
        page_access_token: page.access_token, // Store for publishing
        tasks: tasks,
        can_publish: canPublish,
      },
    };
    
    pages.push(pageAsset);
    assets.push(pageAsset);
    
    if (!canPublish) {
      warnings.push(`Página "${page.name}" não tem permissão de publicação (tasks: ${tasks.join(', ')})`);
    }
    
    // 2. Check for Instagram Business Account linked to this page
    console.log(`Checking Instagram for page ${page.id} (${page.name})...`);
    
    try {
      const igResponse = await fetch(
        `https://graph.facebook.com/v${GRAPH_VERSION}/${page.id}?fields=instagram_business_account{id,username,name,profile_picture_url}&access_token=${accessToken}`
      );
      
      if (igResponse.ok) {
        const igData = await igResponse.json();
        const igAccount = igData.instagram_business_account;
        
        if (igAccount) {
          console.log(`Found Instagram account: @${igAccount.username}`);
          
          const igAsset: Asset = {
            asset_type: 'instagram_business',
            asset_id: igAccount.id,
            asset_name: `@${igAccount.username}`,
            asset_meta: {
              username: igAccount.username,
              name: igAccount.name,
              profile_picture_url: igAccount.profile_picture_url,
              linked_page_id: page.id,
              linked_page_name: page.name,
              page_access_token: page.access_token, // Need this for IG publishing
            },
          };
          
          instagram.push(igAsset);
          assets.push(igAsset);
        }
      } else {
        const igError = await igResponse.text();
        console.warn(`Failed to fetch IG for page ${page.id}:`, igError);
      }
    } catch (igError) {
      console.warn(`Error fetching IG for page ${page.id}:`, igError);
    }
  }
  
  // If we have pages but no Instagram accounts, add a note
  if (pages.length > 0 && instagram.length === 0) {
    warnings.push('Nenhuma conta Instagram Profissional vinculada às suas Páginas. Para conectar Instagram, vincule uma conta Instagram Business/Creator à sua Página do Facebook.');
  }
  
  console.log(`Total Meta assets found: ${assets.length} (${pages.length} pages, ${instagram.length} IG accounts)`);
  
  return {
    success: true,
    assets,
    pages,
    instagram,
    warnings: warnings.length > 0 ? warnings : undefined,
    reason_code: assets.length === 0 ? 'NO_IG_LINKED' : undefined,
    reason_message: assets.length === 0 ? 'Páginas encontradas mas sem Instagram Business vinculado.' : undefined,
  };
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

async function fetchPlatformAssets(platform: Platform, accessToken: string): Promise<AssetsResult> {
  switch (platform) {
    case 'instagram':
    case 'facebook':
      return fetchMetaAssets(accessToken);
    case 'youtube':
      return { success: true, assets: await fetchYouTubeAssets(accessToken) };
    case 'linkedin':
      return { success: true, assets: await fetchLinkedInAssets(accessToken) };
    case 'tiktok':
      return { success: true, assets: await fetchTikTokAssets(accessToken) };
    case 'twitter':
      return { success: true, assets: await fetchTwitterAssets(accessToken) };
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

serve(async (req) => {
  console.log('social-connection-assets invoked, method:', req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting assets fetch...');
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ success: false, error_code: 'CONFIG_ERROR', error_message: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'UNAUTHORIZED', error_message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Auth header present:', !!authHeader);

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    console.log('User auth result:', user?.id || 'no user', authError?.message || 'no error');
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'UNAUTHORIZED', error_message: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ success: false, error_code: 'INVALID_BODY', error_message: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { workspace_id, platform_connection_id } = body;
    console.log('Request params:', { workspace_id, platform_connection_id });

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
        JSON.stringify({ 
          success: false, 
          error_code: 'NO_TOKEN', 
          error_message: 'Reconecte a plataforma para obter novos tokens.',
          reason_code: 'TOKEN_INVALID',
          reason_message: 'Nenhum token armazenado. Reconecte a plataforma.',
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt token
    const accessToken = decryptToken(platformData.access_token_encrypted);

    // Fetch assets from platform API
    console.log(`Fetching assets for ${platformData.platform}...`);
    const result = await fetchPlatformAssets(platformData.platform as Platform, accessToken);
    console.log(`Fetch result: success=${result.success}, assets=${result.assets.length}`);

    if (!result.success) {
      // Update connection status to error
      await supabase
        .from('social_platforms')
        .update({ 
          connection_status: 'error',
          last_error_code: result.error_code,
          last_error_message: result.reason_message || result.error_message,
        })
        .eq('id', platform_connection_id);

      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clear existing assets and insert new ones
    await supabase
      .from('social_platform_assets')
      .delete()
      .eq('platform_connection_id', platform_connection_id);

    if (result.assets.length > 0) {
      const assetsToInsert = result.assets.map(asset => ({
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
        .update({ 
          connection_status: result.assets.length > 0 ? 'pending_assets' : 'error',
          last_error_code: result.assets.length === 0 ? result.reason_code : null,
          last_error_message: result.assets.length === 0 ? result.reason_message : null,
        })
        .eq('id', platform_connection_id);
    }

    // Log event
    await supabase.from('domain_events').insert({
      workspace_id,
      aggregate_type: 'social_media',
      aggregate_id: workspace_id,
      event_type: 'social_platform.assets_fetched',
      payload: {
        platform_connection_id,
        platform: platformData.platform,
        asset_count: result.assets.length,
        asset_types: [...new Set(result.assets.map(a => a.asset_type))],
        reason_code: result.reason_code,
        warnings: result.warnings,
        actor_id: user.id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        assets: result.assets,
        pages: result.pages,
        instagram: result.instagram,
        warnings: result.warnings,
        reason_code: result.reason_code,
        reason_message: result.reason_message,
        status: result.assets.length > 0 ? 'pending_selection' : 'no_assets_found',
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
