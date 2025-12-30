import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting ranking snapshot...');

    // Get all workspaces
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('status', 'active');

    if (wsError) throw wsError;

    let totalSnapshots = 0;

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
          console.error('Error inserting ranking:', insertError);
        } else {
          totalSnapshots++;
        }
      }
    }

    console.log(`Created ${totalSnapshots} ranking snapshots`);

    return new Response(
      JSON.stringify({
        success: true,
        workspaces: workspaces?.length || 0,
        snapshots: totalSnapshots,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in ranking-snapshot:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
