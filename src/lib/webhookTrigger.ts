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
  signature?: string;
  data: Record<string, unknown>;
}

// Generate HMAC SHA-256 signature
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `sha256=${hashHex}`;
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
    const occurredAt = new Date().toISOString();

    // Deliver to each subscription
    for (const subscription of subscriptions) {
      try {
        const payload: WebhookPayload = {
          event_id: eventId,
          event_type: event,
          event_version: '1.0',
          occurred_at: occurredAt,
          workspace_id: workspaceId,
          data,
        };

        // Generate HMAC signature
        const payloadString = JSON.stringify(payload);
        const signature = await generateSignature(payloadString, subscription.secret);
        payload.signature = signature;

        // Create delivery record
        const { error: deliveryError } = await supabase
          .from('webhook_deliveries')
          .insert([{
            subscription_id: subscription.id,
            event_type: event,
            event_version: '1.0',
            payload: JSON.parse(JSON.stringify(payload)),
          }]);

        if (deliveryError) {
          console.error('Failed to create webhook delivery:', deliveryError);
          continue;
        }

        // Fire and forget the actual delivery
        fetch(subscription.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event,
            'X-Webhook-Timestamp': occurredAt,
            'X-Webhook-ID': eventId,
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

// Helper to verify webhook signature (for receiving webhooks)
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expectedSignature = await generateSignature(payload, secret);
  return signature === expectedSignature;
}
