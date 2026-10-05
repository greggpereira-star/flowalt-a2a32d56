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
  MoreHorizontal,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useNewUiBeta } from '@/hooks/useNewUiBeta';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

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
import { toast } from 'sonner';
import { resolveCardTarget } from '@/lib/cards/resolveCardSpace';
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
  const { alertas: novo } = useNewUiBeta();
  const [open, setOpen] = useState(false);
  
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
      const notificationSpaceId = notification.metadata.space_id as string | undefined;

      // O espaço vem de resolveCardTarget, que valida a dica da notificação
      // contra os vínculos reais em `card_spaces` (ver a função para o porquê).
      const target = await resolveCardTarget(cardId, notificationSpaceId);
      const spaceId = target.spaceId;

      // Metade das notificações do workspace aponta para cards arquivados
      // depois que o aviso foi criado. O link continua correto, mas abrir sem
      // dizer nada faz a pessoa achar que caiu no quadro errado.
      if (target.isArchived) {
        toast.info('Este card foi arquivado', {
          description: 'Ele não aparece mais no quadro ativo. Você está vendo o histórico.',
        });
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

  /* ── Lista unificada (notificações + avisos) ── */
  type FeedItem =
    | { kind: 'notification'; id: string; createdAt: string; isUnread: boolean; data: Notification }
    | { kind: 'notice'; id: string; createdAt: string; isUnread: boolean; data: Notice };

  const [onlyUnread, setOnlyUnread] = useState(false);

  const feedItems = useMemo<FeedItem[]>(() => {
    const fromNotifications: FeedItem[] = notifications.map((n) => ({
      kind: 'notification',
      id: `notif-${n.id}`,
      createdAt: n.created_at,
      isUnread: !n.is_read,
      data: n,
    }));
    const fromNotices: FeedItem[] = notices.map((n) => ({
      kind: 'notice',
      id: `notice-${n.id}`,
      createdAt: n.starts_at,
      isUnread: !readNotices.includes(n.id),
      data: n,
    }));
    return [...fromNotifications, ...fromNotices].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [notifications, notices, readNotices]);

  const visibleFeed = useMemo(
    () => (onlyUnread ? feedItems.filter((i) => i.isUnread) : feedItems),
    [feedItems, onlyUnread],
  );

  const totalUnreadInFeed = useMemo(
    () => feedItems.filter((i) => i.isUnread).length,
    [feedItems],
  );

  /* ── Visual novo: itens agrupados por dia ── */
  const gruposDoFeed = useMemo(() => {
    const grupos: { titulo: string; itens: FeedItem[] }[] = [];
    visibleFeed.forEach((item) => {
      const titulo = grupoDeData(item.createdAt);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.titulo === titulo) ultimo.itens.push(item);
      else grupos.push({ titulo, itens: [item] });
    });
    return grupos;
  }, [visibleFeed]);

  /* ── Limpar tudo (respeitando filtro) ── */
  const clearVisible = () => {
    if (onlyUnread) {
      // marcar tudo que está visível como lido / dispensar
      visibleFeed.forEach((item) => {
        if (item.kind === 'notification') {
          markAsRead.mutate(item.data.id);
        } else if (!item.data.requires_confirmation) {
          markNoticeAsRead.mutate(item.data.id);
        }
      });
    } else {
      // limpar notificações + dispensar avisos não obrigatórios
      clearAll.mutate();
      notices
        .filter((n) => !n.requires_confirmation && !readNotices.includes(n.id))
        .forEach((n) => markNoticeAsRead.mutate(n.id));
    }
  };

  const canClear =
    visibleFeed.some(
      (i) =>
        i.kind === 'notification' ||
        (i.kind === 'notice' && !i.data.requires_confirmation && i.isUnread),
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

        {novo ? (
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[26rem]">
          <SheetHeader className="space-y-0 px-5 pb-3 pr-14 pt-5 text-left">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-xl font-extrabold tracking-tight">Notificações</SheetTitle>
              {totalUnread > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary-foreground">
                  {totalUnread}
                </span>
              )}
            </div>
            <p className="pt-0.5 text-[13px] text-muted-foreground">
              {totalUnreadInFeed > 0
                ? `${totalUnreadInFeed} ${totalUnreadInFeed === 1 ? 'não lida' : 'não lidas'}`
                : 'Tudo em dia'}
            </p>
          </SheetHeader>

          {/* Todas | Não lidas  +  ações */}
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-5 pb-3">
            <div className="flex gap-1 rounded-xl border border-border/60 bg-card p-1" role="tablist" aria-label="Filtro das notificações">
              {([['todas', 'Todas', 0], ['nao-lidas', 'Não lidas', totalUnreadInFeed]] as const).map(([chave, rotulo, n]) => {
                const ativo = (chave === 'nao-lidas') === onlyUnread;
                return (
                  <button
                    key={chave}
                    type="button"
                    role="tab"
                    aria-selected={ativo}
                    onClick={() => setOnlyUnread(chave === 'nao-lidas')}
                    className={cn(
                      'rounded-lg px-3 py-1 text-[13px] font-semibold transition-colors',
                      ativo ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {rotulo}
                    {n > 0 && <span className="ml-1.5 opacity-70 tabular-nums">{n > 99 ? '99+' : n}</span>}
                  </button>
                );
              })}
            </div>

            {(totalUnreadInFeed > 0 || canClear) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" aria-label="Mais ações">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
                  {totalUnreadInFeed > 0 && (
                    <DropdownMenuItem
                      className="h-9 gap-2.5 rounded-lg text-[13px] font-medium"
                      onClick={() => {
                        if (unreadNotifications > 0) markAllAsRead.mutate();
                        notices
                          .filter((n) => !n.requires_confirmation && !readNotices.includes(n.id))
                          .forEach((n) => markNoticeAsRead.mutate(n.id));
                      }}
                    >
                      <CheckCheck className="h-4 w-4 text-muted-foreground" />
                      Marcar todas como lidas
                    </DropdownMenuItem>
                  )}
                  {canClear && (
                    <>
                      {totalUnreadInFeed > 0 && <DropdownMenuSeparator className="my-1.5" />}
                      <DropdownMenuItem
                        className="h-9 gap-2.5 rounded-lg text-[13px] font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
                        onClick={clearVisible}
                      >
                        <Trash2 className="h-4 w-4" />
                        {onlyUnread ? 'Limpar não lidas' : 'Limpar tudo'}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="px-3 pb-8 pt-2">
              {birthdaysVisible && (
                <div className="mb-3 px-2">
                  <BirthdaysAlertCard
                    members={otherBirthdays}
                    onDismiss={dismissBirthdays}
                    onOpenCalendar={() => {
                      navigate('/birthdays');
                      setOpen(false);
                    }}
                  />
                </div>
              )}

              {pendingInvites.length > 0 && (
                <div className="mb-3 space-y-2 px-2">
                  {pendingInvites.map((invite) => (
                    <PendingInviteItem
                      key={invite.id}
                      invite={invite}
                      onAccept={() => handleAcceptInvite(invite.token)}
                      isAccepting={acceptInvite.isPending}
                    />
                  ))}
                </div>
              )}

              {(loadingNotifications || loadingNotices || loadingInvites) && feedItems.length === 0 ? (
                <div className="space-y-2 px-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-[72px] animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : visibleFeed.length === 0 && !birthdaysVisible && pendingInvites.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-16 text-center">
                  <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                    <CheckCheck className="h-6 w-6" />
                  </span>
                  <p className="text-[15px] font-bold">{onlyUnread ? 'Nada não lido' : 'Tudo em dia'}</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {onlyUnread ? 'Você já viu tudo por aqui.' : 'Quando algo precisar da sua atenção, aparece aqui.'}
                  </p>
                </div>
              ) : (
                gruposDoFeed.map((grupo) => (
                  <section key={grupo.titulo} className="mt-3 first:mt-1">
                    <h3 className="mb-1 px-3 text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground/80">
                      {grupo.titulo}
                    </h3>
                    <ul className="space-y-0.5">
                      {grupo.itens.map((item) =>
                        item.kind === 'notification' ? (
                          <li key={item.id}>
                            <NotificationRowNovo
                              notification={item.data}
                              onClick={() => handleNotificationClick(item.data)}
                              onMarkRead={() => markAsRead.mutate(item.data.id)}
                              onDelete={() => deleteNotification.mutate(item.data.id)}
                            />
                          </li>
                        ) : (
                          <li key={item.id}>
                            <NoticeRowNovo
                              notice={item.data}
                              isRead={!item.isUnread}
                              onMarkRead={() => markNoticeAsRead.mutate(item.data.id)}
                              onOpenMandatory={() => setMandatoryNotice(item.data)}
                            />
                          </li>
                        ),
                      )}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </ScrollArea>
        </SheetContent>
        ) : (
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

          {/* ───────── Filtro + ações ───────── */}
          <div className="px-6 pt-3 pb-2 flex items-center justify-between gap-2 border-b border-border/60">
            <Button
              type="button"
              variant={onlyUnread ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setOnlyUnread((v) => !v)}
              className="h-7 px-2 text-xs gap-1.5 !ring-0"
              aria-pressed={onlyUnread}
            >
              <Filter className="h-3 w-3" />
              Só não lidas
              {totalUnreadInFeed > 0 && (
                <Badge
                  variant={onlyUnread ? 'default' : 'outline'}
                  className="ml-1 h-4 min-w-4 px-1 text-[10px] leading-none"
                >
                  {totalUnreadInFeed > 9 ? '9+' : totalUnreadInFeed}
                </Badge>
              )}
            </Button>

            {totalUnreadInFeed > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  if (unreadNotifications > 0) markAllAsRead.mutate();
                  notices
                    .filter((n) => !n.requires_confirmation && !readNotices.includes(n.id))
                    .forEach((n) => markNoticeAsRead.mutate(n.id));
                }}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Marcar lidas
              </Button>
            )}
          </div>

          {/* ───────── Lista unificada ───────── */}
          <ScrollArea className="flex-1 min-h-0 px-6 py-3">
            {/* Aniversariantes do dia — destaque acionável */}
            {birthdaysVisible && (
              <div className="mb-3">
                <BirthdaysAlertCard
                  members={otherBirthdays}
                  onDismiss={dismissBirthdays}
                  onOpenCalendar={() => {
                    navigate('/birthdays');
                    setOpen(false);
                  }}
                />
              </div>
            )}

            {/* Convites pendentes */}
            {pendingInvites.length > 0 && (
              <div className="mb-3 space-y-2">
                {pendingInvites.map((invite) => (
                  <PendingInviteItem
                    key={invite.id}
                    invite={invite}
                    onAccept={() => handleAcceptInvite(invite.token)}
                    isAccepting={acceptInvite.isPending}
                  />
                ))}
              </div>
            )}

            {/* Loading */}
            {(loadingNotifications || loadingNotices || loadingInvites) &&
            feedItems.length === 0 ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-lg bg-muted animate-pulse"
                  />
                ))}
              </div>
            ) : visibleFeed.length === 0 &&
              !birthdaysVisible &&
              pendingInvites.length === 0 ? (
              <EmptyState
                icon={<Bell className="h-10 w-10 opacity-50" />}
                text={
                  onlyUnread
                    ? 'Nada não lido por aqui'
                    : 'Tudo em dia. Sem alertas no momento.'
                }
              />
            ) : (
              <ul className="space-y-1.5">
                {visibleFeed.map((item) =>
                  item.kind === 'notification' ? (
                    <li key={item.id}>
                      <NotificationRow
                        notification={item.data}
                        onClick={() => handleNotificationClick(item.data)}
                        onMarkRead={() => markAsRead.mutate(item.data.id)}
                        onDelete={() => deleteNotification.mutate(item.data.id)}
                      />
                    </li>
                  ) : (
                    <li key={item.id}>
                      <NoticeRow
                        notice={item.data}
                        isRead={!item.isUnread}
                        onMarkRead={() => markNoticeAsRead.mutate(item.data.id)}
                        onOpenMandatory={() => setMandatoryNotice(item.data)}
                      />
                    </li>
                  ),
                )}
              </ul>
            )}
          </ScrollArea>

          {/* Footer único */}
          {canClear && (
            <div className="px-6 py-3 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground hover:text-destructive"
                onClick={clearVisible}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {onlyUnread ? 'Limpar não lidas' : 'Limpar tudo'}
              </Button>
            </div>
          )}
        </SheetContent>
        )}
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

/* ───────── Birthdays alert card ───────── */

function BirthdaysAlertCard({
  members,
  onDismiss,
  onOpenCalendar,
}: {
  members: Array<{
    user_id: string;
    full_name: string;
    avatar_url: string | null;
  }>;
  onDismiss: () => void;
  onOpenCalendar: () => void;
}) {
  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const message = (() => {
    if (members.length === 1) {
      const first = members[0].full_name.split(' ')[0];
      return (
        <>
          Hoje é aniversário de{' '}
          <span className="font-semibold text-foreground">{first}</span>. Não
          esqueça de parabenizar! 🎉
        </>
      );
    }
    const names = members
      .map((p) => p.full_name.split(' ')[0])
      .join(', ')
      .replace(/, ([^,]*)$/, ' e $1');
    return (
      <>
        Hoje é aniversário de{' '}
        <span className="font-semibold text-foreground">{names}</span>. Mande
        seus parabéns! 🎉
      </>
    );
  })();

  return (
    <div
      className={cn(
        'p-3 rounded-lg border-l-4 border-pink-400 dark:border-pink-500',
        'bg-pink-50 dark:bg-pink-950/30 hover:bg-pink-100/70 dark:hover:bg-pink-950/40',
        'transition-colors',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-full bg-pink-500/15 text-pink-600 dark:text-pink-400 shrink-0">
          <Cake className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge
              variant="outline"
              className="h-4 px-1.5 text-[9px] uppercase tracking-wide border-pink-300/70 dark:border-pink-700/60 text-pink-700 dark:text-pink-300"
            >
              Aniversário
            </Badge>
          </div>
          <p className="text-sm text-foreground/90">{message}</p>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {members.map((person) => (
              <div
                key={person.user_id}
                className="flex items-center gap-1.5 rounded-full border border-pink-200/70 dark:border-pink-800/60 bg-background/70 px-2 py-0.5"
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage
                    src={person.avatar_url || undefined}
                    alt={person.full_name}
                  />
                  <AvatarFallback className="text-[9px]">
                    {getInitials(person.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[11px] font-medium text-foreground">
                  {person.full_name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onOpenCalendar}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-pink-700 dark:text-pink-300 hover:underline !ring-0"
          >
            <Calendar className="h-3 w-3" />
            Ver calendário de aniversários
          </button>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDismiss}
          className="h-7 w-7 shrink-0"
          aria-label="Dispensar lembrete de aniversariantes"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ───────── Row wrappers (lista unificada) ───────── */

function NotificationRow({
  notification: n,
  onClick,
  onMarkRead,
  onDelete,
}: {
  notification: Notification;
  onClick: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg p-3 border border-transparent',
        'hover:bg-accent/50 transition-colors',
        !n.is_read && 'bg-muted/40 border-border/60',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {notificationIcons[n.type] || <Bell className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Badge
              variant="outline"
              className="h-4 px-1.5 text-[9px] uppercase tracking-wide text-muted-foreground"
            >
              Notificação
            </Badge>
            {!n.is_read && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-primary"
                aria-hidden
              />
            )}
          </div>
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
                onMarkRead();
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
              onDelete();
            }}
            aria-label="Remover"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </button>
  );
}

function NoticeRow({
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
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <Badge
              variant="outline"
              className="h-4 px-1.5 text-[9px] uppercase tracking-wide text-muted-foreground"
            >
              Aviso
            </Badge>
            {needsMandatory && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 text-amber-600 border-amber-500/50"
              >
                <Shield className="h-2.5 w-2.5 mr-0.5" />
                Obrigatório
              </Badge>
            )}
            {!isRead && !needsMandatory && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-primary"
                aria-hidden
              />
            )}
          </div>
          <h4 className={cn('text-sm', !isRead && 'font-medium')}>
            {notice.title}
          </h4>
          {notice.content && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
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


/* ───────── Visual novo ───────── */

function grupoDeData(iso: string) {
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((dia(new Date()) - dia(new Date(iso))) / 86400000);
  if (diff <= 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff <= 7) return 'Esta semana';
  if (diff <= 30) return 'Este mês';
  return 'Mais antigas';
}

function NotificationRowNovo({
  notification: n,
  onClick,
  onMarkRead,
  onDelete,
}: {
  notification: Notification;
  onClick: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'group relative flex items-start gap-1 rounded-xl py-1 pl-4 pr-1 transition-colors hover:bg-muted/60',
        !n.is_read && 'bg-primary/[0.05]',
      )}
    >
      {!n.is_read && <span className="absolute left-1.5 top-[1.3rem] h-1.5 w-1.5 rounded-full bg-primary" aria-label="Não lida" />}
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-1 py-2 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
          {notificationIcons[n.type] || <Bell className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('line-clamp-2 text-[14px] leading-snug', n.is_read ? 'font-medium' : 'font-bold')}>{n.title}</span>
          <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{n.message}</span>
          <span className="mt-1 block text-[11.5px] text-muted-foreground/80">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 gap-0.5 pt-2 md:opacity-0 md:transition-opacity md:focus-within:opacity-100 md:group-hover:opacity-100">
        {!n.is_read && (
          <Button variant="ghost" size="icon" className="hidden h-8 w-8 rounded-lg md:inline-flex" onClick={onMarkRead} aria-label="Marcar como lida">
            <Check className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          aria-label="Remover"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function NoticeRowNovo({
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
  const obrigatorio = notice.requires_confirmation && !isRead;
  const importante = notice.priority === 'high' || notice.priority === 'critical';
  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 rounded-xl py-3 pl-4 pr-3 transition-colors hover:bg-muted/60',
        !isRead && 'bg-primary/[0.05]',
        isRead && 'opacity-75',
      )}
    >
      {!isRead && !obrigatorio && <span className="absolute left-1.5 top-[1.6rem] h-1.5 w-1.5 rounded-full bg-primary" aria-label="Não lido" />}
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', noticeCategoryColors[notice.category])}>
        {noticeIcons[notice.category]}
      </span>
      <div className="min-w-0 flex-1">
        {(obrigatorio || importante) && (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {obrigatorio && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-bold text-amber-700 dark:text-amber-400">
                <Shield className="h-3 w-3" />
                Confirmação obrigatória
              </span>
            )}
            {importante && !obrigatorio && (
              <span className="inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-[10.5px] font-bold text-destructive">
                {notice.priority === 'critical' ? 'Crítico' : 'Importante'}
              </span>
            )}
          </div>
        )}
        <p className={cn('line-clamp-2 text-[14px] leading-snug', isRead ? 'font-medium' : 'font-bold')}>{notice.title}</p>
        {notice.content && (
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{notice.content}</p>
        )}
        <p className="mt-1 text-[11.5px] text-muted-foreground/80">
          {format(new Date(notice.starts_at), "d 'de' MMM, HH:mm", { locale: ptBR })}
        </p>
        {obrigatorio && (
          <Button size="sm" onClick={onOpenMandatory} className="mt-2.5 h-8 rounded-lg px-3 text-xs font-semibold">
            <Shield className="mr-1.5 h-3.5 w-3.5" />
            Confirmar leitura
          </Button>
        )}
      </div>
      {!isRead && !notice.requires_confirmation && (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-lg" onClick={onMarkRead} aria-label="Descartar aviso">
          <X className="h-4 w-4" />
        </Button>
      )}
      {isRead && notice.requires_confirmation && (
        <span className="flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" />
          Confirmado
        </span>
      )}
    </div>
  );
}
