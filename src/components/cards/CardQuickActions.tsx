import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { 
  MoreHorizontal, 
  ArrowRight, 
  Flag, 
  Copy, 
  Trash2, 
  AlertTriangle,
  Lock
} from 'lucide-react';
import { statusConfig } from './CardBadges';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useDuplicationSpaces } from '@/hooks/useDuplicationSpaces';
import { cn } from '@/lib/utils';
import type { Card } from '@/hooks/useCards';
import type { CardStatus, CardUrgency } from '@/lib/supabase';

interface CardQuickActionsProps {
  card: Card;
  onStatusChange: (status: CardStatus) => void;
  onUrgencyChange: (urgency: CardUrgency) => void;
  onDuplicate: (targetSpaceId?: string, mode?: 'mirror' | 'copy') => void;
  onDelete: () => void;
  className?: string;
}

const urgencyOptions: { value: CardUrgency; label: string; color: string }[] = [
  { value: 'low', label: 'Baixa', color: 'text-green-500' },
  { value: 'medium', label: 'Média', color: 'text-yellow-500' },
  { value: 'high', label: 'Alta', color: 'text-orange-500' },
  { value: 'critical', label: 'Crítica', color: 'text-destructive' },
];

export const CardQuickActions: React.FC<CardQuickActionsProps> = ({
  card,
  onStatusChange,
  onUrgencyChange,
  onDuplicate,
  onDelete,
  className,
}) => {
  const { canDeleteCards } = usePermissions();
  const { user } = useAuth();
  const { data: spaces } = useDuplicationSpaces();
  const otherSpaces = (spaces || []).filter((s) => s.id !== card.space_id);
  
  const isCardCreator = card.created_by === user?.id;
  const canDelete = canDeleteCards || isCardCreator;
  const statuses = (Object.entries(statusConfig) as [CardStatus, typeof statusConfig[CardStatus]][])
    .filter(([status]) => status !== 'briefing');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
            "hover:bg-muted focus-visible:opacity-100",
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Ações rápidas</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-48"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status change submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ArrowRight className="mr-2 h-4 w-4" />
            Mover para
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            {statuses.map(([status, config]) => (
              <DropdownMenuItem
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
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Urgency change submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Flag className="mr-2 h-4 w-4" />
            Prioridade
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-36">
            {urgencyOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onUrgencyChange(option.value)}
                disabled={card.urgency === option.value}
                className={option.color}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Duplicate submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Copy className="mr-2 h-4 w-4" />
            Duplicar card
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60">
            <DropdownMenuItem onClick={() => onDuplicate()}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar nesta pasta
            </DropdownMenuItem>

            {otherSpaces.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Layers className="mr-2 h-4 w-4" />
                    Espelhar em (sincronizado)
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">
                    {otherSpaces.map((space) => (
                      <DropdownMenuItem
                        key={space.id}
                        onClick={() => onDuplicate(space.id, 'mirror')}
                      >
                        <ArrowRight className="mr-2 h-4 w-4" />
                        {space.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar para (independente)
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">
                    {otherSpaces.map((space) => (
                      <DropdownMenuItem
                        key={space.id}
                        onClick={() => onDuplicate(space.id, 'copy')}
                      >
                        <ArrowRight className="mr-2 h-4 w-4" />
                        {space.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem 
          onClick={canDelete ? onDelete : undefined}
          disabled={!canDelete}
          className={canDelete ? "text-destructive focus:text-destructive" : "text-muted-foreground"}
        >
          {canDelete ? (
            <Trash2 className="mr-2 h-4 w-4" />
          ) : (
            <Lock className="mr-2 h-4 w-4" />
          )}
          {canDelete ? 'Arquivar card' : 'Sem permissão'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
