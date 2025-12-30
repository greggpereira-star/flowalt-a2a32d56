import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Clock, User, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottleneckCardProps {
  title: string;
  type: 'overdue' | 'blocked' | 'overloaded' | 'stale';
  items: Array<{
    id: string;
    title: string;
    detail: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  icon?: React.ReactNode;
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
}) => {
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
            className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </div>
            <Badge className={cn('ml-2 shrink-0', severityColors[item.severity])}>
              {item.severity}
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
