import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface Assignee {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface CardAssigneesProps {
  assignees: Assignee[];
  maxVisible?: number;
  size?: 'sm' | 'md';
  className?: string;
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const CardAssignees: React.FC<CardAssigneesProps> = ({
  assignees,
  maxVisible = 2,
  size = 'sm',
  className,
}) => {
  if (assignees.length === 0) {
    return (
      <Avatar className={cn(
        size === 'sm' ? 'h-6 w-6' : 'h-8 w-8',
        className
      )}>
        <AvatarFallback className={cn(
          "bg-muted text-muted-foreground",
          size === 'sm' ? 'text-[10px]' : 'text-xs'
        )}>
          ?
        </AvatarFallback>
      </Avatar>
    );
  }

  const visible = assignees.slice(0, maxVisible);
  const remaining = assignees.length - maxVisible;
  const hiddenNames = assignees.slice(maxVisible).map(a => a.name).join(', ');

  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      {visible.map((assignee) => (
        <Tooltip key={assignee.id}>
          <TooltipTrigger asChild>
            <Avatar className={cn(
              "ring-2 ring-background cursor-pointer transition-transform hover:scale-110 hover:z-10",
              size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
            )}>
              <AvatarImage src={assignee.avatar_url || undefined} alt={assignee.name} />
              <AvatarFallback className={cn(
                "bg-primary/10 text-primary font-medium",
                size === 'sm' ? 'text-[10px]' : 'text-xs'
              )}>
                {getInitials(assignee.name)}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {assignee.name}
          </TooltipContent>
        </Tooltip>
      ))}

      {remaining > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar className={cn(
              "ring-2 ring-background cursor-pointer",
              size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
            )}>
              <AvatarFallback className={cn(
                "bg-muted text-muted-foreground font-medium",
                size === 'sm' ? 'text-[9px]' : 'text-[10px]'
              )}>
                +{remaining}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {hiddenNames}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
