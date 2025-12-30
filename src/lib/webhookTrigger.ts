import { supabase } from '@/integrations/supabase/client';

type WebhookEventType = 
  | 'card.created' | 'card.updated' | 'card.status_changed' | 'card.deleted'
  | 'comment.created'
  | 'checklist.item.created' | 'checklist.item.completed'
  | 'time_entry.logged'
  | 'event.created'
  | 'attachment.uploaded' | 'attachment.deleted'
  | 'sprint.created' | 'sprint.updated' | 'sprint.completed'
  | 'transaction.created' | 'transaction.updated' | 'transaction.paid'
  | 'invoice.linked'
  | 'client.created' | 'client.updated'
  | 'employee.document.expired';

interface WebhookPayload {
  event_id: string;
  event_type: WebhookEventType;
  event_version: string;
  occurred_at: string;
  workspace_id: string;
  data: Record<string, unknown>;
}

export async function triggerWebhook(
  workspaceId: string,
  event: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  try {
    // Get active webhook subscriptions for this workspace and event
    const { data: subscriptions, error: fetchError } = await supabase
      .from('webhook_subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .contains('events', [event]);

    if (fetchError) {
      console.error('Failed to fetch webhook subscriptions:', fetchError);
      return;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return; // No active subscriptions for this event
    }

    const eventId = crypto.randomUUID();
    const payload: WebhookPayload = {
      event_id: eventId,
      event_type: event,
      event_version: '1.0',
      occurred_at: new Date().toISOString(),
      workspace_id: workspaceId,
      data,
    };

    // Deliver to each subscription
    for (const subscription of subscriptions) {
      try {
        // Create delivery record
        const { error: deliveryError } = await supabase
          .from('webhook_deliveries')
          .insert([{
            subscription_id: subscription.id,
            event_type: event,
            payload: JSON.parse(JSON.stringify(payload)),
          }]);

        if (deliveryError) {
          console.error('Failed to create webhook delivery:', deliveryError);
          continue;
        }

        // Fire and forget the actual delivery (in production, this would be an edge function)
        fetch(subscription.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': subscription.secret,
            'X-Webhook-Event': event,
          },
          body: JSON.stringify(payload),
        }).catch((err) => {
          console.error('Webhook delivery failed:', err);
        });
      } catch (err) {
        console.error('Error processing webhook subscription:', err);
      }
    }
  } catch (err) {
    console.error('Error triggering webhook:', err);
  }
}

// Helper to get workspace_id from card_id
export async function getCardWorkspaceId(cardId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('cards')
    .select('workspace_id')
    .eq('id', cardId)
    .single();

  if (error || !data) return null;
  return data.workspace_id;
}
