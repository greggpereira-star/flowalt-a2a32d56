import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AtSign, Calendar, Award, UserPlus, AlertTriangle, Bell } from 'lucide-react';

const notificationIcons: Record<string, React.ReactNode> = {
  mention: <AtSign className="h-4 w-4 text-primary" />,
  card_overdue: <Calendar className="h-4 w-4 text-warning" />,
  badge_earned: <Award className="h-4 w-4 text-warning" />,
  assignment: <UserPlus className="h-4 w-4 text-success" />,
  webhook_failure: <AlertTriangle className="h-4 w-4 text-destructive" />,
};

export function NotificationToast() {
  const { user } = useAuth();
  const hasSubscribed = useRef(false);

  useEffect(() => {
    if (!user?.id || hasSubscribed.current) return;

    hasSubscribed.current = true;

    const channel = supabase
      .channel(`notifications-toast-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as {
            id: string;
            type: string;
            title: string;
            message: string;
          };

          // Show toast notification
          toast(notification.title, {
            description: notification.message,
            icon: notificationIcons[notification.type] || <Bell className="h-4 w-4" />,
            duration: 5000,
            action: {
              label: 'Ver',
              onClick: () => {
                // Could navigate here if needed
              },
            },
          });
        }
      )
      .subscribe();

    return () => {
      hasSubscribed.current = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return null;
}
