import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { 
  ArrowRight, 
  AlertTriangle, 
  Clock, 
  Copy, 
  Trash2, 
  Calendar,
  User,
  Flag,
  Lock
} from 'lucide-react';
import { statusConfig } from './CardBadges';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useDuplicationSpaces } from '@/hooks/useDuplicationSpaces';
import type { Card } from '@/hooks/useCards';
import type { CardStatus, CardUrgency } from '@/lib/supabase';

interface CardContextMenuProps {
  children: React.ReactNode;
  card: Card;
  onStatusChange: (status: CardStatus) => void;
  onUrgencyChange: (urgency: CardUrgency) => void;
  onDuplicate: (targetSpaceId?: string) => void;
  onDelete: () => void;
}

const urgencyOptions: { value: CardUrgency; label: string; color: string }[] = [
  { value: 'low', label: 'Baixa', color: 'text-green-500' },
  { value: 'medium', label: 'Média', color: 'text-yellow-500' },
  { value: 'high', label: 'Alta', color: 'text-orange-500' },
  { value: 'critical', label: 'Crítica', color: 'text-destructive' },
];

export const CardContextMenu: React.FC<CardContextMenuProps> = ({
  children,
  card,
  onStatusChange,
  onUrgencyChange,
  onDuplicate,
  onDelete,
}) => {
  const { canDeleteCards } = usePermissions();
  const { user } = useAuth();
  const { data: spaces } = useDuplicationSpaces();
  const otherSpaces = (spaces || []).filter((s) => s.id !== card.space_id);
  
  // User can delete if they're admin OR they created the card
  const isCardCreator = card.created_by === user?.id;
  const canDelete = canDeleteCards || isCardCreator;
  const statuses = (Object.entries(statusConfig) as [CardStatus, typeof statusConfig[CardStatus]][])
    .filter(([status]) => status !== 'briefing');

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {/* Status change submenu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <ArrowRight className="mr-2 h-4 w-4" />
            Mover para
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {statuses.map(([status, config]) => (
              <ContextMenuItem
                key={status}
                onClick={() => onStatusChange(status)}
                disabled={card.status === status}
                className="flex items-center gap-2"
              >
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: `hsl(var(--status-${status}))` }}
                />
                {config.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Urgency change submenu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Flag className="mr-2 h-4 w-4" />
            Prioridade
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-40">
            {urgencyOptions.map((option) => (
              <ContextMenuItem
                key={option.value}
                onClick={() => onUrgencyChange(option.value)}
                disabled={card.urgency === option.value}
                className={option.color}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                {option.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {/* Duplicate submenu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy className="mr-2 h-4 w-4" />
            Duplicar card
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuItem onClick={() => onDuplicate()}>
              <Copy className="mr-2 h-4 w-4" />
              Nesta pasta
            </ContextMenuItem>
            {otherSpaces.length > 0 && <ContextMenuSeparator />}
            {otherSpaces.map((space) => (
              <ContextMenuItem
                key={space.id}
                onClick={() => onDuplicate(space.id)}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                {space.name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem 
          onClick={canDelete ? onDelete : undefined}
          disabled={!canDelete}
          className={canDelete ? "text-destructive focus:text-destructive" : "text-muted-foreground"}
        >
          {canDelete ? (
            <Trash2 className="mr-2 h-4 w-4" />
          ) : (
            <Lock className="mr-2 h-4 w-4" />
          )}
          {canDelete ? 'Arquivar card' : 'Você só pode excluir itens criados por você'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
