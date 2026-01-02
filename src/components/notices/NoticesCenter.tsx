import React, { useState, useEffect } from 'react';
import { useNotices, Notice } from '@/hooks/useNoticesModule';
import { useMyWorkspaceInvites, PendingWorkspaceInvite } from '@/hooks/useMyWorkspaceInvites';
import { useAcceptWorkspaceInvite } from '@/hooks/useWorkspaceInvites';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MandatoryNoticeModal } from './MandatoryNoticeModal';
import { Bell, AlertTriangle, PartyPopper, Calendar, Info, Wrench, FileText, Check, X, Shield, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const categoryIcons: Record<Notice['category'], React.ReactNode> = {
  general: <Info className="h-4 w-4" />,
  urgent: <AlertTriangle className="h-4 w-4" />,
  celebration: <PartyPopper className="h-4 w-4" />,
  holiday: <Calendar className="h-4 w-4" />,
  birthday: <PartyPopper className="h-4 w-4" />,
  maintenance: <Wrench className="h-4 w-4" />,
  policy: <FileText className="h-4 w-4" />,
};

const categoryColors: Record<Notice['category'], string> = {
  general: 'bg-muted text-muted-foreground',
  urgent: 'bg-destructive/10 text-destructive',
  celebration: 'bg-amber-500/10 text-amber-600',
  holiday: 'bg-blue-500/10 text-blue-600',
  birthday: 'bg-pink-500/10 text-pink-600',
  maintenance: 'bg-orange-500/10 text-orange-600',
  policy: 'bg-purple-500/10 text-purple-600',
};

const priorityColors: Record<Notice['priority'], string> = {
  low: 'border-muted',
  normal: 'border-border',
  high: 'border-amber-500',
  critical: 'border-destructive',
};

interface NoticeItemProps {
  notice: Notice;
  isRead: boolean;
  onMarkRead: () => void;
  onOpenMandatory: () => void;
}

const NoticeItem: React.FC<NoticeItemProps> = ({ notice, isRead, onMarkRead, onOpenMandatory }) => {
  const needsMandatoryConfirmation = notice.requires_confirmation && !isRead;

  return (
    <div
      className={cn(
        'p-4 rounded-lg border-l-4 transition-all',
        priorityColors[notice.priority],
        isRead ? 'bg-muted/30 opacity-70' : 'bg-card hover:bg-accent/5',
        needsMandatoryConfirmation && 'ring-2 ring-amber-500/20'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-full', categoryColors[notice.category])}>
          {categoryIcons[notice.category]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className={cn('font-medium', !isRead && 'text-foreground')}>
              {notice.title}
            </h4>
            {!isRead && (
              <Badge variant="secondary" className="text-xs shrink-0">
                Novo
              </Badge>
            )}
            {needsMandatoryConfirmation && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/50 shrink-0">
                <Shield className="h-3 w-3 mr-1" />
                Confirmação obrigatória
              </Badge>
            )}
          </div>
          {notice.content && (
            <p className="text-sm text-muted-foreground line-clamp-2">{notice.content}</p>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>{format(new Date(notice.starts_at), "d 'de' MMM, HH:mm", { locale: ptBR })}</span>
          </div>
        </div>
        {!isRead && (
          <div className="flex gap-1">
            {notice.requires_confirmation ? (
              <Button size="sm" variant="default" onClick={onOpenMandatory} className="gap-1">
                <Shield className="h-3 w-3" />
                Ler e Confirmar
              </Button>
            ) : (
              <Button size="icon" variant="ghost" onClick={onMarkRead} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        {isRead && notice.requires_confirmation && (
          <div className="flex items-center gap-1 text-green-600 text-xs">
            <Check className="h-4 w-4" />
            <span>Confirmado</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface PendingInviteItemProps {
  invite: PendingWorkspaceInvite;
  onAccept: () => void;
  isAccepting: boolean;
}

const PendingInviteItem: React.FC<PendingInviteItemProps> = ({ invite, onAccept, isAccepting }) => {
  return (
    <div className="p-4 rounded-lg border-l-4 border-primary bg-primary/5 hover:bg-primary/10 transition-all">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-primary/20 text-primary">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-medium">Convite para Workspace</h4>
            <Badge variant="secondary" className="text-xs shrink-0">
              Pendente
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Você foi convidado para o workspace <strong>"{invite.workspace_name}"</strong> como <strong>{invite.role}</strong>
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>Expira {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true, locale: ptBR })}</span>
          </div>
        </div>
        <Button 
          size="sm" 
          onClick={onAccept}
          disabled={isAccepting}
          className="shrink-0"
        >
          {isAccepting ? 'Aceitando...' : 'Aceitar'}
        </Button>
      </div>
    </div>
  );
};

export const NoticesCenter: React.FC = () => {
  const { notices, unreadNotices, readNotices, markAsRead, confirmNotice, isLoading } = useNotices();
  const { data: pendingInvites = [], isLoading: loadingInvites } = useMyWorkspaceInvites();
  const acceptInvite = useAcceptWorkspaceInvite();
  const [open, setOpen] = useState(false);
  const [mandatoryNotice, setMandatoryNotice] = useState<Notice | null>(null);

  // Auto-show mandatory notices that require confirmation
  useEffect(() => {
    const pendingMandatory = unreadNotices.find(n => n.requires_confirmation);
    if (pendingMandatory && !mandatoryNotice) {
      // Small delay to allow app to load
      const timer = setTimeout(() => {
        setMandatoryNotice(pendingMandatory);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [unreadNotices, mandatoryNotice]);

  const handleConfirmMandatory = () => {
    if (mandatoryNotice) {
      confirmNotice.mutate(mandatoryNotice.id);
      setMandatoryNotice(null);
    }
  };

  const handleAcceptInvite = (token: string) => {
    acceptInvite.mutate(token, {
      onSuccess: () => setOpen(false),
    });
  };

  const totalUnread = unreadNotices.length + pendingInvites.length;
  const hasPendingMandatory = unreadNotices.some(n => n.requires_confirmation);
  const hasPendingInvites = pendingInvites.length > 0;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className={cn("h-5 w-5", (hasPendingMandatory || hasPendingInvites) && "animate-bounce")} />
            {totalUnread > 0 && (
              <span className={cn(
                "absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs flex items-center justify-center animate-scale-in",
                hasPendingMandatory || hasPendingInvites
                  ? "bg-amber-500 text-white" 
                  : "bg-destructive text-destructive-foreground"
              )}>
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Avisos e Comunicados
              {totalUnread > 0 && (
                <Badge variant="secondary">{totalUnread} pendente{totalUnread > 1 ? 's' : ''}</Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-8rem)] mt-4 pr-4">
            {/* Convites Pendentes - Mostrar primeiro */}
            {pendingInvites.length > 0 && (
              <div className="space-y-3 mb-6">
                <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Convites Pendentes
                </h3>
                {pendingInvites.map(invite => (
                  <PendingInviteItem
                    key={invite.id}
                    invite={invite}
                    onAccept={() => handleAcceptInvite(invite.token)}
                    isAccepting={acceptInvite.isPending}
                  />
                ))}
              </div>
            )}

            {/* Avisos */}
            {isLoading || loadingInvites ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : notices.length === 0 && pendingInvites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhum aviso no momento</p>
              </div>
            ) : notices.length > 0 && (
              <div className="space-y-3">
                {notices.map(notice => (
                  <NoticeItem
                    key={notice.id}
                    notice={notice}
                    isRead={readNotices.includes(notice.id)}
                    onMarkRead={() => markAsRead.mutate(notice.id)}
                    onOpenMandatory={() => setMandatoryNotice(notice)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Mandatory Notice Modal - Blocks the screen */}
      {mandatoryNotice && (
        <MandatoryNoticeModal 
          notice={mandatoryNotice} 
          onConfirm={handleConfirmMandatory}
        />
      )}
    </>
  );
};
