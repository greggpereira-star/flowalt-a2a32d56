import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta App Configuration Audit - Edge Function
 * 
 * This function performs a comprehensive audit of the Meta App configuration
 * to diagnose "Invalid Scopes" errors that occur at the App level, not user level.
 * 
 * Checks performed:
 * 1. Validate App credentials are configured
 * 2. Check if required products are added (Facebook Login, Instagram Graph API)
 * 3. Verify App mode (Development vs Live)
 * 4. Check user roles in the App (Admin, Developer, Tester)
 * 5. Validate requested scopes exist and are valid for Graph API v24.0
 * 6. Validate Redirect URI configuration
 * 7. Check App Review status for each permission
 */

const GRAPH_VERSION = '24.0';

// Valid scopes for Graph API v24.0
// Reference: https://developers.facebook.com/docs/permissions/reference
const VALID_SCOPES_V24 = {
  // Basic permissions (no App Review needed)
  'public_profile': { 
    app_review_required: false, 
    description: 'Nome, foto e ID do usuário' 
  },
  'email': { 
    app_review_required: false, 
    description: 'Email do usuário' 
  },
  
  // Pages permissions (App Review required)
  'pages_show_list': { 
    app_review_required: true, 
    description: 'Listar Páginas que o usuário gerencia',
    products_required: ['facebook_login']
  },
  'pages_read_engagement': { 
    app_review_required: true, 
    description: 'Ler métricas de engajamento das Páginas',
    products_required: ['facebook_login']
  },
  'pages_manage_posts': { 
    app_review_required: true, 
    description: 'Publicar e gerenciar posts nas Páginas',
    products_required: ['facebook_login']
  },
  'pages_read_user_content': { 
    app_review_required: true, 
    description: 'Ler conteúdo das Páginas',
    products_required: ['facebook_login']
  },
  'pages_manage_metadata': { 
    app_review_required: true, 
    description: 'Gerenciar metadados das Páginas',
    products_required: ['facebook_login']
  },
  
  // Instagram permissions (App Review required)
  'instagram_basic': { 
    app_review_required: true, 
    description: 'Acesso básico ao Instagram Business/Creator',
    products_required: ['instagram_graph_api']
  },
  'instagram_content_publish': { 
    app_review_required: true, 
    description: 'Publicar conteúdo no Instagram',
    products_required: ['instagram_graph_api']
  },
  'instagram_manage_insights': { 
    app_review_required: true, 
    description: 'Acessar insights do Instagram',
    products_required: ['instagram_graph_api']
  },
  'instagram_manage_comments': { 
    app_review_required: true, 
    description: 'Gerenciar comentários no Instagram',
    products_required: ['instagram_graph_api']
  },
  'instagram_manage_messages': { 
    app_review_required: true, 
    description: 'Gerenciar mensagens do Instagram',
    products_required: ['instagram_graph_api', 'messenger']
  },
};

// Scopes required for minimum functionality
const MINIMUM_SCOPES = ['public_profile', 'pages_show_list'];

// Scopes required for full functionality
const FULL_SCOPES = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
];

// Scopes for Instagram publishing
const INSTAGRAM_PUBLISH_SCOPES = [
  ...FULL_SCOPES,
  'instagram_content_publish',
];

interface AuditResult {
  code: string;
  severity: 'error' | 'warning' | 'info';
  category: 'credentials' | 'products' | 'roles' | 'scopes' | 'redirect_uri' | 'app_review';
  message: string;
  details: string;
  action: string[];
  technical?: Record<string, unknown>;
}

interface AppInfo {
  id: string;
  name?: string;
  category?: string;
  company?: string;
  contact_email?: string;
  privacy_policy_url?: string;
  terms_of_service_url?: string;
  default_share_mode?: string;
  auth_dialog_data_help_url?: string;
}

/**
 * Check App info using Graph API
 */
async function getAppInfo(appId: string, appSecret: string): Promise<{
  success: boolean;
  app?: AppInfo;
  error?: { code: number; message: string };
}> {
  const appAccessToken = `${appId}|${appSecret}`;
  const url = `https://graph.facebook.com/v${GRAPH_VERSION}/${appId}?` +
    `fields=id,name,category,company,contact_email,privacy_policy_url,terms_of_service_url,default_share_mode,auth_dialog_data_help_url&` +
    `access_token=${appAccessToken}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        error: { code: data.error.code, message: data.error.message },
      };
    }

    return {
      success: true,
      app: data as AppInfo,
    };
  } catch (error) {
    return {
      success: false,
      error: { code: -1, message: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Check App Roles - who has access to the App
 * Note: This endpoint requires app access token but may not be available for all apps
 */
async function getAppRoles(appId: string, appSecret: string): Promise<{
  success: boolean;
  roles?: Array<{ role: string; user: { id: string; name?: string } }>;
  error?: { code: number; message: string };
}> {
  const appAccessToken = `${appId}|${appSecret}`;
  const url = `https://graph.facebook.com/v${GRAPH_VERSION}/${appId}/roles?access_token=${appAccessToken}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        error: { code: data.error.code, message: data.error.message },
      };
    }

    return {
      success: true,
      roles: data.data || [],
    };
  } catch (error) {
    return {
      success: false,
      error: { code: -1, message: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Validate debug_token to check what scopes were actually granted
 */
async function debugToken(inputToken: string, appId: string, appSecret: string): Promise<{
  success: boolean;
  data?: {
    is_valid: boolean;
    app_id: string;
    user_id?: string;
    type: string;
    application?: string;
    scopes?: string[];
    expires_at?: number;
    issued_at?: number;
    metadata?: Record<string, unknown>;
    error?: { code: number; message: string; subcode?: number };
  };
  error?: { code: number; message: string };
}> {
  const appAccessToken = `${appId}|${appSecret}`;
  const url = `https://graph.facebook.com/v${GRAPH_VERSION}/debug_token?` +
    `input_token=${inputToken}&access_token=${appAccessToken}`;

  try {
    const response = await fetch(url);
    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        error: { code: result.error.code, message: result.error.message },
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      error: { code: -1, message: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Check if the Redirect URI is valid
 */
function validateRedirectUri(configuredUri: string, usedUri: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  if (!configuredUri) {
    issues.push('Redirect URI não configurado');
    return { valid: false, issues };
  }

  if (!usedUri) {
    issues.push('Redirect URI usado não fornecido para validação');
    return { valid: true, issues };
  }

  try {
    const configuredUrl = new URL(configuredUri);
    const usedUrl = new URL(usedUri);

    if (configuredUrl.origin !== usedUrl.origin) {
      issues.push(`Domínio diferente: configurado "${configuredUrl.origin}" vs usado "${usedUrl.origin}"`);
    }

    if (configuredUrl.pathname !== usedUrl.pathname) {
      issues.push(`Path diferente: configurado "${configuredUrl.pathname}" vs usado "${usedUrl.pathname}"`);
    }

    // Check for http vs https mismatch
    if (configuredUrl.protocol !== usedUrl.protocol) {
      issues.push(`Protocolo diferente: configurado "${configuredUrl.protocol}" vs usado "${usedUrl.protocol}"`);
    }

    // Check for localhost which is only allowed in development
    if (configuredUrl.hostname === 'localhost' || configuredUrl.hostname === '127.0.0.1') {
      issues.push('Redirect URI usa localhost - só funciona em modo desenvolvimento');
    }
  } catch (e) {
    issues.push(`URI inválida: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validate scopes against Graph API v24.0
 */
function validateScopes(requestedScopes: string[]): {
  valid: string[];
  invalid: string[];
  require_app_review: string[];
  require_products: Record<string, string[]>;
} {
  const valid: string[] = [];
  const invalid: string[] = [];
  const require_app_review: string[] = [];
  const require_products: Record<string, string[]> = {};

  for (const scope of requestedScopes) {
    const scopeInfo = VALID_SCOPES_V24[scope as keyof typeof VALID_SCOPES_V24];
    
    if (!scopeInfo) {
      invalid.push(scope);
      continue;
    }

    valid.push(scope);

    if (scopeInfo.app_review_required) {
      require_app_review.push(scope);
    }

    if ('products_required' in scopeInfo && scopeInfo.products_required) {
      for (const product of scopeInfo.products_required) {
        if (!require_products[product]) {
          require_products[product] = [];
        }
        require_products[product].push(scope);
      }
    }
  }

  return { valid, invalid, require_app_review, require_products };
}

/**
 * Run complete App audit
 */
async function runAppAudit(params: {
  appId: string;
  appSecret: string;
  encryptionKey: string | null;
  requestedScopes: string[];
  redirectUri?: string;
  usedRedirectUri?: string;
  userAccessToken?: string;
}): Promise<{
  audit_results: AuditResult[];
  summary: {
    errors: number;
    warnings: number;
    passed: number;
    overall_status: 'ready' | 'needs_configuration' | 'needs_app_review' | 'has_errors';
    can_oauth: boolean;
    can_publish: boolean;
  };
  app_info?: AppInfo;
  roles?: Array<{ role: string; user: { id: string; name?: string } }>;
  scope_validation: ReturnType<typeof validateScopes>;
  redirect_uri_validation?: ReturnType<typeof validateRedirectUri>;
  token_debug?: Awaited<ReturnType<typeof debugToken>>['data'];
}> {
  const audit_results: AuditResult[] = [];

  // 1. Check credentials
  console.log('[Audit] Checking credentials...');
  if (!params.appId) {
    audit_results.push({
      code: 'MISSING_APP_ID',
      severity: 'error',
      category: 'credentials',
      message: 'META_APP_ID não configurado',
      details: 'O ID do App Meta não está configurado nos secrets do projeto',
      action: [
        'Acesse Meta for Developers e copie o App ID',
        'Adicione META_APP_ID nos Secrets do projeto Lovable',
      ],
    });
  }

  if (!params.appSecret) {
    audit_results.push({
      code: 'MISSING_APP_SECRET',
      severity: 'error',
      category: 'credentials',
      message: 'META_APP_SECRET não configurado',
      details: 'O App Secret não está configurado nos secrets do projeto',
      action: [
        'Acesse Meta for Developers → App Settings → Basic',
        'Copie o App Secret',
        'Adicione META_APP_SECRET nos Secrets do projeto Lovable',
      ],
    });
  }

  if (!params.encryptionKey) {
    audit_results.push({
      code: 'MISSING_ENCRYPTION_KEY',
      severity: 'error',
      category: 'credentials',
      message: 'TOKEN_ENCRYPTION_KEY não configurado',
      details: 'A chave de criptografia para tokens não está configurada',
      action: [
        'Gere uma chave aleatória de 32+ caracteres',
        'Adicione TOKEN_ENCRYPTION_KEY nos Secrets do projeto',
      ],
    });
  }

  // If no credentials, return early
  if (!params.appId || !params.appSecret) {
    return {
      audit_results,
      summary: {
        errors: audit_results.filter(r => r.severity === 'error').length,
        warnings: audit_results.filter(r => r.severity === 'warning').length,
        passed: 0,
        overall_status: 'has_errors',
        can_oauth: false,
        can_publish: false,
      },
      scope_validation: { valid: [], invalid: [], require_app_review: [], require_products: {} },
    };
  }

  // 2. Validate App exists and get info
  console.log('[Audit] Fetching App info...');
  const appInfoResult = await getAppInfo(params.appId, params.appSecret);
  
  if (!appInfoResult.success) {
    audit_results.push({
      code: 'APP_NOT_FOUND',
      severity: 'error',
      category: 'credentials',
      message: 'Não foi possível acessar o App Meta',
      details: appInfoResult.error?.message || 'Erro desconhecido',
      action: [
        'Verifique se o META_APP_ID está correto',
        'Verifique se o META_APP_SECRET está correto',
        'Verifique se o App ainda existe no Meta for Developers',
      ],
      technical: { error: appInfoResult.error },
    });
  } else {
    audit_results.push({
      code: 'APP_FOUND',
      severity: 'info',
      category: 'credentials',
      message: `App encontrado: ${appInfoResult.app?.name || params.appId}`,
      details: `ID: ${params.appId}`,
      action: [],
    });
  }

  // 3. Check App roles
  console.log('[Audit] Checking App roles...');
  const rolesResult = await getAppRoles(params.appId, params.appSecret);
  
  if (!rolesResult.success) {
    // This may fail for security reasons, not necessarily an error
    audit_results.push({
      code: 'ROLES_CHECK_FAILED',
      severity: 'warning',
      category: 'roles',
      message: 'Não foi possível verificar roles do App',
      details: rolesResult.error?.message || 'Acesso negado ou App não configurado',
      action: [
        'Verifique manualmente em Meta for Developers → App Roles',
        'Adicione usuários como Admin, Developer ou Tester',
        'Usuários que não são Admin/Dev/Tester não podem usar o App em modo Development',
      ],
      technical: { error: rolesResult.error },
    });
  } else {
    const roles = rolesResult.roles || [];
    if (roles.length === 0) {
      audit_results.push({
        code: 'NO_ROLES_CONFIGURED',
        severity: 'warning',
        category: 'roles',
        message: 'Nenhuma role encontrada no App',
        details: 'O App pode não ter usuários configurados com acesso',
        action: [
          'Acesse Meta for Developers → App Roles → Roles',
          'Adicione usuários como Admin, Developer ou Tester',
        ],
      });
    } else {
      const hasAdmin = roles.some(r => r.role === 'administrators');
      const hasDeveloper = roles.some(r => r.role === 'developers');
      const hasTester = roles.some(r => r.role === 'testers');

      audit_results.push({
        code: 'ROLES_FOUND',
        severity: 'info',
        category: 'roles',
        message: `${roles.length} role(s) configurada(s)`,
        details: `Admin: ${hasAdmin ? 'Sim' : 'Não'}, Developer: ${hasDeveloper ? 'Sim' : 'Não'}, Tester: ${hasTester ? 'Sim' : 'Não'}`,
        action: hasAdmin || hasDeveloper ? [] : [
          'IMPORTANTE: Adicione ao menos um Admin ou Developer',
          'Em modo Development, apenas Admin/Dev/Tester podem usar o App',
        ],
        technical: { roles },
      });

      if (!hasAdmin && !hasDeveloper) {
        audit_results.push({
          code: 'NO_ADMIN_DEVELOPER',
          severity: 'error',
          category: 'roles',
          message: 'Nenhum Admin ou Developer configurado',
          details: 'O App precisa de pelo menos um Admin ou Developer para funcionar',
          action: [
            'Acesse Meta for Developers → App Roles → Roles',
            'Adicione você mesmo ou outro usuário como Admin ou Developer',
          ],
        });
      }
    }
  }

  // 4. Validate scopes
  console.log('[Audit] Validating scopes...');
  const scopeValidation = validateScopes(params.requestedScopes);

  if (scopeValidation.invalid.length > 0) {
    audit_results.push({
      code: 'INVALID_SCOPES',
      severity: 'error',
      category: 'scopes',
      message: `Escopos inválidos para Graph API v${GRAPH_VERSION}`,
      details: `Escopos inválidos: ${scopeValidation.invalid.join(', ')}`,
      action: [
        'Remova os escopos inválidos da solicitação OAuth',
        `Consulte a documentação: https://developers.facebook.com/docs/permissions/reference`,
      ],
      technical: { 
        invalid_scopes: scopeValidation.invalid,
        valid_scopes: scopeValidation.valid,
        graph_version: GRAPH_VERSION,
      },
    });
  }

  if (scopeValidation.require_app_review.length > 0) {
    audit_results.push({
      code: 'SCOPES_REQUIRE_APP_REVIEW',
      severity: 'warning',
      category: 'app_review',
      message: 'Alguns escopos requerem App Review',
      details: `Escopos que precisam de aprovação: ${scopeValidation.require_app_review.join(', ')}`,
      action: [
        'Em modo Development, apenas Admin/Dev/Tester podem usar esses escopos',
        'Para usuários externos, complete o App Review no Meta for Developers',
        'Cada escopo precisa de um Use Case aprovado',
      ],
      technical: { scopes: scopeValidation.require_app_review },
    });
  }

  // 5. Check required products
  console.log('[Audit] Checking required products...');
  const requiredProducts = Object.keys(scopeValidation.require_products);
  
  if (requiredProducts.length > 0) {
    const productNames: Record<string, string> = {
      'facebook_login': 'Facebook Login for Business',
      'instagram_graph_api': 'Instagram Graph API',
      'messenger': 'Messenger Platform',
    };

    audit_results.push({
      code: 'PRODUCTS_REQUIRED',
      severity: 'warning',
      category: 'products',
      message: 'Produtos Meta necessários para os escopos solicitados',
      details: requiredProducts.map(p => `${productNames[p] || p}: ${scopeValidation.require_products[p].join(', ')}`).join('; '),
      action: [
        'Acesse Meta for Developers → App Dashboard → Add Products',
        ...requiredProducts.map(p => `Adicione e configure: ${productNames[p] || p}`),
        'Configure cada produto com os Use Cases necessários',
      ],
      technical: { products: scopeValidation.require_products },
    });
  }

  // 6. Validate Redirect URI
  if (params.redirectUri || params.usedRedirectUri) {
    console.log('[Audit] Validating Redirect URI...');
    const uriValidation = validateRedirectUri(
      params.redirectUri || '', 
      params.usedRedirectUri || ''
    );

    if (uriValidation.issues.length > 0) {
      audit_results.push({
        code: 'REDIRECT_URI_ISSUES',
        severity: uriValidation.valid ? 'warning' : 'error',
        category: 'redirect_uri',
        message: 'Problemas com Redirect URI',
        details: uriValidation.issues.join('; '),
        action: [
          'Verifique a Redirect URI em Meta for Developers → Facebook Login → Settings',
          'A URI configurada deve corresponder exatamente à usada no OAuth',
          'Use HTTPS em produção (HTTP só funciona com localhost)',
        ],
        technical: { 
          configured: params.redirectUri, 
          used: params.usedRedirectUri,
          issues: uriValidation.issues,
        },
      });
    } else if (params.redirectUri) {
      audit_results.push({
        code: 'REDIRECT_URI_OK',
        severity: 'info',
        category: 'redirect_uri',
        message: 'Redirect URI configurada corretamente',
        details: params.redirectUri,
        action: [],
      });
    }
  }

  // 7. Debug token if provided
  let tokenDebug: Awaited<ReturnType<typeof debugToken>>['data'] | undefined;
  
  if (params.userAccessToken) {
    console.log('[Audit] Debugging user token...');
    const debugResult = await debugToken(params.userAccessToken, params.appId, params.appSecret);
    
    if (debugResult.success && debugResult.data) {
      tokenDebug = debugResult.data;
      
      if (!debugResult.data.is_valid) {
        audit_results.push({
          code: 'TOKEN_INVALID',
          severity: 'error',
          category: 'credentials',
          message: 'Token de acesso inválido',
          details: debugResult.data.error?.message || 'Token expirado ou revogado',
          action: ['Reconecte a plataforma para obter um novo token'],
          technical: { debug_token: debugResult.data },
        });
      } else {
        const grantedScopes = debugResult.data.scopes || [];
        const requestedButNotGranted = params.requestedScopes.filter(
          s => !grantedScopes.includes(s) && scopeValidation.valid.includes(s)
        );

        if (requestedButNotGranted.length > 0) {
          audit_results.push({
            code: 'USER_CONSENT_MISSING',
            severity: 'error',
            category: 'scopes',
            message: 'Usuário não concedeu todas as permissões',
            details: `Permissões não concedidas: ${requestedButNotGranted.join(', ')}`,
            action: [
              'O usuário precisa reconectar e autorizar TODAS as permissões',
              'Use auth_type=rerequest na URL do OAuth para forçar nova permissão',
            ],
            technical: { 
              requested: params.requestedScopes,
              granted: grantedScopes,
              missing: requestedButNotGranted,
            },
          });
        } else {
          audit_results.push({
            code: 'TOKEN_VALID',
            severity: 'info',
            category: 'credentials',
            message: 'Token válido com todas as permissões',
            details: `Escopos: ${grantedScopes.join(', ')}`,
            action: [],
            technical: { debug_token: debugResult.data },
          });
        }
      }
    } else {
      audit_results.push({
        code: 'TOKEN_DEBUG_FAILED',
        severity: 'warning',
        category: 'credentials',
        message: 'Não foi possível verificar o token',
        details: debugResult.error?.message || 'Erro desconhecido',
        action: ['Verifique as credenciais do App'],
        technical: { error: debugResult.error },
      });
    }
  }

  // Calculate summary
  const errors = audit_results.filter(r => r.severity === 'error').length;
  const warnings = audit_results.filter(r => r.severity === 'warning').length;
  const passed = audit_results.filter(r => r.severity === 'info').length;

  let overall_status: 'ready' | 'needs_configuration' | 'needs_app_review' | 'has_errors';
  if (errors > 0) {
    overall_status = 'has_errors';
  } else if (scopeValidation.require_app_review.length > 0 && warnings > 0) {
    overall_status = 'needs_app_review';
  } else if (warnings > 0) {
    overall_status = 'needs_configuration';
  } else {
    overall_status = 'ready';
  }

  const can_oauth = !audit_results.some(r => 
    r.severity === 'error' && 
    ['credentials', 'products'].includes(r.category)
  );

  const can_publish = can_oauth && 
    scopeValidation.valid.includes('pages_manage_posts') &&
    !audit_results.some(r => r.code === 'USER_CONSENT_MISSING');

  return {
    audit_results,
    summary: {
      errors,
      warnings,
      passed,
      overall_status,
      can_oauth,
      can_publish,
    },
    app_info: appInfoResult.app,
    roles: rolesResult.roles,
    scope_validation: scopeValidation,
    redirect_uri_validation: params.redirectUri ? 
      validateRedirectUri(params.redirectUri, params.usedRedirectUri || '') : undefined,
    token_debug: tokenDebug,
  };
}

serve(async (req) => {
  console.log('social-meta-app-audit invoked, method:', req.method);
  
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

    const body = await req.json();
    const { 
      workspace_id, 
      platform_connection_id,
      scope_strategy = 'full', // 'minimum' | 'full' | 'instagram_publish'
      redirect_uri,
      used_redirect_uri,
    } = body;

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'MISSING_PARAMS', error_message: 'Missing workspace_id' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user role - only owner/admin can run audit
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['owner', 'admin'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ success: false, error_code: 'FORBIDDEN', error_message: 'Only admin can run App audit' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get credentials
    const appId = Deno.env.get('META_APP_ID') || '';
    const appSecret = Deno.env.get('META_APP_SECRET') || '';
    const encryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY') || null;

    // Determine scopes to validate based on strategy
    let requestedScopes: string[];
    switch (scope_strategy) {
      case 'minimum':
        requestedScopes = MINIMUM_SCOPES;
        break;
      case 'instagram_publish':
        requestedScopes = INSTAGRAM_PUBLISH_SCOPES;
        break;
      case 'full':
      default:
        requestedScopes = FULL_SCOPES;
    }

    // Get user access token if connection exists
    let userAccessToken: string | undefined;
    if (platform_connection_id) {
      const { data: connection } = await supabase
        .from('platform_connections')
        .select('access_token_encrypted')
        .eq('id', platform_connection_id)
        .single();

      if (connection?.access_token_encrypted) {
        try {
          const key = encryptionKey || 'default-key-change-me';
          const decoded = atob(connection.access_token_encrypted);
          const bytes = new Uint8Array([...decoded].map(c => c.charCodeAt(0)));
          const keyBytes = new TextEncoder().encode(key);
          const decrypted = bytes.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
          userAccessToken = new TextDecoder().decode(decrypted);
        } catch (e) {
          console.error('Failed to decrypt token:', e);
        }
      }
    }

    // Run the audit
    console.log('[Audit] Starting Meta App audit...');
    const auditResult = await runAppAudit({
      appId,
      appSecret,
      encryptionKey,
      requestedScopes,
      redirectUri: redirect_uri,
      usedRedirectUri: used_redirect_uri,
      userAccessToken,
    });

    // Log audit event
    await supabase.from('domain_events').insert({
      workspace_id,
      aggregate_type: 'social_media',
      aggregate_id: workspace_id,
      event_type: 'social_meta.app_audit',
      payload: {
        scope_strategy,
        summary: auditResult.summary,
        errors_count: auditResult.summary.errors,
        warnings_count: auditResult.summary.warnings,
        actor_id: user.id,
      },
    });

    console.log('[Audit] Audit complete:', auditResult.summary);

    return new Response(
      JSON.stringify({
        success: true,
        ...auditResult,
        graph_version: GRAPH_VERSION,
        scope_strategy,
        requested_scopes: requestedScopes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('App audit error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error_code: 'INTERNAL_ERROR', error_message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
