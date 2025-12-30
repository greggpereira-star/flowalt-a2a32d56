import React from 'react';
import { useBadges, BADGE_DEFINITIONS } from '@/hooks/useBadges';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Award, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BadgeProgressProps {
  compact?: boolean;
}

export function BadgeProgress({ compact = false }: BadgeProgressProps) {
  const { allBadges, progress, isLoading } = useBadges();

  if (isLoading) {
    return null;
  }

  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium">{progress.earned}/{progress.total}</span>
          <Progress value={progress.percentage} className="w-20 h-2" />
        </div>
      </TooltipProvider>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              Conquistas
            </CardTitle>
            <CardDescription>
              {progress.earned} de {progress.total} badges desbloqueados
            </CardDescription>
          </div>
          <span className="text-2xl font-bold text-primary">{progress.percentage}%</span>
        </div>
        <Progress value={progress.percentage} className="h-2 mt-2" />
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="grid grid-cols-5 gap-3">
            {allBadges.map((badge) => (
              <Tooltip key={badge.type}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                      badge.earnedAt
                        ? "border-primary bg-primary/5 cursor-pointer hover:bg-primary/10"
                        : "border-muted bg-muted/30 opacity-50"
                    )}
                  >
                    <span className="text-2xl mb-1">
                      {badge.earnedAt ? badge.icon : <Lock className="h-6 w-6 text-muted-foreground" />}
                    </span>
                    <span className={cn(
                      "text-xs text-center font-medium line-clamp-1",
                      !badge.earnedAt && "text-muted-foreground"
                    )}>
                      {badge.name}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p className="font-semibold">{badge.name}</p>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                  {badge.earnedAt && (
                    <p className="text-xs text-primary mt-1">
                      Conquistado {formatDistanceToNow(new Date(badge.earnedAt), { 
                        addSuffix: true,
                        locale: ptBR 
                      })}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
