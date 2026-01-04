import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Graph API version - MUST match other Meta edge functions
const GRAPH_VERSION = '24.0';

/**
 * Diagnostic Result Codes
 */
type DiagnosticCode = 
  | 'OK'                        // Everything working
  | 'TOKEN_INVALID'             // Token expired/revoked
  | 'TOKEN_EXPIRED'             // Token explicitly expired
  | 'MISSING_SCOPES'            // Token missing required scopes
  | 'NO_PAGES_ADMIN'            // User is not admin of any Page
  | 'NO_IG_LINKED'              // No Instagram Business linked
  | 'APP_LEVEL_CONFIG_PROBLEM'  // App-level issue (roles/products/permissions)
  | 'INVALID_SCOPE'             // Meta rejected requested scopes
  | 'PROVIDER_NOT_CONFIGURED'   // Missing secrets
  | 'API_ERROR';                // Generic API error

interface DiagnosticResult {
  code: DiagnosticCode;
  message: string;
  details: string;
  action: string[];
  technical?: Record<string, unknown>;
}

interface DebugTokenResult {
  is_valid: boolean;
  app_id?: string;
  user_id?: string;
  scopes?: string[];
  expires_at?: number;
  error?: {
    code: number;
    message: string;
    subcode?: number;
  };
}

interface MeAccountsResult {
  data?: Array<{
    id: string;
    name: string;
    tasks?: string[];
    access_token?: string;
  }>;
  error?: {
    code: number;
    message: string;
    subcode?: number;
  };
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

/**
 * Call Facebook's debug_token endpoint to validate token and get scopes
 */
async function debugToken(accessToken: string): Promise<DebugTokenResult> {
  const appId = Deno.env.get('META_APP_ID');
  const appSecret = Deno.env.get('META_APP_SECRET');
  
  if (!appId || !appSecret) {
    return { is_valid: false, error: { code: -1, message: 'META_APP_ID or META_APP_SECRET not configured' } };
  }
  
  // Use app access token for debug_token
  const appAccessToken = `${appId}|${appSecret}`;
  
  const url = `https://graph.facebook.com/v${GRAPH_VERSION}/debug_token?input_token=${accessToken}&access_token=${appAccessToken}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      return {
        is_valid: false,
        error: {
          code: data.error.code,
          message: data.error.message,
          subcode: data.error.error_subcode,
        },
      };
    }
    
    const tokenData = data.data;
    return {
      is_valid: tokenData.is_valid,
      app_id: tokenData.app_id,
      user_id: tokenData.user_id,
      scopes: tokenData.scopes || [],
      expires_at: tokenData.expires_at,
    };
  } catch (error) {
    return {
      is_valid: false,
      error: { code: -2, message: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Call /me/accounts to check Pages access
 */
async function getMeAccounts(accessToken: string): Promise<MeAccountsResult> {
  const url = `https://graph.facebook.com/v${GRAPH_VERSION}/me/accounts?fields=id,name,tasks,access_token&access_token=${accessToken}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      return {
        error: {
          code: data.error.code,
          message: data.error.message,
          subcode: data.error.error_subcode,
        },
      };
    }
    
    return { data: data.data || [] };
  } catch (error) {
    return {
      error: { code: -2, message: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Check for Instagram Business linked to a Page
 */
async function getInstagramBusinessAccount(pageId: string, accessToken: string): Promise<{ id: string; username: string } | null> {
  const url = `https://graph.facebook.com/v${GRAPH_VERSION}/${pageId}?fields=instagram_business_account{id,username}&access_token=${accessToken}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.instagram_business_account) {
      return {
        id: data.instagram_business_account.id,
        username: data.instagram_business_account.username,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Run full diagnostic
 */
async function runDiagnostics(
  accessToken: string,
  platform: 'facebook' | 'instagram'
): Promise<{
  diagnostics: DiagnosticResult[];
  summary: {
    token_valid: boolean;
    scopes: string[];
    scopes_missing: string[];
    pages_count: number;
    pages_with_publish: number;
    instagram_accounts: number;
    overall_status: 'ready' | 'needs_reauth' | 'needs_pages' | 'needs_setup' | 'error';
  };
  raw: {
    debug_token?: DebugTokenResult;
    me_accounts?: MeAccountsResult;
    instagram_accounts?: Array<{ page_id: string; ig_id: string; ig_username: string }>;
  };
}> {
  const diagnostics: DiagnosticResult[] = [];
  const raw: {
    debug_token?: DebugTokenResult;
    me_accounts?: MeAccountsResult;
    instagram_accounts?: Array<{ page_id: string; ig_id: string; ig_username: string }>;
  } = {};
  
  // Required scopes based on platform
  const requiredScopes = platform === 'instagram' 
    ? ['pages_show_list', 'instagram_basic']
    : ['pages_show_list'];
  
  const publishScopes = platform === 'instagram'
    ? ['pages_manage_posts', 'instagram_content_publish']
    : ['pages_manage_posts', 'pages_read_engagement'];
  
  // Test 1: Debug Token
  console.log('[Diagnostic] Running debug_token...');
  const debugResult = await debugToken(accessToken);
  raw.debug_token = debugResult;
  
  if (!debugResult.is_valid) {
    if (debugResult.error?.code === 190) {
      diagnostics.push({
        code: 'TOKEN_INVALID',
        message: 'Token de acesso inválido ou expirado',
        details: debugResult.error.message,
        action: ['Reconecte a plataforma clicando em "Conectar" novamente'],
      });
    } else {
      diagnostics.push({
        code: 'TOKEN_INVALID',
        message: 'Não foi possível validar o token',
        details: debugResult.error?.message || 'Erro desconhecido',
        action: ['Reconecte a plataforma'],
      });
    }
    
    return {
      diagnostics,
      summary: {
        token_valid: false,
        scopes: [],
        scopes_missing: requiredScopes,
        pages_count: 0,
        pages_with_publish: 0,
        instagram_accounts: 0,
        overall_status: 'error',
      },
      raw,
    };
  }
  
  // Check scopes
  const grantedScopes = debugResult.scopes || [];
  const missingRequired = requiredScopes.filter(s => !grantedScopes.includes(s));
  const missingPublish = publishScopes.filter(s => !grantedScopes.includes(s));
  
  if (missingRequired.length > 0) {
    diagnostics.push({
      code: 'MISSING_SCOPES',
      message: 'Permissões básicas não concedidas',
      details: `Faltando: ${missingRequired.join(', ')}`,
      action: [
        'Clique em "Adicionar Permissões" para autorizar os escopos necessários',
        'Se o erro persistir, verifique se você é Admin/Dev/Tester do App Meta',
      ],
      technical: { missing: missingRequired, granted: grantedScopes },
    });
  }
  
  if (missingPublish.length > 0) {
    diagnostics.push({
      code: 'MISSING_SCOPES',
      message: 'Permissões de publicação não concedidas',
      details: `Para publicar, você precisa: ${missingPublish.join(', ')}`,
      action: [
        'Reconecte com permissões completas (Modo FULL)',
        'Se o App não passou por App Review, você precisa ser Test User',
      ],
      technical: { missing: missingPublish, granted: grantedScopes },
    });
  }
  
  // Check token expiration
  if (debugResult.expires_at && debugResult.expires_at > 0) {
    const expiresAt = new Date(debugResult.expires_at * 1000);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 0) {
      diagnostics.push({
        code: 'TOKEN_EXPIRED',
        message: 'Token expirado',
        details: `Expirou em ${expiresAt.toLocaleDateString('pt-BR')}`,
        action: ['Reconecte a plataforma para renovar o token'],
      });
    } else if (daysUntilExpiry <= 7) {
      diagnostics.push({
        code: 'OK',
        message: 'Token expirando em breve',
        details: `Expira em ${daysUntilExpiry} dias (${expiresAt.toLocaleDateString('pt-BR')})`,
        action: ['Considere reconectar para renovar o token'],
      });
    }
  }
  
  // Test 2: /me/accounts (only if we have pages_show_list)
  let pagesCount = 0;
  let pagesWithPublish = 0;
  
  if (grantedScopes.includes('pages_show_list')) {
    console.log('[Diagnostic] Running /me/accounts...');
    const accountsResult = await getMeAccounts(accessToken);
    raw.me_accounts = accountsResult;
    
    if (accountsResult.error) {
      if (accountsResult.error.code === 200 || accountsResult.error.message.includes('permission')) {
        diagnostics.push({
          code: 'APP_LEVEL_CONFIG_PROBLEM',
          message: 'Problema de configuração no nível do App',
          details: accountsResult.error.message,
          action: [
            'Verifique se você é Admin/Developer/Tester do App no Meta for Developers',
            'Verifique se o produto "Facebook Login" está habilitado no App',
            'Verifique se os Casos de Uso (Use Cases) estão configurados corretamente',
          ],
          technical: { error: accountsResult.error },
        });
      } else {
        diagnostics.push({
          code: 'API_ERROR',
          message: 'Erro ao buscar Páginas',
          details: accountsResult.error.message,
          action: ['Tente novamente ou reconecte a plataforma'],
        });
      }
    } else if (accountsResult.data) {
      pagesCount = accountsResult.data.length;
      
      if (pagesCount === 0) {
        diagnostics.push({
          code: 'NO_PAGES_ADMIN',
          message: 'Nenhuma Página encontrada',
          details: 'Você não é administrador de nenhuma Página do Facebook',
          action: [
            'Crie uma Página do Facebook ou peça para ser adicionado como admin de uma existente',
            'Verifique se você logou com a conta correta do Facebook',
          ],
        });
      } else {
        // Check pages with publish permission
        for (const page of accountsResult.data) {
          const tasks = page.tasks || [];
          if (tasks.includes('CREATE_CONTENT') || tasks.includes('MANAGE')) {
            pagesWithPublish++;
          }
        }
        
        if (pagesWithPublish === 0) {
          diagnostics.push({
            code: 'NO_PAGES_ADMIN',
            message: 'Nenhuma Página com permissão de publicação',
            details: `Você tem ${pagesCount} Página(s), mas nenhuma com permissão CREATE_CONTENT ou MANAGE`,
            action: [
              'Verifique suas permissões nas Páginas do Facebook',
              'Você precisa ser Admin ou Editor para publicar',
            ],
            technical: { pages: accountsResult.data.map(p => ({ id: p.id, name: p.name, tasks: p.tasks })) },
          });
        }
        
        // Test 3: Instagram Business (only for instagram platform)
        if (platform === 'instagram' && pagesCount > 0) {
          const igAccounts: Array<{ page_id: string; ig_id: string; ig_username: string }> = [];
          
          for (const page of accountsResult.data) {
            const ig = await getInstagramBusinessAccount(page.id, accessToken);
            if (ig) {
              igAccounts.push({
                page_id: page.id,
                ig_id: ig.id,
                ig_username: ig.username,
              });
            }
          }
          
          raw.instagram_accounts = igAccounts;
          
          if (igAccounts.length === 0) {
            diagnostics.push({
              code: 'NO_IG_LINKED',
              message: 'Nenhuma conta Instagram Business encontrada',
              details: 'Suas Páginas não têm contas Instagram Profissionais vinculadas',
              action: [
                'Vincule uma conta Instagram Business ou Creator à sua Página do Facebook',
                'Vá para Configurações da Página → Instagram → Conectar conta',
                'A conta Instagram precisa ser do tipo Business ou Creator',
              ],
            });
          }
        }
      }
    }
  }
  
  // Calculate overall status
  let overallStatus: 'ready' | 'needs_reauth' | 'needs_pages' | 'needs_setup' | 'error' = 'ready';
  
  if (diagnostics.some(d => d.code === 'TOKEN_INVALID' || d.code === 'TOKEN_EXPIRED')) {
    overallStatus = 'error';
  } else if (diagnostics.some(d => d.code === 'APP_LEVEL_CONFIG_PROBLEM' || d.code === 'INVALID_SCOPE')) {
    overallStatus = 'needs_setup';
  } else if (missingRequired.length > 0) {
    overallStatus = 'needs_reauth';
  } else if (pagesCount === 0 || (platform === 'instagram' && (raw.instagram_accounts?.length || 0) === 0)) {
    overallStatus = 'needs_pages';
  }
  
  return {
    diagnostics,
    summary: {
      token_valid: debugResult.is_valid,
      scopes: grantedScopes,
      scopes_missing: [...new Set([...missingRequired, ...missingPublish])],
      pages_count: pagesCount,
      pages_with_publish: pagesWithPublish,
      instagram_accounts: raw.instagram_accounts?.length || 0,
      overall_status: overallStatus,
    },
    raw,
  };
}

serve(async (req) => {
  console.log('social-meta-diagnostics invoked, method:', req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT
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

    const { workspace_id, platform_connection_id, platform } = await req.json();

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'MISSING_PARAMS', error_message: 'Missing workspace_id' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['owner', 'admin', 'coordinator'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'FORBIDDEN', error_message: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check provider configuration
    const metaAppId = Deno.env.get('META_APP_ID');
    const metaAppSecret = Deno.env.get('META_APP_SECRET');
    const encryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY');

    const configStatus = {
      meta_app_id: !!metaAppId,
      meta_app_secret: !!metaAppSecret,
      encryption_key: !!encryptionKey,
      all_configured: !!metaAppId && !!metaAppSecret && !!encryptionKey,
    };

    if (!configStatus.all_configured) {
      return new Response(
        JSON.stringify({
          success: false,
          error_code: 'PROVIDER_NOT_CONFIGURED',
          error_message: 'Meta OAuth não está configurado',
          config_status: configStatus,
          diagnostics: [{
            code: 'PROVIDER_NOT_CONFIGURED',
            message: 'Credenciais do Meta não configuradas',
            details: 'O administrador do sistema precisa configurar META_APP_ID, META_APP_SECRET e TOKEN_ENCRYPTION_KEY',
            action: [
              'Adicione META_APP_ID nos secrets do projeto',
              'Adicione META_APP_SECRET nos secrets do projeto',
              'Adicione TOKEN_ENCRYPTION_KEY nos secrets do projeto',
            ],
          }],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If platform_connection_id provided, get token and run full diagnostics
    if (platform_connection_id) {
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
            error_message: 'Nenhum token armazenado. Reconecte a plataforma.',
            diagnostics: [{
              code: 'TOKEN_INVALID',
              message: 'Nenhum token de acesso encontrado',
              details: 'A conexão não possui token armazenado',
              action: ['Reconecte a plataforma clicando em "Conectar" novamente'],
            }],
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = decryptToken(platformData.access_token_encrypted);
      const effectivePlatform = (platform || platformData.platform) as 'facebook' | 'instagram';
      
      console.log(`Running diagnostics for ${effectivePlatform} connection ${platform_connection_id}...`);
      
      const result = await runDiagnostics(accessToken, effectivePlatform);

      // Log diagnostic event
      await supabase.from('domain_events').insert({
        workspace_id,
        aggregate_type: 'social_media',
        aggregate_id: workspace_id,
        event_type: 'social_meta.diagnostics',
        payload: {
          platform_connection_id,
          platform: effectivePlatform,
          summary: result.summary,
          diagnostics_count: result.diagnostics.length,
          actor_id: user.id,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          config_status: configStatus,
          ...result,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No connection ID - just return config status
    return new Response(
      JSON.stringify({
        success: true,
        config_status: configStatus,
        diagnostics: [],
        summary: {
          token_valid: false,
          scopes: [],
          scopes_missing: [],
          pages_count: 0,
          pages_with_publish: 0,
          instagram_accounts: 0,
          overall_status: 'ready',
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Diagnostics error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error_code: 'SERVER_ERROR', error_message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
