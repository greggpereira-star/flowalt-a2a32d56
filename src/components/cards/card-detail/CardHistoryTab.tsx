import React from 'react';
import { useCardHistory } from '@/hooks/useCardHistory';
import { useSpaces } from '@/hooks/useSpaces';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Share2, Clock, CheckSquare, Settings2, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardHistoryTabProps {
  cardId: string;
}

export const CardHistoryTab: React.FC<CardHistoryTabProps> = ({ cardId }) => {
  const { data: history, isLoading } = useCardHistory(cardId);
  const { data: spaces } = useSpaces();

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'space_shared': return <Share2 className="h-3.5 w-3.5" />;
      case 'time_log': return <Clock className="h-3.5 w-3.5" />;
      case 'checklist_change': return <CheckSquare className="h-3.5 w-3.5" />;
      case 'status_change': return <Settings2 className="h-3.5 w-3.5" />;
      default: return <Info className="h-3.5 w-3.5" />;
    }
  };

  const getActionLabel = (item: any) => {
    switch (item.action_type) {
      case 'space_shared':
        const space = spaces?.find(s => s.id === item.new_value?.space_id);
        return `Compartilhou card com: ${space?.name || 'outro setor'}`;
      case 'time_log':
        const hours = (item.new_value?.duration_seconds / 3600).toFixed(2);
        return `Registrou ${hours}h de trabalho`;
      case 'checklist_change':
        const action = item.new_value?.action === 'created' ? 'criou' : (item.new_value?.is_completed ? 'concluiu' : 'reabriu');
        return `${action} item: ${item.new_value?.item_title || 'Checklist'}`;
      case 'status_change':
        return `Alterou status para: ${item.new_value?.status || 'novo status'}`;
      default:
        return 'Realizou uma ação no card';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <p className="text-sm">Nenhum histórico registrado ainda.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-4 py-2">
        {history.map((item) => (
          <div key={item.id} className="flex gap-3">
            <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
              <AvatarImage src={item.user?.avatar_url || undefined} />
              <AvatarFallback className="text-[8px]">
                {item.user?.full_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs font-semibold">
                  {item.user?.full_name || 'Sistema'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 group">
                <div className="p-1 rounded-md bg-background border shadow-sm">
                  {getActionIcon(item.action_type)}
                </div>
                <span className="text-xs text-foreground/80 truncate">
                  {getActionLabel(item)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
