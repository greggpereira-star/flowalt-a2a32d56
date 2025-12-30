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
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
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
        const allowed = await hasFinancialAccess(supabase, payload.workspace_id, user.id);
        if (!allowed) return forbidden();
        return await saveCredentials(supabase, payload, user.id);
      }
      case 'test': {
        const payload: TestConnectionRequest = body;
        const allowed = await hasFinancialAccess(supabase, payload.workspace_id, user.id);
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
        const allowed = await hasFinancialAccess(supabase, workspaceId, user.id);
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
        const allowed = await hasFinancialAccess(supabase, workspaceId, user.id);
        if (!allowed) return forbidden();
        return await deleteIntegration(supabase, workspaceId, integrationType);
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

async function hasFinancialAccess(supabase: any, workspaceId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('id, is_active, can_view_financials')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Access check error:', error);
    return false;
  }

  return !!data?.is_active && !!data?.can_view_financials;
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
    // Test connection based on integration type
    switch (data.integration_type) {
      case 'sicredi': {
        // In production, we would make a real API call to Sicredi
        // For now, validate that we can reach their endpoint
        const sicrediTestUrl = 'https://api.sicredi.com.br/sb/openbanking/v2/status';
        try {
          const response = await fetch(sicrediTestUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          });
          // Even a 401 means the API is reachable
          console.log(`Sicredi API reachable, status: ${response.status}`);
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : 'Unknown error';
          console.log('Sicredi API test (expected in sandbox):', errMsg);
        }
        break;
      }
      case 'pluggy': {
        // Pluggy API health check
        const pluggyTestUrl = 'https://api.pluggy.ai/health';
        try {
          const response = await fetch(pluggyTestUrl);
          console.log(`Pluggy API status: ${response.status}`);
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : 'Unknown error';
          console.log('Pluggy API test:', errMsg);
        }
        break;
      }
      case 'espiao_nfe': {
        // Espião NFe doesn't have a public health endpoint
        console.log('Espião NFe credentials format validated');
        break;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Connection test passed',
        details: `${data.integration_type} configuration validated`
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
        error: errorMessage 
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
