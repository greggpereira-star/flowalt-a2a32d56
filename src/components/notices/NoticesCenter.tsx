import React, { useState } from 'react';
import { useNotices, Notice } from '@/hooks/useNoticesModule';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, AlertTriangle, PartyPopper, Calendar, Info, Wrench, FileText, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
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
  onConfirm?: () => void;
}

const NoticeItem: React.FC<NoticeItemProps> = ({ notice, isRead, onMarkRead, onConfirm }) => {
  return (
    <div
      className={cn(
        'p-4 rounded-lg border-l-4 transition-all',
        priorityColors[notice.priority],
        isRead ? 'bg-muted/30 opacity-70' : 'bg-card hover:bg-accent/5'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-full', categoryColors[notice.category])}>
          {categoryIcons[notice.category]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={cn('font-medium truncate', !isRead && 'text-foreground')}>
              {notice.title}
            </h4>
            {!isRead && (
              <Badge variant="secondary" className="text-xs shrink-0">
                Novo
              </Badge>
            )}
          </div>
          {notice.content && (
            <p className="text-sm text-muted-foreground line-clamp-2">{notice.content}</p>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>{format(new Date(notice.starts_at), "d 'de' MMM, HH:mm", { locale: ptBR })}</span>
            {notice.requires_confirmation && !isRead && (
              <Badge variant="outline" className="text-xs">
                Requer confirmação
              </Badge>
            )}
          </div>
        </div>
        {!isRead && (
          <div className="flex gap-1">
            {notice.requires_confirmation ? (
              <Button size="sm" variant="default" onClick={onConfirm} className="gap-1">
                <Check className="h-3 w-3" />
                Confirmar
              </Button>
            ) : (
              <Button size="icon" variant="ghost" onClick={onMarkRead} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const NoticesCenter: React.FC = () => {
  const { notices, unreadNotices, readNotices, markAsRead, confirmNotice, isLoading } = useNotices();
  const [open, setOpen] = useState(false);

  const unreadCount = unreadNotices.length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center animate-scale-in">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Avisos e Comunicados
            {unreadCount > 0 && (
              <Badge variant="secondary">{unreadCount} não lidos</Badge>
            )}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4 pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : notices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum aviso no momento</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map(notice => (
                <NoticeItem
                  key={notice.id}
                  notice={notice}
                  isRead={readNotices.includes(notice.id)}
                  onMarkRead={() => markAsRead.mutate(notice.id)}
                  onConfirm={notice.requires_confirmation ? () => confirmNotice.mutate(notice.id) : undefined}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
