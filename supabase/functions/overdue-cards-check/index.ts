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

    // Find overdue cards that haven't been notified today
    const today = new Date().toISOString().split('T')[0];
    
    const { data: overdueCards, error: cardsError } = await supabase
      .from('cards')
      .select(`
        id,
        title,
        due_date,
        workspace_id,
        owner_id,
        status,
        card_members (user_id)
      `)
      .lt('due_date', new Date().toISOString())
      .not('status', 'in', '("delivered","archived")')
      .not('owner_id', 'is', null);

    if (cardsError) {
      console.error('Error fetching overdue cards:', cardsError);
      throw cardsError;
    }

    console.log(`Found ${overdueCards?.length || 0} overdue cards`);

    let notificationsCreated = 0;

    for (const card of overdueCards || []) {
      // Collect all users to notify (owner + members)
      const usersToNotify = new Set<string>();
      
      if (card.owner_id) {
        usersToNotify.add(card.owner_id);
      }
      
      for (const member of card.card_members || []) {
        usersToNotify.add(member.user_id);
      }

      // Check if notification was already sent today for this card
      const { data: existingNotifications } = await supabase
        .from('notifications')
        .select('id, user_id')
        .eq('type', 'card_overdue')
        .gte('created_at', `${today}T00:00:00Z`)
        .contains('metadata', { card_id: card.id });

      const alreadyNotifiedUsers = new Set(
        existingNotifications?.map(n => n.user_id) || []
      );

      // Create notifications for users not yet notified
      for (const userId of usersToNotify) {
        if (alreadyNotifiedUsers.has(userId)) continue;

        const daysOverdue = Math.floor(
          (Date.now() - new Date(card.due_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            workspace_id: card.workspace_id,
            type: 'card_overdue',
            title: 'Card atrasado',
            message: `O card "${card.title}" está ${daysOverdue} dia(s) atrasado`,
            metadata: {
              card_id: card.id,
              days_overdue: daysOverdue,
              due_date: card.due_date,
            },
          });

        if (notifError) {
          console.error('Error creating notification:', notifError);
        } else {
          notificationsCreated++;
        }
      }
    }

    console.log(`Created ${notificationsCreated} notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        overdue_cards: overdueCards?.length || 0,
        notifications_created: notificationsCreated,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in overdue-cards-check:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
