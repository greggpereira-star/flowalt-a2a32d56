import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PluggyBoleto {
  id: string;
  barcode?: string;
  digitableLine?: string;
  amount: number;
  dueDate: string;
  issueDate?: string;
  payee: {
    name: string;
    documentNumber?: string;
    bankCode?: string;
    branchNumber?: string;
    accountNumber?: string;
  };
  payer?: {
    name?: string;
    documentNumber?: string;
  };
  status: string;
  discount?: number;
  fine?: number;
  interest?: number;
}

interface SyncRequest {
  action: 'sync' | 'status' | 'manual_add';
  workspace_id: string;
  boleto_data?: Partial<DDABoleto>;
}

interface DDABoleto {
  external_id: string | null;
  barcode: string | null;
  digitable_line: string | null;
  cedente_nome: string;
  cedente_documento: string | null;
  cedente_banco: string | null;
  cedente_agencia: string | null;
  cedente_conta: string | null;
  sacado_nome: string | null;
  sacado_documento: string | null;
  valor_original: number;
  valor_atualizado: number | null;
  valor_desconto: number;
  data_emissao: string | null;
  data_vencimento: string;
  status: string;
  source: string;
  synced_at: string;
  metadata: Record<string, unknown>;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth - get token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ code: 401, message: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract token and validate
    const token = authHeader.replace('Bearer ', '');
    if (!token || token.length < 10) {
      console.error('Invalid token format');
      return new Response(
        JSON.stringify({ code: 401, message: 'Invalid token format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user client with the token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError) {
      console.error('Auth error:', authError.message);
      return new Response(
        JSON.stringify({ code: 401, message: 'Invalid JWT', details: authError.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!user) {
      console.error('No user found for token');
      return new Response(
        JSON.stringify({ code: 401, message: 'User not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`DDA Sync: User ${user.id} authenticated successfully`);

    const body: SyncRequest = await req.json();
    const { action, workspace_id, boleto_data } = body;

    // Check user has financial access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('id, can_view_financials')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!member?.can_view_financials) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para acessar dados financeiros' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'sync':
        return await syncBoletos(supabase, workspace_id, user.id);
      
      case 'status':
        return await getSyncStatus(supabase, workspace_id);
      
      case 'manual_add':
        if (!boleto_data) {
          return new Response(
            JSON.stringify({ error: 'boleto_data required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return await addManualBoleto(supabase, workspace_id, boleto_data, user.id);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('DDA Sync Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function syncBoletos(
  supabase: any,
  workspaceId: string,
  userId: string
): Promise<Response> {
  console.log(`Starting DDA sync for workspace ${workspaceId}`);

  // Get Pluggy credentials
  const { data: credentials, error: credError } = await supabase
    .from('integration_credentials')
    .select('credentials')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'pluggy')
    .eq('is_active', true)
    .maybeSingle();

  if (credError || !credentials?.credentials) {
    // Log sync failure
    await logSync(supabase, workspaceId, userId, 'error', 0, 0, 0, 'Pluggy não configurado');
    
    return new Response(
      JSON.stringify({ 
        error: 'Pluggy não configurado. Configure a integração em Configurações > Conectores.' 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { client_id, client_secret } = credentials.credentials as { client_id: string; client_secret: string };

  try {
    // Step 1: Get Pluggy API key
    const authResponse = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client_id, clientSecret: client_secret })
    });

    if (!authResponse.ok) {
      const authError = await authResponse.text();
      console.error('Pluggy auth failed:', authError);
      await logSync(supabase, workspaceId, userId, 'error', 0, 0, 0, 'Falha na autenticação Pluggy');
      
      return new Response(
        JSON.stringify({ error: 'Falha na autenticação com Pluggy. Verifique suas credenciais.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authData = await authResponse.json();
    const apiKey = authData.apiKey;

    // Step 2: Get connected items (bank connections)
    const itemsResponse = await fetch('https://api.pluggy.ai/items', {
      headers: { 'X-API-KEY': apiKey }
    });

    if (!itemsResponse.ok) {
      console.error('Failed to fetch Pluggy items');
      await logSync(supabase, workspaceId, userId, 'error', 0, 0, 0, 'Nenhuma conta bancária conectada');
      
      return new Response(
        JSON.stringify({ 
          error: 'Nenhuma conta bancária conectada. Conecte uma conta no Pluggy.',
          needsConnection: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const itemsData = await itemsResponse.json();
    const items = itemsData.results || [];

    if (items.length === 0) {
      await logSync(supabase, workspaceId, userId, 'success', 0, 0, 0);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma conta bancária conectada no Pluggy',
          boletos_found: 0,
          boletos_new: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Fetch boletos from each connected item
    let totalBoletos = 0;
    let newBoletos = 0;
    let updatedBoletos = 0;
    const allBoletos: DDABoleto[] = [];

    for (const item of items) {
      try {
        // Try to fetch bills/boletos endpoint
        const boletosResponse = await fetch(`https://api.pluggy.ai/items/${item.id}/bills`, {
          headers: { 'X-API-KEY': apiKey }
        });

        if (boletosResponse.ok) {
          const boletosData = await boletosResponse.json();
          const boletos = boletosData.results || [];
          
          for (const boleto of boletos) {
            totalBoletos++;
            
            const ddaBoleto: DDABoleto = {
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
              valor_atualizado: boleto.amount + (boleto.fine || 0) + (boleto.interest || 0),
              valor_desconto: boleto.discount || 0,
              data_emissao: boleto.issueDate || null,
              data_vencimento: boleto.dueDate,
              status: mapPluggyStatus(boleto.status),
              source: 'pluggy',
              synced_at: new Date().toISOString(),
              metadata: {
                pluggy_item_id: item.id,
                pluggy_connector: item.connector?.name,
                original_status: boleto.status
              }
            };
            
            allBoletos.push(ddaBoleto);
          }
        }
      } catch (itemError) {
        console.error(`Error fetching boletos for item ${item.id}:`, itemError);
      }
    }

    // Step 4: Upsert boletos to database
    for (const boleto of allBoletos) {
      const { data: existing } = await supabase
        .from('dda_boletos')
        .select('id, status')
        .eq('workspace_id', workspaceId)
        .eq('external_id', boleto.external_id)
        .maybeSingle();

      if (existing) {
        // Update existing
        await supabase
          .from('dda_boletos')
          .update({
            valor_atualizado: boleto.valor_atualizado,
            status: boleto.status === 'pending' ? existing.status : boleto.status, // Don't override user changes
            synced_at: boleto.synced_at,
            metadata: boleto.metadata
          })
          .eq('id', existing.id);
        
        updatedBoletos++;
      } else {
        // Insert new
        await supabase
          .from('dda_boletos')
          .insert({
            workspace_id: workspaceId,
            created_by: userId,
            ...boleto
          });
        
        newBoletos++;
      }
    }

    // Update last sync timestamp
    await supabase
      .from('integration_credentials')
      .update({ 
        last_sync_at: new Date().toISOString(),
        sync_status: 'success'
      })
      .eq('workspace_id', workspaceId)
      .eq('integration_type', 'pluggy');

    // Log successful sync
    await logSync(supabase, workspaceId, userId, 'success', totalBoletos, newBoletos, updatedBoletos);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronização concluída`,
        boletos_found: totalBoletos,
        boletos_new: newBoletos,
        boletos_updated: updatedBoletos
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (syncError: unknown) {
    const errorMsg = syncError instanceof Error ? syncError.message : 'Erro desconhecido';
    console.error('Sync error:', syncError);
    
    await logSync(supabase, workspaceId, userId, 'error', 0, 0, 0, errorMsg);
    
    return new Response(
      JSON.stringify({ error: `Erro na sincronização: ${errorMsg}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function getSyncStatus(
  supabase: any,
  workspaceId: string
): Promise<Response> {
  const { data: lastSync } = await supabase
    .from('dda_sync_logs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: integration } = await supabase
    .from('integration_credentials')
    .select('is_active, last_sync_at, sync_status')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'pluggy')
    .maybeSingle();

  const { count: pendingCount } = await supabase
    .from('dda_boletos')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending');

  const { count: overdueCount } = await supabase
    .from('dda_boletos')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .lt('data_vencimento', new Date().toISOString().split('T')[0]);

  return new Response(
    JSON.stringify({
      is_configured: !!integration?.is_active,
      last_sync: lastSync,
      pending_boletos: pendingCount || 0,
      overdue_boletos: overdueCount || 0
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function addManualBoleto(
  supabase: any,
  workspaceId: string,
  boletoData: Partial<DDABoleto>,
  userId: string
): Promise<Response> {
  const { error } = await supabase
    .from('dda_boletos')
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      source: 'manual',
      status: 'pending',
      cedente_nome: boletoData.cedente_nome || 'Não informado',
      valor_original: boletoData.valor_original || 0,
      data_vencimento: boletoData.data_vencimento,
      ...boletoData
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

async function logSync(
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

function mapPluggyStatus(pluggyStatus: string): string {
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
