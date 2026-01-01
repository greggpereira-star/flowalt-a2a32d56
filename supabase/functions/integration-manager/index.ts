import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntegrationCredentials {
  integration_type: 'sicredi' | 'pluggy' | 'espiao_nfe';
  credentials: Record<string, string>;
  workspace_id: string;
}

interface TestConnectionRequest {
  integration_type: string;
  workspace_id: string;
  credentials?: Record<string, string>;
}


serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use anon client with user's token to validate the JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Verify user with their token
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Sessão expirada. Faça login novamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const actionFromPath = url.pathname.split('/').pop();

    // Prefer body.action (works with supabase-js invoke), but keep path-based actions for backwards compatibility.
    let body: any = {};
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    }

    const action = (body?.action as string | undefined) && body.action !== ''
      ? body.action
      : (actionFromPath && actionFromPath !== 'integration-manager' ? actionFromPath : undefined);

    console.log(`Integration Manager: Action=${action || 'none'}, User=${user.id}`);

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Missing action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route based on action
    switch (action) {
      case 'save': {
        const payload: IntegrationCredentials = body;
        const allowed = await hasIntegrationAdminAccess(supabase, payload.workspace_id, user.id);
        if (!allowed) return forbidden();
        return await saveCredentials(supabase, payload, user.id);
      }
      case 'test': {
        const payload: TestConnectionRequest = body;
        const allowed = await hasIntegrationAdminAccess(supabase, payload.workspace_id, user.id);
        if (!allowed) return forbidden();
        return await testConnection(payload);
      }
      case 'status': {
        const workspaceId = (body?.workspace_id as string | undefined) || url.searchParams.get('workspace_id') || '';
        if (!workspaceId) {
          return new Response(
            JSON.stringify({ error: 'workspace_id required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const allowed = await hasIntegrationAdminAccess(supabase, workspaceId, user.id);
        if (!allowed) return forbidden();
        return await getIntegrationStatus(supabase, workspaceId);
      }
      case 'delete': {
        const workspaceId = body?.workspace_id as string;
        const integrationType = body?.integration_type as string;
        if (!workspaceId || !integrationType) {
          return new Response(
            JSON.stringify({ error: 'workspace_id and integration_type required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const allowed = await hasIntegrationAdminAccess(supabase, workspaceId, user.id);
        if (!allowed) return forbidden();
        return await deleteIntegration(supabase, workspaceId, integrationType);
      }
      case 'dda_sync': {
        const workspaceId = body?.workspace_id as string;
        if (!workspaceId) {
          return new Response(
            JSON.stringify({ error: 'workspace_id required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const allowed = await hasIntegrationAdminAccess(supabase, workspaceId, user.id);
        if (!allowed) return forbidden();
        return await ddaSyncBoletos(supabase, workspaceId, user.id);
      }
      case 'dda_manual_add': {
        const workspaceId = body?.workspace_id as string;
        const boletoData = body?.boleto_data as Record<string, unknown> | undefined;
        if (!workspaceId || !boletoData) {
          return new Response(
            JSON.stringify({ error: 'workspace_id and boleto_data required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const allowed = await hasIntegrationAdminAccess(supabase, workspaceId, user.id);
        if (!allowed) return forbidden();
        return await ddaAddManualBoleto(supabase, workspaceId, boletoData, user.id);
      }
      case 'pluggy_connect_token': {
        const workspaceId = body?.workspace_id as string;
        if (!workspaceId) {
          return new Response(
            JSON.stringify({ error: 'workspace_id required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const allowed = await hasIntegrationAdminAccess(supabase, workspaceId, user.id);
        if (!allowed) return forbidden();

        const requestOrigin = req.headers.get('origin') || req.headers.get('referer');
        return await createPluggyConnectToken(supabase, workspaceId, requestOrigin);
      }
      case 'pluggy_save_item': {
        const workspaceId = body?.workspace_id as string;
        const itemId = body?.item_id as string;
        const connectorName = body?.connector_name as string | undefined;
        if (!workspaceId || !itemId) {
          return new Response(
            JSON.stringify({ error: 'workspace_id and item_id required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const allowed = await hasIntegrationAdminAccess(supabase, workspaceId, user.id);
        if (!allowed) return forbidden();
        return await savePluggyItem(supabase, workspaceId, itemId, connectorName, user.id);
      }
      case 'pluggy_list_items': {
        const workspaceId = body?.workspace_id as string;
        if (!workspaceId) {
          return new Response(
            JSON.stringify({ error: 'workspace_id required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const allowed = await hasIntegrationAdminAccess(supabase, workspaceId, user.id);
        if (!allowed) return forbidden();
        return await listPluggyItems(supabase, workspaceId);
      }
      case 'pluggy_delete_item': {
        const workspaceId = body?.workspace_id as string;
        const itemId = body?.item_id as string;
        if (!workspaceId || !itemId) {
          return new Response(
            JSON.stringify({ error: 'workspace_id and item_id required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const allowed = await hasIntegrationAdminAccess(supabase, workspaceId, user.id);
        if (!allowed) return forbidden();
        return await deletePluggyItem(supabase, workspaceId, itemId);
      }
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Integration Manager Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function forbidden(): Response {
  return new Response(
    JSON.stringify({ error: 'Forbidden' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function hasIntegrationAdminAccess(supabase: any, workspaceId: string, userId: string): Promise<boolean> {
  const [{ data: member, error: memberError }, { data: roleRow, error: roleError }] = await Promise.all([
    supabase
      .from('workspace_members')
      .select('id, is_active, can_view_financials')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_roles')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (memberError) console.error('Access check (member) error:', memberError);
  if (roleError) console.error('Access check (role) error:', roleError);

  const hasMemberAccess = !!member?.is_active && !!member?.can_view_financials;
  const role = (roleRow?.role as string | undefined) || '';
  const hasRoleAccess = ['owner', 'admin', 'super_admin'].includes(role);

  return hasMemberAccess || hasRoleAccess;
}

async function saveCredentials(
  supabase: any,
  data: IntegrationCredentials,
  userId: string
): Promise<Response> {
  console.log(`Saving credentials for ${data.integration_type} in workspace ${data.workspace_id}`);

  // Validate required fields based on integration type
  const requiredFields = getRequiredFields(data.integration_type);
  const missingFields = requiredFields.filter(f => !data.credentials[f]);
  
  if (missingFields.length > 0) {
    return new Response(
      JSON.stringify({ 
        error: 'Missing required fields', 
        missing: missingFields 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Store credentials in integration_credentials table (encrypted at rest by Supabase)
  const { error: upsertError } = await supabase
    .from('integration_credentials')
    .upsert({
      workspace_id: data.workspace_id,
      integration_type: data.integration_type,
      credentials: data.credentials, // Will be encrypted
      is_active: true,
      configured_by: userId,
      configured_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'workspace_id,integration_type'
    });

  if (upsertError) {
    console.error('Error saving credentials:', upsertError);
    return new Response(
      JSON.stringify({ error: 'Failed to save credentials' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Log the configuration action
  await supabase.from('audit_logs').insert({
    workspace_id: data.workspace_id,
    user_id: userId,
    action: 'integration_configured',
    entity_type: 'integration',
    entity_id: data.integration_type,
    metadata: { 
      integration_type: data.integration_type,
      ambiente: data.credentials.ambiente || 'production'
    }
  });

  console.log(`Successfully saved credentials for ${data.integration_type}`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Credentials saved successfully' 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function testConnection(data: TestConnectionRequest): Promise<Response> {
  console.log(`Testing connection for ${data.integration_type}`);

  try {
    // Validate that required credentials were provided (without logging secrets)
    const requiredFields = getRequiredFields(data.integration_type);
    const creds = data.credentials || {};
    const missingFields = requiredFields.filter((f) => !creds[f]);

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Credenciais incompletas para testar a conexão',
          missing: missingFields,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test connection based on integration type (reachability checks + basic validation)
    switch (data.integration_type) {
      case 'sicredi': {
        const sicrediTestUrl = 'https://api.sicredi.com.br/sb/openbanking/v2/status';
        try {
          const response = await fetch(sicrediTestUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });
          console.log(`Sicredi API reachable, status: ${response.status}`);
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : 'Unknown error';
          console.log('Sicredi API test (reachability):', errMsg);
        }
        break;
      }
      case 'pluggy': {
        const pluggyTestUrl = 'https://api.pluggy.ai/health';
        try {
          const response = await fetch(pluggyTestUrl);
          console.log(`Pluggy API status: ${response.status}`);
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : 'Unknown error';
          console.log('Pluggy API test (reachability):', errMsg);
        }
        break;
      }
      case 'espiao_nfe': {
        // Basic format sanity-check only
        const cnpj = String(creds.cnpj || '').replace(/\D/g, '');
        if (cnpj.length !== 14) {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'CNPJ inválido (precisa ter 14 dígitos)',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        break;
      }
      default:
        break;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Validação inicial OK. As credenciais foram recebidas com segurança.',
        details: `${data.integration_type} ready`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Connection test failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Connection test failed',
        error: errorMessage,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function getIntegrationStatus(supabase: any, workspaceId: string): Promise<Response> {
  console.log(`Getting integration status for workspace ${workspaceId}`);

  const { data, error } = await supabase
    .from('integration_credentials')
    .select('integration_type, is_active, configured_at, updated_at, last_sync_at, sync_status')
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error fetching status:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch integration status' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const statusMap: Record<string, any> = {};
  for (const item of data || []) {
    statusMap[item.integration_type] = {
      is_active: item.is_active,
      configured_at: item.configured_at,
      updated_at: item.updated_at,
      last_sync_at: item.last_sync_at,
      sync_status: item.sync_status,
    };
  }

  return new Response(
    JSON.stringify({ integrations: statusMap }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function deleteIntegration(
  supabase: any, 
  workspaceId: string, 
  integrationType: string
): Promise<Response> {
  console.log(`Deleting integration ${integrationType} from workspace ${workspaceId}`);

  const { error } = await supabase
    .from('integration_credentials')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('integration_type', integrationType);

  if (error) {
    console.error('Error deleting integration:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete integration' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Integration deleted' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function getRequiredFields(integrationType: string): string[] {
  switch (integrationType) {
    case 'sicredi':
      return ['client_id', 'client_secret', 'beneficiario_codigo', 'ambiente'];
    case 'pluggy':
      return ['client_id', 'client_secret'];
    case 'espiao_nfe':
      return ['api_token', 'cnpj'];
    default:
      return [];
  }
}

// =====================
// DDA (Pluggy bills) API
// =====================

function mapPluggyStatusToInternal(pluggyStatus: string): string {
  switch (pluggyStatus?.toLowerCase()) {
    case 'paid':
    case 'pago':
      return 'paid';
    case 'pending':
    case 'aberto':
    case 'open':
      return 'pending';
    case 'overdue':
    case 'vencido':
      return 'expired';
    case 'cancelled':
    case 'cancelado':
      return 'cancelled';
    default:
      return 'pending';
  }
}

async function logDdaSync(
  supabase: any,
  workspaceId: string,
  userId: string,
  status: 'success' | 'error' | 'partial',
  found: number,
  newCount: number,
  updated: number,
  errorMessage?: string
): Promise<void> {
  await supabase.from('dda_sync_logs').insert({
    workspace_id: workspaceId,
    synced_by: userId,
    status,
    boletos_found: found,
    boletos_new: newCount,
    boletos_updated: updated,
    error_message: errorMessage,
    source: 'pluggy'
  });
}

async function ddaSyncBoletos(
  supabase: any,
  workspaceId: string,
  userId: string
): Promise<Response> {
  console.log(`DDA: Starting sync for workspace ${workspaceId}`);

  // Get Pluggy credentials
  const { data: credentials, error: credError } = await supabase
    .from('integration_credentials')
    .select('credentials')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'pluggy')
    .eq('is_active', true)
    .maybeSingle();

  if (credError || !credentials?.credentials) {
    await logDdaSync(supabase, workspaceId, userId, 'error', 0, 0, 0, 'Pluggy não configurado');

    return new Response(
      JSON.stringify({
        error: 'Pluggy não configurado. Configure a integração em Configurações > Conectores.'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { client_id, client_secret } = credentials.credentials as {
    client_id: string;
    client_secret: string;
  };

  try {
    // Step 1: Get Pluggy API key
    const authResponse = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client_id, clientSecret: client_secret })
    });

    if (!authResponse.ok) {
      const authError = await authResponse.text();
      console.error('DDA: Pluggy auth failed:', authError);
      await logDdaSync(supabase, workspaceId, userId, 'error', 0, 0, 0, 'Falha na autenticação Pluggy');

      return new Response(
        JSON.stringify({ error: 'Falha na autenticação com Pluggy. Verifique suas credenciais.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authData = await authResponse.json();
    const apiKey = authData.apiKey;

    // Step 2: Get connected items from our database (not from Pluggy API /items)
    // The /items endpoint only returns items created in the current API session,
    // but user connected via Pluggy Connect which uses a connect token.
    // We must fetch item IDs from our pluggy_items table and query each one directly.
    const { data: savedItems, error: savedItemsError } = await supabase
      .from('pluggy_items')
      .select('pluggy_item_id, connector_name')
      .eq('workspace_id', workspaceId)
      .eq('status', 'connected');

    if (savedItemsError) {
      console.error('DDA: Failed to fetch saved Pluggy items from database:', savedItemsError);
      await logDdaSync(supabase, workspaceId, userId, 'error', 0, 0, 0, 'Erro ao buscar contas conectadas');

      return new Response(
        JSON.stringify({ error: 'Erro ao buscar contas bancárias conectadas.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!savedItems || savedItems.length === 0) {
      console.log('DDA: No connected bank accounts found in database');
      await logDdaSync(supabase, workspaceId, userId, 'error', 0, 0, 0, 'Nenhuma conta bancária conectada');

      return new Response(
        JSON.stringify({
          error: 'Nenhuma conta bancária conectada. Conecte uma conta no Pluggy.',
          needsConnection: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`DDA: Found ${savedItems.length} connected bank account(s) in database`);

    // Fetch each item from Pluggy API to get fresh data
    const items: Array<{ id: string; connector?: { name?: string } }> = [];
    for (const savedItem of savedItems) {
      try {
        const itemResponse = await fetch(`https://api.pluggy.ai/items/${savedItem.pluggy_item_id}`, {
          headers: { 'X-API-KEY': apiKey }
        });

        if (itemResponse.ok) {
          const itemData = await itemResponse.json();
          items.push(itemData);
          console.log(`DDA: Successfully fetched item ${savedItem.pluggy_item_id} (${savedItem.connector_name})`);
        } else {
          const errorText = await itemResponse.text();
          console.error(`DDA: Failed to fetch item ${savedItem.pluggy_item_id}:`, errorText);
          
          // If item not found (404), mark as disconnected in our database
          if (itemResponse.status === 404) {
            await supabase
              .from('pluggy_items')
              .update({ status: 'disconnected', updated_at: new Date().toISOString() })
              .eq('pluggy_item_id', savedItem.pluggy_item_id)
              .eq('workspace_id', workspaceId);
            console.log(`DDA: Marked item ${savedItem.pluggy_item_id} as disconnected`);
          }
        }
      } catch (itemFetchError) {
        console.error(`DDA: Error fetching item ${savedItem.pluggy_item_id}:`, itemFetchError);
      }
    }

    if (items.length === 0) {
      await logDdaSync(supabase, workspaceId, userId, 'error', 0, 0, 0, 'Não foi possível acessar as contas conectadas');

      return new Response(
        JSON.stringify({
          error: 'Não foi possível acessar as contas bancárias. Tente reconectar.',
          needsConnection: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`DDA: Processing ${items.length} valid bank account(s)`)

    // Step 3: Fetch boletos from each item
    let totalBoletos = 0;
    let newBoletos = 0;
    let updatedBoletos = 0;

    const allBoletos: any[] = [];

    for (const item of items) {
      try {
        const boletosResponse = await fetch(`https://api.pluggy.ai/items/${item.id}/bills`, {
          headers: { 'X-API-KEY': apiKey }
        });

        if (!boletosResponse.ok) continue;

        const boletosData = await boletosResponse.json();
        const boletos = boletosData.results || [];

        for (const boleto of boletos) {
          totalBoletos++;

          allBoletos.push({
            workspace_id: workspaceId,
            created_by: userId,
            external_id: boleto.id,
            barcode: boleto.barcode || null,
            digitable_line: boleto.digitableLine || null,
            cedente_nome: boleto.payee?.name || 'Não informado',
            cedente_documento: boleto.payee?.documentNumber || null,
            cedente_banco: boleto.payee?.bankCode || null,
            cedente_agencia: boleto.payee?.branchNumber || null,
            cedente_conta: boleto.payee?.accountNumber || null,
            sacado_nome: boleto.payer?.name || null,
            sacado_documento: boleto.payer?.documentNumber || null,
            valor_original: boleto.amount || 0,
            valor_atualizado: (boleto.amount || 0) + (boleto.fine || 0) + (boleto.interest || 0),
            valor_desconto: boleto.discount || 0,
            data_emissao: boleto.issueDate || null,
            data_vencimento: boleto.dueDate,
            status: mapPluggyStatusToInternal(boleto.status),
            source: 'pluggy',
            synced_at: new Date().toISOString(),
            metadata: {
              pluggy_item_id: item.id,
              pluggy_connector: item.connector?.name,
              original_status: boleto.status,
            },
          });
        }
      } catch (itemError) {
        console.error(`DDA: Error fetching boletos for item ${item.id}:`, itemError);
      }
    }

    // Step 4: Upsert rows
    for (const boleto of allBoletos) {
      const { data: existing } = await supabase
        .from('dda_boletos')
        .select('id, status')
        .eq('workspace_id', workspaceId)
        .eq('external_id', boleto.external_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('dda_boletos')
          .update({
            valor_atualizado: boleto.valor_atualizado,
            status: boleto.status === 'pending' ? existing.status : boleto.status,
            synced_at: boleto.synced_at,
            metadata: boleto.metadata,
          })
          .eq('id', existing.id);

        updatedBoletos++;
      } else {
        await supabase.from('dda_boletos').insert(boleto);
        newBoletos++;
      }
    }

    await supabase
      .from('integration_credentials')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_status: 'success'
      })
      .eq('workspace_id', workspaceId)
      .eq('integration_type', 'pluggy');

    await logDdaSync(supabase, workspaceId, userId, 'success', totalBoletos, newBoletos, updatedBoletos);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronização concluída',
        boletos_found: totalBoletos,
        boletos_new: newBoletos,
        boletos_updated: updatedBoletos,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (syncError: unknown) {
    const errorMsg = syncError instanceof Error ? syncError.message : 'Erro desconhecido';
    console.error('DDA: Sync error:', syncError);

    await logDdaSync(supabase, workspaceId, userId, 'error', 0, 0, 0, errorMsg);

    return new Response(
      JSON.stringify({ error: `Erro na sincronização: ${errorMsg}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function ddaAddManualBoleto(
  supabase: any,
  workspaceId: string,
  boletoData: Record<string, unknown>,
  userId: string
): Promise<Response> {
  const { error } = await supabase
    .from('dda_boletos')
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      source: 'manual',
      status: 'pending',
      cedente_nome: (boletoData.cedente_nome as string) || 'Não informado',
      valor_original: (boletoData.valor_original as number) || 0,
      data_vencimento: boletoData.data_vencimento as string,
      ...boletoData,
    });

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Erro ao adicionar boleto' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Boleto adicionado com sucesso' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// =====================
// Pluggy Connect Token & Items Management
// =====================

async function createPluggyConnectToken(
  supabase: any,
  workspaceId: string,
  requestOrigin?: string | null
): Promise<Response> {
  console.log(`Pluggy: Creating connect token for workspace ${workspaceId}`);

  // Get Pluggy credentials
  const { data: credentials, error: credError } = await supabase
    .from('integration_credentials')
    .select('credentials')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'pluggy')
    .eq('is_active', true)
    .maybeSingle();

  if (credError || !credentials?.credentials) {
    return new Response(
      JSON.stringify({
        error: 'Pluggy não configurado. Configure as credenciais em Configurações > Conectores.'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { client_id, client_secret } = credentials.credentials as {
    client_id: string;
    client_secret: string;
  };

  try {
    // Get API key from Pluggy
    const authResponse = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client_id, clientSecret: client_secret })
    });

    if (!authResponse.ok) {
      console.error('Pluggy: Auth failed');
      return new Response(
        JSON.stringify({ error: 'Falha na autenticação com Pluggy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authData = await authResponse.json();
    const apiKey = authData.apiKey;

    // Some connectors (ex: Nubank) require OAuth in a popup/tab.
    // Pluggy recommends setting oauthRedirectUri when generating the connect token.
    let oauthRedirectUri: string | undefined;
    if (requestOrigin) {
      try {
        const url = new URL(requestOrigin);
        if (url.protocol === 'https:') {
          oauthRedirectUri = `${url.origin}/pluggy/oauth/callback`;
        }
      } catch {
        // ignore invalid origin
      }
    }

    const connectTokenPayload: Record<string, unknown> = {};
    if (oauthRedirectUri) {
      connectTokenPayload.options = { oauthRedirectUri };
      console.log(`Pluggy: Using oauthRedirectUri ${oauthRedirectUri}`);
    } else {
      console.log('Pluggy: No oauthRedirectUri provided (origin not available)');
    }

    // Create connect token
    const tokenResponse = await fetch('https://api.pluggy.ai/connect_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
      },
      body: JSON.stringify(connectTokenPayload)
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error('Pluggy: Failed to create connect token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Falha ao criar token de conexão' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('Pluggy: Connect token created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        accessToken: tokenData.accessToken
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Pluggy: Error creating connect token:', errorMsg);
    return new Response(
      JSON.stringify({ error: `Erro ao criar token: ${errorMsg}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function savePluggyItem(
  supabase: any,
  workspaceId: string,
  itemId: string,
  connectorName: string | undefined,
  userId: string
): Promise<Response> {
  console.log(`Pluggy: Saving item ${itemId} for workspace ${workspaceId}`);

  // Save item to pluggy_items table
  const { error } = await supabase
    .from('pluggy_items')
    .upsert({
      workspace_id: workspaceId,
      pluggy_item_id: itemId,
      connector_name: connectorName || 'Unknown',
      status: 'connected',
      connected_by: userId,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'workspace_id,pluggy_item_id'
    });

  if (error) {
    console.error('Pluggy: Error saving item:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao salvar conexão bancária' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Conta bancária conectada com sucesso' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function listPluggyItems(
  supabase: any,
  workspaceId: string
): Promise<Response> {
  const { data, error } = await supabase
    .from('pluggy_items')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'connected')
    .order('connected_at', { ascending: false });

  if (error) {
    console.error('Pluggy: Error listing items:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao listar conexões bancárias' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ items: data || [] }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function deletePluggyItem(
  supabase: any,
  workspaceId: string,
  itemId: string
): Promise<Response> {
  console.log(`Pluggy: Deleting item ${itemId} from workspace ${workspaceId}`);

  // Get Pluggy credentials to also delete from Pluggy API
  const { data: credentials } = await supabase
    .from('integration_credentials')
    .select('credentials')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'pluggy')
    .eq('is_active', true)
    .maybeSingle();

  if (credentials?.credentials) {
    try {
      const { client_id, client_secret } = credentials.credentials as {
        client_id: string;
        client_secret: string;
      };

      // Get API key
      const authResponse = await fetch('https://api.pluggy.ai/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client_id, clientSecret: client_secret })
      });

      if (authResponse.ok) {
        const authData = await authResponse.json();

        // Delete from Pluggy
        await fetch(`https://api.pluggy.ai/items/${itemId}`, {
          method: 'DELETE',
          headers: { 'X-API-KEY': authData.apiKey }
        });
      }
    } catch (err) {
      console.warn('Pluggy: Failed to delete item from Pluggy API:', err);
    }
  }

  // Mark as disconnected in database
  const { error } = await supabase
    .from('pluggy_items')
    .update({
      status: 'disconnected',
      updated_at: new Date().toISOString()
    })
    .eq('workspace_id', workspaceId)
    .eq('pluggy_item_id', itemId);

  if (error) {
    console.error('Pluggy: Error deleting item:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao remover conexão bancária' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Conexão bancária removida' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
