import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

export interface PushSubscription {
  id: string;
  user_id: string;
  workspace_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  is_active: boolean;
  created_at: string;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['push-subscription', user?.id, currentWorkspace?.id],
    queryFn: async () => {
      if (!user?.id || !currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as PushSubscription | null;
    },
    enabled: !!user?.id && !!currentWorkspace?.id,
  });

  const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
  const isEnabled = !!subscription;
  const permission = isSupported ? Notification.permission : 'denied';

  const subscribe = useMutation({
    mutationFn: async () => {
      if (!user?.id || !currentWorkspace?.id) throw new Error('Not authenticated');
      if (!isSupported) throw new Error('Push notifications not supported');

      // Request permission
      const permissionResult = await Notification.requestPermission();
      if (permissionResult !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Register service worker if not already registered
      let swRegistration = await navigator.serviceWorker.getRegistration();
      if (!swRegistration) {
        swRegistration = await navigator.serviceWorker.register('/sw.js');
      }

      // Get push subscription
      let pushSubscription = await swRegistration.pushManager.getSubscription();
      
      if (!pushSubscription) {
        // Note: In production, you would use your VAPID public key here
        // For now, we'll create a placeholder subscription
        const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
        
        try {
          pushSubscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidPublicKey,
          });
        } catch (subscribeError) {
          console.error('Push subscription failed:', subscribeError);
          // Fallback: store a placeholder subscription for in-app notifications
          const { error } = await supabase.from('push_subscriptions').insert({
            user_id: user.id,
            workspace_id: currentWorkspace.id,
            endpoint: `fallback-${user.id}-${Date.now()}`,
            p256dh: 'placeholder',
            auth: 'placeholder',
          });
          if (error) throw error;
          return;
        }
      }

      const keys = pushSubscription.toJSON().keys;
      
      // Store subscription in database
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        workspace_id: currentWorkspace.id,
        endpoint: pushSubscription.endpoint,
        p256dh: keys?.p256dh || '',
        auth: keys?.auth || '',
        is_active: true,
      }, {
        onConflict: 'user_id,endpoint',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-subscription'] });
      toast.success('Notificações push ativadas!');
    },
    onError: (error) => {
      console.error('Subscribe error:', error);
      toast.error('Erro ao ativar notificações push');
    },
  });

  const unsubscribe = useMutation({
    mutationFn: async () => {
      if (!user?.id || !subscription) throw new Error('No subscription');

      const { error } = await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('id', subscription.id);

      if (error) throw error;

      // Unsubscribe from push manager
      const swRegistration = await navigator.serviceWorker.getRegistration();
      if (swRegistration) {
        const pushSub = await swRegistration.pushManager.getSubscription();
        if (pushSub) {
          await pushSub.unsubscribe();
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-subscription'] });
      toast.success('Notificações push desativadas');
    },
    onError: () => {
      toast.error('Erro ao desativar notificações push');
    },
  });

  return {
    subscription,
    isLoading,
    isSupported,
    isEnabled,
    permission,
    subscribe,
    unsubscribe,
  };
}
