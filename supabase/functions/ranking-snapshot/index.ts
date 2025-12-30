import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Structured logging helper
function createLogger(correlationId: string) {
  const log = (level: string, message: string, context: Record<string, unknown> = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'ranking-snapshot',
      correlationId,
      message,
      ...context
    }
    if (level === 'error') {
      console.error(JSON.stringify(entry))
    } else if (level === 'warn') {
      console.warn(JSON.stringify(entry))
    } else {
      console.log(JSON.stringify(entry))
    }
  }

  return {
    info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
    debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
  const logger = createLogger(correlationId);
  const startTime = Date.now();

  logger.info('Starting ranking snapshot job');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all workspaces
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('status', 'active');

    if (wsError) {
      logger.error('Error fetching workspaces', { error: wsError.message });
      throw wsError;
    }

    logger.info('Fetched workspaces', { count: workspaces?.length || 0 });

    let totalSnapshots = 0;
    let totalErrors = 0;

    for (const workspace of workspaces || []) {
      // Get all members of this workspace
      const { data: members } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspace.id)
        .eq('is_active', true);

      const userStats: Array<{
        user_id: string;
        score: number;
        cards_created: number;
        cards_completed: number;
        hours_logged: number;
        badges_count: number;
      }> = [];

      for (const member of members || []) {
        // Cards created
        const { count: cardsCreated } = await supabase
          .from('cards')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id)
          .eq('created_by', member.user_id);

        // Cards completed
        const { count: cardsCompleted } = await supabase
          .from('cards')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id)
          .eq('owner_id', member.user_id)
          .eq('status', 'delivered');

        // Time entries
        const { data: timeEntries } = await supabase
          .from('time_entries')
          .select('duration_seconds')
          .eq('workspace_id', workspace.id)
          .eq('user_id', member.user_id);

        const totalHours = (timeEntries || []).reduce(
          (acc, te) => acc + (te.duration_seconds || 0),
          0
        ) / 3600;

        // Badges
        const { count: badgesCount } = await supabase
          .from('user_badges')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id)
          .eq('user_id', member.user_id);

        // Calculate score
        const score = 
          (cardsCreated || 0) * 10 +
          (cardsCompleted || 0) * 25 +
          Math.floor(totalHours) * 5 +
          (badgesCount || 0) * 50;

        userStats.push({
          user_id: member.user_id,
          score,
          cards_created: cardsCreated || 0,
          cards_completed: cardsCompleted || 0,
          hours_logged: Math.round(totalHours * 10) / 10,
          badges_count: badgesCount || 0,
        });
      }

      // Sort by score and assign ranks
      userStats.sort((a, b) => b.score - a.score);

      // Insert ranking snapshots
      for (let i = 0; i < userStats.length; i++) {
        const stat = userStats[i];
        const { error: insertError } = await supabase
          .from('ranking_history')
          .upsert({
            workspace_id: workspace.id,
            user_id: stat.user_id,
            score: stat.score,
            rank: i + 1,
            cards_created: stat.cards_created,
            cards_completed: stat.cards_completed,
            hours_logged: stat.hours_logged,
            badges_count: stat.badges_count,
            recorded_at: new Date().toISOString().split('T')[0],
          }, {
            onConflict: 'workspace_id,user_id,recorded_at',
          });

        if (insertError) {
          logger.error('Error inserting ranking', { 
            workspaceId: workspace.id,
            userId: stat.user_id,
            error: insertError.message 
          });
          totalErrors++;
        } else {
          totalSnapshots++;
        }
      }

      logger.debug('Processed workspace rankings', { 
        workspaceId: workspace.id, 
        usersProcessed: userStats.length 
      });
    }

    const duration = Date.now() - startTime;
    logger.info('Ranking snapshot job completed', { 
      workspaces: workspaces?.length || 0,
      snapshots: totalSnapshots,
      errors: totalErrors,
      durationMs: duration 
    });

    return new Response(
      JSON.stringify({
        success: true,
        workspaces: workspaces?.length || 0,
        snapshots: totalSnapshots,
        errors: totalErrors,
        correlation_id: correlationId,
        duration_ms: duration
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const duration = Date.now() - startTime;
    
    logger.error('Fatal error in ranking-snapshot', { 
      error: errorMessage,
      durationMs: duration 
    });
    
    return new Response(
      JSON.stringify({ error: errorMessage, correlation_id: correlationId }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId },
        status: 500,
      }
    );
  }
});
