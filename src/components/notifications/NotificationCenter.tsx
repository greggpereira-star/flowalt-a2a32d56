import React from 'react';
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, Calendar, Award, AtSign, UserPlus, Building2, FileText, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const notificationIcons: Record<string, React.ReactNode> = {
  webhook_failure: <AlertTriangle className="h-4 w-4 text-destructive" />,
  card_overdue: <Calendar className="h-4 w-4 text-orange-500" />,
  badge_earned: <Award className="h-4 w-4 text-yellow-500" />,
  mention: <AtSign className="h-4 w-4 text-blue-500" />,
  assignment: <UserPlus className="h-4 w-4 text-green-500" />,
  workspace_invite: <Building2 className="h-4 w-4 text-primary" />,
  altcontrol_approval_pending: <FileText className="h-4 w-4 text-amber-500" />,
  altcontrol_approved: <CheckCircle className="h-4 w-4 text-green-500" />,
  altcontrol_needs_adjustment: <XCircle className="h-4 w-4 text-destructive" />,
};

export function NotificationCenter() {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
    
    // Navigate based on notification type
    if (
      (notification.type === 'mention' || notification.type === 'assignment') &&
      notification.metadata?.card_id
    ) {
      // Navigate to the space with the card modal open
      const spaceId = notification.metadata.space_id;
      if (spaceId) {
        navigate(`/space/${spaceId}?card=${notification.metadata.card_id}`);
      } else {
        // Fallback to dashboard if no space_id
        navigate(`/workspace?card=${notification.metadata.card_id}`);
      }
    } else if (
      notification.type === 'altcontrol_approval_pending' &&
      notification.metadata?.proposal_id
    ) {
      navigate(`/altcontrol/approvals/${notification.metadata.proposal_id}`);
    } else if (
      (notification.type === 'altcontrol_approved' ||
        notification.type === 'altcontrol_needs_adjustment') &&
      notification.metadata?.proposal_id
    ) {
      navigate(`/altcontrol/proposals/${notification.metadata.proposal_id}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-xs font-medium bg-destructive text-destructive-foreground rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs"
              onClick={() => markAllAsRead.mutate()}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Nenhuma notificação
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex flex-col items-start p-3 cursor-pointer",
                  !notification.is_read && "bg-muted/50"
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className="mt-0.5">
                    {notificationIcons[notification.type] || <Bell className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm line-clamp-1",
                      !notification.is_read && "font-medium"
                    )}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { 
                        addSuffix: true,
                        locale: ptBR 
                      })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead.mutate(notification.id);
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification.mutate(notification.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-muted-foreground text-sm"
              onClick={() => clearAll.mutate()}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar todas
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
