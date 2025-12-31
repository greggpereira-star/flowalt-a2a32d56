import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Clock, User, TrendingDown, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BottleneckItem {
  id: string;
  title: string;
  detail: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  spaceId?: string;
  spaceName?: string;
  spaceColor?: string;
  ownerId?: string;
  ownerName?: string;
  ownerAvatar?: string;
}

interface BottleneckCardProps {
  title: string;
  type: 'overdue' | 'blocked' | 'overloaded' | 'stale';
  items: BottleneckItem[];
  icon?: React.ReactNode;
  onCardClick?: (cardId: string) => void;
}

const severityColors = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  high: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
  critical: 'bg-destructive/20 text-destructive',
};

const typeIcons = {
  overdue: <AlertTriangle className="h-5 w-5 text-destructive" />,
  blocked: <Clock className="h-5 w-5 text-orange-500" />,
  overloaded: <User className="h-5 w-5 text-yellow-500" />,
  stale: <TrendingDown className="h-5 w-5 text-muted-foreground" />,
};

export const BottleneckCard: React.FC<BottleneckCardProps> = ({
  title,
  type,
  items,
  icon,
  onCardClick,
}) => {
  const navigate = useNavigate();

  const handleDoubleClick = (item: BottleneckItem) => {
    if (item.spaceId) {
      // Navigate to space kanban with card selected
      navigate(`/space/${item.spaceId}?card=${item.id}`);
    }
  };

  const handleClick = (item: BottleneckItem) => {
    if (onCardClick) {
      onCardClick(item.id);
    }
  };

  if (items.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-destructive/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon || typeIcons[type]}
          {title}
          <Badge variant="secondary" className="ml-auto">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.slice(0, 5).map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
            onClick={() => handleClick(item)}
            onDoubleClick={() => handleDoubleClick(item)}
          >
            {/* Owner Avatar */}
            {item.ownerId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-8 w-8 flex-shrink-0 ring-2 ring-background">
                    <AvatarImage src={item.ownerAvatar || undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {(item.ownerName || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs font-medium">{item.ownerName || 'Sem proprietário'}</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{item.title}</p>
              </div>
              
              <div className="flex items-center gap-2 mt-1">
                {/* Space Badge */}
                {item.spaceName && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-background/80 border max-w-[120px]"
                        style={{ 
                          borderColor: item.spaceColor || 'hsl(var(--border))',
                          color: item.spaceColor || 'inherit'
                        }}
                      >
                        <Folder className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{item.spaceName}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">Espaço: {item.spaceName}</p>
                      <p className="text-xs text-muted-foreground">Clique duplo para abrir no Kanban</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Detail */}
                <span className="text-xs text-muted-foreground truncate">
                  {item.detail}
                </span>
              </div>
            </div>

            {/* Severity Badge */}
            <Badge className={cn('shrink-0 text-xs', severityColors[item.severity])}>
              {item.severity === 'critical' ? 'crítico' : 
               item.severity === 'high' ? 'alto' :
               item.severity === 'medium' ? 'médio' : 'baixo'}
            </Badge>
          </div>
        ))}
        {items.length > 5 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            +{items.length - 5} mais itens
          </p>
        )}
      </CardContent>
    </Card>
  );
};
