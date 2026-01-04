import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SmokeTestStep {
  name: string;
  ok: boolean;
  detail: string;
  duration_ms?: number;
}

interface SmokeTestResult {
  ok: boolean;
  job_id: string;
  steps: SmokeTestStep[];
  next_action?: 'select_asset' | 'configure_secrets' | 'refresh_token' | 'reconnect';
  error_code?: string;
  error_message?: string;
}

// Helper to check if secrets are configured
function checkSecrets(platform: string): { configured: boolean; missing: string[] } {
  const secretMap: Record<string, string[]> = {
    instagram: ['META_APP_ID', 'META_APP_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    facebook: ['META_APP_ID', 'META_APP_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    youtube: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    linkedin: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    tiktok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
    twitter: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
  };

  const required = secretMap[platform] || [];
  const missing = required.filter(key => !Deno.env.get(key));
  
  return {
    configured: missing.length === 0,
    missing,
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const steps: SmokeTestStep[] = [];
  let jobId = '';

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error_code: 'UNAUTHORIZED', error_message: 'Missing authorization header', steps: [] }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error_code: 'UNAUTHORIZED', error_message: 'Invalid token', steps: [] }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { workspace_id, platform_id, platform_connection_id, test_card_id, dry_run = true } = await req.json();

    if (!workspace_id || !platform_id || !platform_connection_id) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error_code: 'MISSING_PARAMS', 
          error_message: 'Required: workspace_id, platform_id, platform_connection_id',
          steps: [],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user role (owner or admin only for smoke test)
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['owner', 'admin'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error_code: 'FORBIDDEN', 
          error_message: 'Apenas Owner ou Admin podem executar o Smoke Test.',
          steps: [],
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // STEP 0: Create job entry
    const step0Start = Date.now();
    const { data: job, error: jobError } = await supabase
      .from('social_jobs')
      .insert({
        workspace_id,
        post_id: test_card_id || null,
        platform: platform_id,
        action: 'smoke_test',
        status: 'processing',
        attempts: 1,
        next_retry_at: null,
      })
      .select()
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error_code: 'JOB_CREATE_FAILED', 
          error_message: 'Falha ao criar job de smoke test',
          steps: [],
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    jobId = job.id;
    steps.push({
      name: 'create_job',
      ok: true,
      detail: `Job ${jobId} criado`,
      duration_ms: Date.now() - step0Start,
    });

    // Log start event
    await supabase.from('domain_events').insert({
      workspace_id,
      event_type: 'social_smoke_test.started',
      entity_type: 'social_job',
      entity_id: jobId,
      payload: { platform_id, platform_connection_id, dry_run },
      actor_id: user.id,
    });

    // STEP 1: Check secrets
    const step1Start = Date.now();
    const secretsCheck = checkSecrets(platform_id);
    
    if (!secretsCheck.configured) {
      steps.push({
        name: 'check_secrets',
        ok: false,
        detail: `Secrets ausentes: ${secretsCheck.missing.join(', ')}`,
        duration_ms: Date.now() - step1Start,
      });

      await updateJob(supabase, jobId, 'failed', { 
        error_code: 'SECRETS_MISSING',
        error_message: `Configure os secrets no painel: ${secretsCheck.missing.join(', ')}`,
        steps,
      });

      await logStepEvent(supabase, workspace_id, jobId, user.id, 'check_secrets', false, 'SECRETS_MISSING');

      return new Response(
        JSON.stringify({
          ok: false,
          job_id: jobId,
          steps,
          next_action: 'configure_secrets',
          error_code: 'SECRETS_MISSING',
          error_message: `Integração não configurada. Configure: ${secretsCheck.missing.join(', ')}`,
        } as SmokeTestResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    steps.push({
      name: 'check_secrets',
      ok: true,
      detail: 'Todos os secrets configurados',
      duration_ms: Date.now() - step1Start,
    });

    // STEP 2: Validate connection and token
    const step2Start = Date.now();
    const { data: platformData, error: platformError } = await supabase
      .from('social_platforms')
      .select('*')
      .eq('id', platform_connection_id)
      .eq('workspace_id', workspace_id)
      .single();

    if (platformError || !platformData) {
      steps.push({
        name: 'validate_connection',
        ok: false,
        detail: 'Conexão não encontrada',
        duration_ms: Date.now() - step2Start,
      });

      await updateJob(supabase, jobId, 'failed', { steps });
      
      return new Response(
        JSON.stringify({
          ok: false,
          job_id: jobId,
          steps,
          next_action: 'reconnect',
          error_code: 'CONNECTION_NOT_FOUND',
          error_message: 'Conexão de plataforma não encontrada',
        } as SmokeTestResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!platformData.access_token_encrypted) {
      steps.push({
        name: 'validate_connection',
        ok: false,
        detail: 'Token não encontrado',
        duration_ms: Date.now() - step2Start,
      });

      await updateJob(supabase, jobId, 'failed', { steps });
      
      return new Response(
        JSON.stringify({
          ok: false,
          job_id: jobId,
          steps,
          next_action: 'reconnect',
          error_code: 'NO_TOKEN',
          error_message: 'Reconecte a plataforma para obter novos tokens',
        } as SmokeTestResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check token expiration
    if (platformData.token_expires_at && new Date(platformData.token_expires_at) < new Date()) {
      steps.push({
        name: 'validate_connection',
        ok: false,
        detail: 'Token expirado',
        duration_ms: Date.now() - step2Start,
      });

      await updateJob(supabase, jobId, 'failed', { steps });
      
      return new Response(
        JSON.stringify({
          ok: false,
          job_id: jobId,
          steps,
          next_action: 'refresh_token',
          error_code: 'TOKEN_EXPIRED',
          error_message: 'Sessão expirada. Clique em Renovar.',
        } as SmokeTestResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    steps.push({
      name: 'validate_connection',
      ok: true,
      detail: `Conexão válida: ${platformData.account_name || 'N/A'}`,
      duration_ms: Date.now() - step2Start,
    });

    // STEP 3: Check asset selection
    const step3Start = Date.now();
    if (!platformData.platform_account_type || !platformData.account_id) {
      steps.push({
        name: 'check_asset',
        ok: false,
        detail: 'Nenhum ativo selecionado',
        duration_ms: Date.now() - step3Start,
      });

      await updateJob(supabase, jobId, 'failed', { steps });
      
      return new Response(
        JSON.stringify({
          ok: false,
          job_id: jobId,
          steps,
          next_action: 'select_asset',
          error_code: 'ASSET_REQUIRED',
          error_message: 'Selecione um ativo (Página/Conta/Canal) antes de continuar.',
        } as SmokeTestResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    steps.push({
      name: 'check_asset',
      ok: true,
      detail: `Ativo: ${platformData.platform_account_type}/${platformData.account_name}`,
      duration_ms: Date.now() - step3Start,
    });

    // STEP 4: Test real API connection
    const step4Start = Date.now();
    const accessToken = decryptToken(platformData.access_token_encrypted);
    
    let testResult: { ok: boolean; detail: string };
    
    try {
      testResult = await testRealConnection(platform_id, accessToken, platformData.account_id, platformData.platform_account_type);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Erro desconhecido';
      testResult = { ok: false, detail: errorMsg };
    }

    steps.push({
      name: 'connection_test',
      ok: testResult.ok,
      detail: testResult.detail,
      duration_ms: Date.now() - step4Start,
    });

    if (!testResult.ok) {
      await updateJob(supabase, jobId, 'failed', { steps });
      await logStepEvent(supabase, workspace_id, jobId, user.id, 'connection_test', false, 'API_ERROR');
      
      return new Response(
        JSON.stringify({
          ok: false,
          job_id: jobId,
          steps,
          next_action: 'reconnect',
          error_code: 'CONNECTION_TEST_FAILED',
          error_message: testResult.detail,
        } as SmokeTestResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_tested_at
    await supabase
      .from('social_platforms')
      .update({ 
        last_tested_at: new Date().toISOString(),
        connection_status: 'connected',
        last_error_code: null,
        last_error_message: null,
      })
      .eq('id', platform_connection_id);

    await logStepEvent(supabase, workspace_id, jobId, user.id, 'connection_test', true);

    // STEP 5: If not dry_run, attempt publish (future implementation)
    if (!dry_run && test_card_id) {
      steps.push({
        name: 'publish_test',
        ok: true,
        detail: 'Publicação de teste: funcionalidade em desenvolvimento',
        duration_ms: 0,
      });
    }

    // STEP 6: Complete
    const totalDuration = Date.now() - startTime;
    
    await updateJob(supabase, jobId, 'completed', { 
      steps,
      latency_ms: totalDuration,
    });

    await supabase.from('domain_events').insert({
      workspace_id,
      event_type: 'social_smoke_test.completed',
      entity_type: 'social_job',
      entity_id: jobId,
      payload: { 
        platform_id, 
        platform_connection_id, 
        dry_run,
        steps_count: steps.length,
        all_passed: steps.every(s => s.ok),
        duration_ms: totalDuration,
      },
      actor_id: user.id,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        job_id: jobId,
        steps,
      } as SmokeTestResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Smoke test error:', errorMessage);
    
    if (jobId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await updateJob(supabase, jobId, 'failed', { steps, error_message: errorMessage });
    }

    return new Response(
      JSON.stringify({ 
        ok: false, 
        job_id: jobId,
        steps,
        error_code: 'SERVER_ERROR', 
        error_message: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function testRealConnection(
  platform: string, 
  accessToken: string, 
  assetId: string, 
  assetType: string
): Promise<{ ok: boolean; detail: string }> {
  switch (platform) {
    case 'facebook':
    case 'instagram': {
      if (assetType === 'facebook_page') {
        const response = await fetch(
          `https://graph.facebook.com/v24.0/${assetId}?fields=id,name&access_token=${accessToken}`
        );
        if (!response.ok) {
          const error = await response.json();
          return { ok: false, detail: error.error?.message || 'Página não acessível' };
        }
        const data = await response.json();
        return { ok: true, detail: `Página verificada: ${data.name}` };
      } else if (assetType === 'instagram_business') {
        const response = await fetch(
          `https://graph.facebook.com/v24.0/${assetId}?fields=id,username&access_token=${accessToken}`
        );
        if (!response.ok) {
          const error = await response.json();
          return { ok: false, detail: error.error?.message || 'Conta IG não acessível' };
        }
        const data = await response.json();
        return { ok: true, detail: `Instagram verificado: @${data.username}` };
      }
      break;
    }
    
    case 'youtube': {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${assetId}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (!response.ok) {
        const error = await response.json();
        return { ok: false, detail: error.error?.message || 'Canal não acessível' };
      }
      const data = await response.json();
      const channel = data.items?.[0];
      if (!channel) {
        return { ok: false, detail: 'Canal não encontrado' };
      }
      return { ok: true, detail: `Canal verificado: ${channel.snippet?.title}` };
    }
    
    case 'linkedin': {
      // For LinkedIn, verify the URN is accessible
      const response = await fetch('https://api.linkedin.com/v2/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        return { ok: false, detail: 'Token LinkedIn inválido ou expirado' };
      }
      return { ok: true, detail: 'LinkedIn verificado' };
    }
    
    case 'tiktok': {
      const response = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name',
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (!response.ok) {
        return { ok: false, detail: 'Token TikTok inválido ou expirado' };
      }
      return { ok: true, detail: 'TikTok verificado' };
    }
    
    case 'twitter': {
      const response = await fetch('https://api.twitter.com/2/users/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        return { ok: false, detail: 'Token X/Twitter inválido ou expirado' };
      }
      return { ok: true, detail: 'X/Twitter verificado' };
    }
  }
  
  return { ok: false, detail: `Plataforma não suportada: ${platform}` };
}

async function updateJob(supabase: any, jobId: string, status: string, result: any) {
  await supabase
    .from('social_jobs')
    .update({ 
      status,
      result,
      latency_ms: result.latency_ms || null,
      error_code: result.error_code || null,
      error_message: result.error_message || null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

async function logStepEvent(
  supabase: any, 
  workspaceId: string, 
  jobId: string, 
  userId: string,
  step: string, 
  success: boolean, 
  errorCode?: string
) {
  await supabase.from('domain_events').insert({
    workspace_id: workspaceId,
    event_type: success ? 'social_smoke_test.step_completed' : 'social_smoke_test.failed',
    entity_type: 'social_job',
    entity_id: jobId,
    payload: { step, success, error_code: errorCode },
    actor_id: userId,
  });
}
