import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';

interface WebhookSubscription {
  id: string;
  workspace_id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

interface WebhookDelivery {
  id: string;
  subscription_id: string;
  event_type: string;
  payload: any;
  response_status: number | null;
  response_body: string | null;
  delivered_at: string | null;
  retry_count: number;
  created_at: string;
}

export const WEBHOOK_EVENTS = [
  { value: 'card.created', label: 'Card criado' },
  { value: 'card.updated', label: 'Card atualizado' },
  { value: 'card.deleted', label: 'Card excluído' },
  { value: 'comment.created', label: 'Comentário criado' },
  { value: 'checklist.item.completed', label: 'Item de checklist concluído' },
  { value: 'checklist.item.created', label: 'Item de checklist criado' },
  { value: 'time_entry.logged', label: 'Tempo registrado' },
  { value: 'event.created', label: 'Evento criado' },
  { value: 'attachment.uploaded', label: 'Anexo enviado' },
  { value: 'attachment.deleted', label: 'Anexo excluído' },
  { value: 'sprint.created', label: 'Sprint criado' },
  { value: 'sprint.completed', label: 'Sprint concluído' },
  { value: 'sprint.updated', label: 'Sprint atualizado' },
];

export function useWebhooks() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['webhooks', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('webhook_subscriptions')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WebhookSubscription[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useWebhookDeliveries(subscriptionId: string | null) {
  return useQuery({
    queryKey: ['webhook-deliveries', subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return [];

      const { data, error } = await supabase
        .from('webhook_deliveries')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as WebhookDelivery[];
    },
    enabled: !!subscriptionId,
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; url: string; events: string[] }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      // Generate a random secret
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const secret = 'whsec_' + Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const { data: result, error } = await supabase
        .from('webhook_subscriptions')
        .insert({
          workspace_id: currentWorkspace.id,
          name: data.name,
          url: data.url,
          secret,
          events: data.events,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast({ title: 'Webhook criado com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar webhook', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; url?: string; events?: string[]; is_active?: boolean }) => {
      const { error } = await supabase
        .from('webhook_subscriptions')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast({ title: 'Webhook atualizado' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar webhook', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('webhook_subscriptions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast({ title: 'Webhook excluído' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir webhook', description: error.message, variant: 'destructive' });
    },
  });
}

export function useResendWebhook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (deliveryId: string) => {
      // Get the delivery details
      const { data: delivery, error: fetchError } = await supabase
        .from('webhook_deliveries')
        .select('*, webhook_subscriptions(*)')
        .eq('id', deliveryId)
        .single();

      if (fetchError || !delivery) throw new Error('Delivery not found');

      const subscription = (delivery as any).webhook_subscriptions;
      if (!subscription) throw new Error('Subscription not found');

      // Create HMAC signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(subscription.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const payloadString = JSON.stringify(delivery.payload);
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(payloadString)
      );

      const signatureHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Send webhook
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signatureHex}`,
          'X-Webhook-Event': delivery.event_type,
        },
        body: payloadString,
      });

      const responseBody = await response.text().catch(() => '');

      // Update delivery record
      const { error: updateError } = await supabase
        .from('webhook_deliveries')
        .update({
          response_status: response.status,
          response_body: responseBody.substring(0, 1000),
          delivered_at: new Date().toISOString(),
          retry_count: (delivery.retry_count || 0) + 1,
        })
        .eq('id', deliveryId);

      if (updateError) throw updateError;

      return response.ok;
    },
    onSuccess: (success) => {
      queryClient.invalidateQueries({ queryKey: ['webhook-deliveries'] });
      toast({ 
        title: success ? 'Webhook reenviado com sucesso' : 'Webhook reenviado (falhou)',
        variant: success ? 'default' : 'destructive'
      });
    },
    onError: (error) => {
      toast({ title: 'Erro ao reenviar webhook', description: error.message, variant: 'destructive' });
    },
  });
}
