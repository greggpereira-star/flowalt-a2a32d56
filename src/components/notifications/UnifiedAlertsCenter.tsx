import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Calendar,
  Award,
  AtSign,
  UserPlus,
  Building2,
  FileText,
  CheckCircle,
  XCircle,
  PartyPopper,
  Info,
  Wrench,
  Shield,
  X,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { useNotices, Notice } from '@/hooks/useNoticesModule';
import {
  useMyWorkspaceInvites,
  PendingWorkspaceInvite,
} from '@/hooks/useMyWorkspaceInvites';
import { useAcceptWorkspaceInvite } from '@/hooks/useWorkspaceInvites';
import { MandatoryNoticeModal } from '@/components/notices/MandatoryNoticeModal';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTodayBirthdays } from '@/hooks/useBirthdays';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Cake } from 'lucide-react';

/* ───────── icons / colors ───────── */

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

const noticeIcons: Record<Notice['category'], React.ReactNode> = {
  general: <Info className="h-4 w-4" />,
  urgent: <AlertTriangle className="h-4 w-4" />,
  celebration: <PartyPopper className="h-4 w-4" />,
  holiday: <Calendar className="h-4 w-4" />,
  birthday: <PartyPopper className="h-4 w-4" />,
  maintenance: <Wrench className="h-4 w-4" />,
  policy: <FileText className="h-4 w-4" />,
};

const noticeCategoryColors: Record<Notice['category'], string> = {
  general: 'bg-muted text-muted-foreground',
  urgent: 'bg-destructive/10 text-destructive',
  celebration: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  holiday: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  birthday: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  maintenance: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  policy: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

const priorityBorder: Record<Notice['priority'], string> = {
  low: 'border-muted',
  normal: 'border-border',
  high: 'border-amber-500',
  critical: 'border-destructive',
};

/* ───────── Unified Alerts Center ───────── */

export function UnifiedAlertsCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'notifications' | 'notices'>('notifications');
  const [onlyUnreadNotifs, setOnlyUnreadNotifs] = useState(false);
  const [onlyUnreadNotices, setOnlyUnreadNotices] = useState(false);
  const [mandatoryNotice, setMandatoryNotice] = useState<Notice | null>(null);

  // Notifications (inbox de sistema)
  const {
    notifications,
    unreadCount: unreadNotifications,
    isLoading: loadingNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  // Notices (avisos / comunicados / aniversários / convites)
  const {
    notices,
    unreadNotices,
    readNotices,
    markAsRead: markNoticeAsRead,
    confirmNotice,
    isLoading: loadingNotices,
  } = useNotices();
  const { data: pendingInvites = [], isLoading: loadingInvites } =
    useMyWorkspaceInvites();
  const acceptInvite = useAcceptWorkspaceInvite();

  // Aniversariantes do dia (exceto eu — eu tenho meu próprio modal de celebração)
  const { user } = useAuth();
  const { data: todayBirthdays = [] } = useTodayBirthdays();
  const otherBirthdays = useMemo(
    () => todayBirthdays.filter((b) => b.user_id !== user?.id),
    [todayBirthdays, user?.id],
  );
  const todayKey = new Date().toDateString();
  const [dismissedBirthdayDate, setDismissedBirthdayDate] = useState<string | null>(
    () => {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem('alerts-birthdays-dismissed');
    },
  );
  const birthdaysVisible =
    otherBirthdays.length > 0 && dismissedBirthdayDate !== todayKey;

  const dismissBirthdays = () => {
    setDismissedBirthdayDate(todayKey);
    if (typeof window !== 'undefined') {
      localStorage.setItem('alerts-birthdays-dismissed', todayKey);
    }
  };

  // Auto-show mandatory notices
  useEffect(() => {
    const pendingMandatory = unreadNotices.find((n) => n.requires_confirmation);
    if (pendingMandatory && !mandatoryNotice) {
      const t = setTimeout(() => setMandatoryNotice(pendingMandatory), 1000);
      return () => clearTimeout(t);
    }
  }, [unreadNotices, mandatoryNotice]);

  const noticesPending =
    unreadNotices.length + pendingInvites.length + (birthdaysVisible ? 1 : 0);
  const totalUnread = unreadNotifications + noticesPending;
  const hasPendingMandatory = unreadNotices.some((n) => n.requires_confirmation);
  const hasPendingInvites = pendingInvites.length > 0;
  const urgent = hasPendingMandatory || hasPendingInvites;

  /* ── Notification handlers ── */
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) markAsRead.mutate(notification.id);

    if (
      (notification.type === 'mention' || notification.type === 'assignment') &&
      notification.metadata?.card_id
    ) {
      const cardId = notification.metadata.card_id as string;
      let spaceId = notification.metadata.space_id as string | undefined;
      if (!spaceId) {
        try {
          const { data } = await supabase
            .from('cards')
            .select('space_id')
            .eq('id', cardId)
            .single();
          spaceId = data?.space_id;
        } catch (err) {
          console.error('Error fetching card space_id:', err);
        }
      }
      if (spaceId) navigate(`/space/${spaceId}?card=${cardId}`);
      else navigate(`/tasks?card=${cardId}`);
      setOpen(false);
    } else if (
      notification.type === 'altcontrol_approval_pending' &&
      notification.metadata?.proposal_id
    ) {
      navigate(`/altcontrol/approvals/${notification.metadata.proposal_id}`);
      setOpen(false);
    } else if (
      (notification.type === 'altcontrol_approved' ||
        notification.type === 'altcontrol_needs_adjustment') &&
      notification.metadata?.proposal_id
    ) {
      navigate(`/altcontrol/proposals/${notification.metadata.proposal_id}`);
      setOpen(false);
    }
  };

  const handleConfirmMandatory = () => {
    if (mandatoryNotice) {
      confirmNotice.mutate(mandatoryNotice.id);
      setMandatoryNotice(null);
    }
  };

  const handleAcceptInvite = (token: string) => {
    acceptInvite.mutate(token, { onSuccess: () => setOpen(false) });
  };

  /* ── Listas derivadas (filtros rápidos) ── */
  const visibleNotifications = useMemo(
    () => (onlyUnreadNotifs ? notifications.filter((n) => !n.is_read) : notifications),
    [notifications, onlyUnreadNotifs],
  );

  const visibleNotices = useMemo(
    () =>
      onlyUnreadNotices
        ? notices.filter((n) => !readNotices.includes(n.id))
        : notices,
    [notices, readNotices, onlyUnreadNotices],
  );

  /* ── "Limpar" do tipo selecionado ── */
  const clearCurrentTab = () => {
    if (tab === 'notifications') {
      // Remove apenas as visíveis (respeita filtro "só não lidas")
      if (onlyUnreadNotifs) {
        visibleNotifications.forEach((n) => deleteNotification.mutate(n.id));
      } else {
        clearAll.mutate();
      }
      return;
    }
    // Aba "Avisos": dispensa (marca como lido) os não obrigatórios da lista visível
    visibleNotices
      .filter((n) => !n.requires_confirmation && !readNotices.includes(n.id))
      .forEach((n) => markNoticeAsRead.mutate(n.id));
  };

  const canClearCurrentTab =
    tab === 'notifications'
      ? visibleNotifications.length > 0
      : visibleNotices.some(
          (n) => !n.requires_confirmation && !readNotices.includes(n.id),
        );

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={`Alertas${totalUnread > 0 ? ` (${totalUnread} não lidos)` : ''}`}
          >
            <Bell className={cn('h-5 w-5', urgent && 'animate-bounce')} />
            {totalUnread > 0 && (
              <span
                className={cn(
                  'absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full',
                  'flex items-center justify-center text-[10px] font-medium',
                  'animate-scale-in',
                  urgent
                    ? 'bg-amber-500 text-white'
                    : 'bg-destructive text-destructive-foreground',
                )}
              >
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </Button>
        </SheetTrigger>

        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-3 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Central de alertas
              {totalUnread > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {totalUnread}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as typeof tab)}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="px-6 pt-3">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="notifications" className="gap-2">
                  Notificações
                  {unreadNotifications > 0 && (
                    <Badge
                      variant="destructive"
                      className="h-5 min-w-5 px-1 text-[10px]"
                    >
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="notices" className="gap-2">
                  Avisos
                  {noticesPending > 0 && (
                    <Badge
                      variant={urgent ? 'default' : 'secondary'}
                      className={cn(
                        'h-5 min-w-5 px-1 text-[10px]',
                        urgent && 'bg-amber-500 text-white hover:bg-amber-500',
                      )}
                    >
                      {noticesPending > 9 ? '9+' : noticesPending}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ───────── Notifications tab ───────── */}
            <TabsContent
              value="notifications"
              className="flex-1 min-h-0 mt-3 flex flex-col"
            >
              <FilterBar
                onlyUnread={onlyUnreadNotifs}
                onToggleUnread={() => setOnlyUnreadNotifs((v) => !v)}
                unreadCount={unreadNotifications}
                rightSlot={
                  unreadNotifications > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => markAllAsRead.mutate()}
                    >
                      <CheckCheck className="h-3 w-3 mr-1" />
                      Marcar lidas
                    </Button>
                  ) : null
                }
              />

              <ScrollArea className="flex-1 px-6 pb-4">
                {loadingNotifications ? (
                  <EmptyState text="Carregando..." />
                ) : visibleNotifications.length === 0 ? (
                  <EmptyState
                    icon={<Bell className="h-10 w-10 opacity-50" />}
                    text={
                      onlyUnreadNotifs
                        ? 'Nenhuma notificação não lida'
                        : 'Nenhuma notificação'
                    }
                  />
                ) : (
                  <ul className="space-y-2">
                    {visibleNotifications.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => handleNotificationClick(n)}
                          className={cn(
                            'w-full text-left rounded-lg p-3 border border-transparent',
                            'hover:bg-accent/50 transition-colors',
                            !n.is_read && 'bg-muted/50 border-border',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 shrink-0">
                              {notificationIcons[n.type] || (
                                <Bell className="h-4 w-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={cn(
                                  'text-sm line-clamp-1',
                                  !n.is_read && 'font-medium',
                                )}
                              >
                                {n.title}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {n.message}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(n.created_at), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })}
                              </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {!n.is_read && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead.mutate(n.id);
                                  }}
                                  aria-label="Marcar como lida"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification.mutate(n.id);
                                }}
                                aria-label="Remover"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </TabsContent>

            {/* ───────── Notices tab ───────── */}
            <TabsContent
              value="notices"
              className="flex-1 min-h-0 mt-3 flex flex-col"
            >
              <FilterBar
                onlyUnread={onlyUnreadNotices}
                onToggleUnread={() => setOnlyUnreadNotices((v) => !v)}
                unreadCount={unreadNotices.length}
              />

              <ScrollArea className="flex-1 px-6 pb-4">
                {/* Aniversariantes do dia — destaque acionável */}
                {birthdaysVisible && (
                  <section className="mb-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-pink-600 dark:text-pink-400 flex items-center gap-2 mb-2">
                      <Cake className="h-3.5 w-3.5" />
                      Aniversariantes do dia
                    </h3>
                    <BirthdaysAlertCard
                      members={otherBirthdays}
                      onDismiss={dismissBirthdays}
                    />
                  </section>
                )}

                {/* Convites pendentes — sempre visíveis (são acionáveis) */}
                {pendingInvites.length > 0 && (
                  <section className="mb-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-primary flex items-center gap-2 mb-2">
                      <Building2 className="h-3.5 w-3.5" />
                      Convites pendentes
                    </h3>
                    <div className="space-y-2">
                      {pendingInvites.map((invite) => (
                        <PendingInviteItem
                          key={invite.id}
                          invite={invite}
                          onAccept={() => handleAcceptInvite(invite.token)}
                          isAccepting={acceptInvite.isPending}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Avisos */}
                {loadingNotices || loadingInvites ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-20 rounded-lg bg-muted animate-pulse"
                      />
                    ))}
                  </div>
                ) : visibleNotices.length === 0 &&
                  pendingInvites.length === 0 &&
                  !birthdaysVisible ? (
                  <EmptyState
                    icon={<Bell className="h-10 w-10 opacity-50" />}
                    text={
                      onlyUnreadNotices
                        ? 'Nenhum aviso não lido'
                        : 'Nenhum aviso no momento'
                    }
                  />
                ) : (
                  visibleNotices.length > 0 && (
                    <div className="space-y-2">
                      {visibleNotices.map((notice) => (
                        <NoticeItem
                          key={notice.id}
                          notice={notice}
                          isRead={readNotices.includes(notice.id)}
                          onMarkRead={() =>
                            markNoticeAsRead.mutate(notice.id)
                          }
                          onOpenMandatory={() => setMandatoryNotice(notice)}
                        />
                      ))}
                    </div>
                  )
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Footer único — limpa SOMENTE o tipo selecionado */}
          {canClearCurrentTab && (
            <div className="px-6 py-3 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground hover:text-destructive"
                onClick={clearCurrentTab}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {tab === 'notifications'
                  ? onlyUnreadNotifs
                    ? 'Limpar não lidas'
                    : 'Limpar notificações'
                  : onlyUnreadNotices
                    ? 'Dispensar avisos não lidos'
                    : 'Dispensar avisos'}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {mandatoryNotice && (
        <MandatoryNoticeModal
          notice={mandatoryNotice}
          onConfirm={handleConfirmMandatory}
        />
      )}
    </>
  );
}

/* ───────── helpers ───────── */

function FilterBar({
  onlyUnread,
  onToggleUnread,
  unreadCount,
  rightSlot,
}: {
  onlyUnread: boolean;
  onToggleUnread: () => void;
  unreadCount: number;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="px-6 pb-2 flex items-center justify-between gap-2">
      <Button
        type="button"
        variant={onlyUnread ? 'secondary' : 'ghost'}
        size="sm"
        onClick={onToggleUnread}
        className={cn(
          'h-7 px-2 text-xs gap-1.5 !ring-0',
          'transition-colors',
        )}
        aria-pressed={onlyUnread}
      >
        <Filter className="h-3 w-3" />
        Só não lidas
        {unreadCount > 0 && (
          <Badge
            variant={onlyUnread ? 'default' : 'outline'}
            className="ml-1 h-4 min-w-4 px-1 text-[10px] leading-none"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>
      <div className="flex items-center">{rightSlot}</div>
    </div>
  );
}

function EmptyState({
  icon,
  text,
}: {
  icon?: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground">
      {icon && <div className="mb-3">{icon}</div>}
      <p>{text}</p>
    </div>
  );
}

function NoticeItem({
  notice,
  isRead,
  onMarkRead,
  onOpenMandatory,
}: {
  notice: Notice;
  isRead: boolean;
  onMarkRead: () => void;
  onOpenMandatory: () => void;
}) {
  const needsMandatory = notice.requires_confirmation && !isRead;

  return (
    <div
      className={cn(
        'p-3 rounded-lg border-l-4 transition-colors',
        priorityBorder[notice.priority],
        isRead ? 'bg-muted/30 opacity-70' : 'bg-card hover:bg-accent/40',
        needsMandatory && 'ring-1 ring-amber-500/30',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'p-1.5 rounded-full shrink-0',
            noticeCategoryColors[notice.category],
          )}
        >
          {noticeIcons[notice.category]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <h4 className={cn('text-sm', !isRead && 'font-medium')}>
              {notice.title}
            </h4>
            {!isRead && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                Novo
              </Badge>
            )}
            {needsMandatory && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 text-amber-600 border-amber-500/50"
              >
                <Shield className="h-2.5 w-2.5 mr-0.5" />
                Obrigatório
              </Badge>
            )}
          </div>
          {notice.content && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {notice.content}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            {format(new Date(notice.starts_at), "d 'de' MMM, HH:mm", {
              locale: ptBR,
            })}
          </p>
        </div>
        {!isRead && (
          <div className="flex gap-1 shrink-0">
            {notice.requires_confirmation ? (
              <Button
                size="sm"
                onClick={onOpenMandatory}
                className="h-7 px-2 text-xs"
              >
                <Shield className="h-3 w-3 mr-1" />
                Confirmar
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                onClick={onMarkRead}
                className="h-7 w-7"
                aria-label="Descartar aviso"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
        {isRead && notice.requires_confirmation && (
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-[11px] shrink-0">
            <Check className="h-3.5 w-3.5" />
            <span>Confirmado</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PendingInviteItem({
  invite,
  onAccept,
  isAccepting,
}: {
  invite: PendingWorkspaceInvite;
  onAccept: () => void;
  isAccepting: boolean;
}) {
  return (
    <div className="p-3 rounded-lg border-l-4 border-primary bg-primary/5 hover:bg-primary/10 transition-colors">
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-full bg-primary/15 text-primary shrink-0">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <h4 className="text-sm font-medium">Convite para workspace</h4>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              Pendente
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Você foi convidado para{' '}
            <strong className="text-foreground">
              "{invite.workspace_name}"
            </strong>{' '}
            como <strong>{invite.role}</strong>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Expira{' '}
            {formatDistanceToNow(new Date(invite.expires_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </p>
        </div>
        <Button
          size="sm"
          onClick={onAccept}
          disabled={isAccepting}
          className="shrink-0 h-7 px-2 text-xs"
        >
          {isAccepting ? 'Aceitando...' : 'Aceitar'}
        </Button>
      </div>
    </div>
  );
}
