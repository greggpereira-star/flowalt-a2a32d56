import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const correlationId = crypto.randomUUID()
  const startTime = Date.now()

  console.log(`[${correlationId}] Starting snapshot computation`)

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all active workspaces
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('status', 'active')

    if (wsError) {
      console.error(`[${correlationId}] Error fetching workspaces:`, wsError)
      throw wsError
    }

    console.log(`[${correlationId}] Found ${workspaces?.length || 0} active workspaces`)

    const snapshotTypes = ['coordination', 'financial', 'team']
    const results: { workspace_id: string; snapshots: string[]; errors: string[] }[] = []

    for (const workspace of workspaces || []) {
      const wsResult = { workspace_id: workspace.id, snapshots: [] as string[], errors: [] as string[] }

      for (const snapshotType of snapshotTypes) {
        try {
          const { error } = await supabase.rpc('compute_dashboard_snapshot', {
            p_workspace_id: workspace.id,
            p_snapshot_type: snapshotType
          })

          if (error) {
            console.error(`[${correlationId}] Error computing ${snapshotType} for ${workspace.id}:`, error)
            wsResult.errors.push(`${snapshotType}: ${error.message}`)
          } else {
            wsResult.snapshots.push(snapshotType)
          }
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : 'Unknown error';
          console.error(`[${correlationId}] Exception computing ${snapshotType} for ${workspace.id}:`, e);
          wsResult.errors.push(`${snapshotType}: ${errorMessage}`);
        }
      }

      results.push(wsResult)
    }

    // Record metric for monitoring
    const duration = Date.now() - startTime
    await supabase.rpc('record_metric', {
      p_metric_type: 'job',
      p_metric_name: 'compute_snapshots_duration_ms',
      p_metric_value: duration,
      p_dimensions: { workspaces_processed: workspaces?.length || 0 },
      p_correlation_id: correlationId
    })

    console.log(`[${correlationId}] Completed in ${duration}ms`)

    return new Response(
      JSON.stringify({
        success: true,
        correlation_id: correlationId,
        duration_ms: duration,
        workspaces_processed: workspaces?.length || 0,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${correlationId}] Fatal error:`, error);
    
    return new Response(
      JSON.stringify({
        success: false,
        correlation_id: correlationId,
        error: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
