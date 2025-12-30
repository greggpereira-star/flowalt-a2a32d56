import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CRITICAL_OVERDUE_DAYS = 3;

// Structured logging helper
function log(level: 'info' | 'warn' | 'error', message: string, context: Record<string, unknown> = {}, correlationId?: string) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'overdue-cards-check',
    message,
    correlationId,
    ...context,
  };
  
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

Deno.serve(async (req) => {
  const correlationId = crypto.randomUUID();
  const startTime = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  log('info', 'Starting overdue cards check', {}, correlationId);

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
      log('error', 'Error fetching overdue cards', { error: cardsError.message }, correlationId);
      throw cardsError;
    }

    log('info', `Found ${overdueCards?.length || 0} overdue cards`, { count: overdueCards?.length || 0 }, correlationId);

    let notificationsCreated = 0;
    let emailsSent = 0;
    let errors = 0;

    for (const card of overdueCards || []) {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(card.due_date).getTime()) / (1000 * 60 * 60 * 24)
      );

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
          log('error', 'Error creating notification', { 
            error: notifError.message, 
            cardId: card.id, 
            userId 
          }, correlationId);
          errors++;
        } else {
          notificationsCreated++;
        }

        // Send email for critically overdue cards (>3 days)
        if (daysOverdue >= CRITICAL_OVERDUE_DAYS) {
          // Check if email was already sent for this critical threshold
          const { data: existingEmails } = await supabase
            .from('email_notifications')
            .select('id')
            .eq('type', 'overdue_card')
            .eq('user_id', userId)
            .gte('created_at', `${today}T00:00:00Z`)
            .contains('metadata', { card_id: card.id });

          if (!existingEmails || existingEmails.length === 0) {
            try {
              // Call send-email-notification edge function
              const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email-notification`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  type: 'overdue_card',
                  workspace_id: card.workspace_id,
                  user_id: userId,
                  data: {
                    card_title: card.title,
                    due_date: new Date(card.due_date).toLocaleDateString('pt-BR'),
                    days_overdue: daysOverdue,
                    card_url: `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/space/${card.workspace_id}?card=${card.id}`,
                  },
                }),
              });

              if (emailResponse.ok) {
                emailsSent++;
                log('info', 'Email sent', { cardId: card.id, userId }, correlationId);
              } else {
                const errorText = await emailResponse.text();
                log('error', 'Failed to send email', { error: errorText, cardId: card.id }, correlationId);
                errors++;
              }
            } catch (emailError) {
              const errorMsg = emailError instanceof Error ? emailError.message : 'Unknown error';
              log('error', 'Error sending email', { error: errorMsg, cardId: card.id }, correlationId);
              errors++;
            }
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    
    // Record metrics
    await supabase.rpc('record_metric', {
      p_metric_type: 'job',
      p_metric_name: 'overdue_cards_check_duration_ms',
      p_metric_value: duration,
      p_dimensions: { 
        cards_processed: overdueCards?.length || 0,
        notifications_created: notificationsCreated,
        emails_sent: emailsSent,
        errors
      },
      p_correlation_id: correlationId
    });

    log('info', 'Overdue cards check completed', {
      duration_ms: duration,
      overdue_cards: overdueCards?.length || 0,
      notifications_created: notificationsCreated,
      emails_sent: emailsSent,
      errors
    }, correlationId);

    return new Response(
      JSON.stringify({
        success: true,
        correlation_id: correlationId,
        duration_ms: duration,
        overdue_cards: overdueCards?.length || 0,
        notifications_created: notificationsCreated,
        emails_sent: emailsSent,
        errors
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const duration = Date.now() - startTime;
    
    log('error', 'Fatal error in overdue-cards-check', { 
      error: errorMessage, 
      duration_ms: duration 
    }, correlationId);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        correlation_id: correlationId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
        status: 500,
      }
    );
  }
});
