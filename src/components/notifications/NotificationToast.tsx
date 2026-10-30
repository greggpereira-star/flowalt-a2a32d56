import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { AtSign, Calendar, Award, UserPlus, AlertTriangle, Bell, Trophy } from 'lucide-react';

const notificationIcons: Record<string, React.ReactNode> = {
  mention: <AtSign className="h-4 w-4 text-primary" />,
  card_overdue: <Calendar className="h-4 w-4 text-warning" />,
  badge_earned: <Award className="h-4 w-4 text-warning" />,
  assignment: <UserPlus className="h-4 w-4 text-success" />,
  webhook_failure: <AlertTriangle className="h-4 w-4 text-destructive" />,
  ranking_change: <Trophy className="h-4 w-4 text-warning" />,
  weekly_mvp: <Trophy className="h-4 w-4 text-warning" />,
  team_goal: <Trophy className="h-4 w-4 text-success" />,
  season_end: <Trophy className="h-4 w-4 text-warning" />,
  mission_done: <Trophy className="h-4 w-4 text-success" />,
  mission_week: <Trophy className="h-4 w-4 text-primary" />,
};

// Avisos da gamificacao abrem a tela de Gamificacao.
const TIPOS_DE_GAMIFICACAO = new Set(['ranking_change', 'weekly_mvp', 'team_goal', 'level_up', 'season_end', 'mission_done', 'mission_week']);

export function NotificationToast() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
            metadata?: { route?: string } | null;
          };

          // Show toast notification
          toast(notification.title, {
            description: notification.message,
            icon: notificationIcons[notification.type] || <Bell className="h-4 w-4" />,
            duration: 5000,
            action: {
              label: 'Ver',
              onClick: () => {
                if (TIPOS_DE_GAMIFICACAO.has(notification.type)) navigate(notification.metadata?.route || '/gamification');
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
