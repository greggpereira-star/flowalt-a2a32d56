import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import type { CapacityAllocation, UserCapacitySummary } from '@/hooks/useCapacity';

interface CapacityOverlayProps {
  userSummaries: UserCapacitySummary[];
  dailyAllocations: CapacityAllocation[];
  weekStart: Date;
  compact?: boolean;
}

export const CapacityOverlay: React.FC<CapacityOverlayProps> = ({
  userSummaries,
  dailyAllocations,
  weekStart,
  compact = false,
}) => {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getRiskColor = (level: 'low' | 'medium' | 'high' | 'critical'): string => {
    switch (level) {
      case 'critical': return 'text-destructive bg-destructive/10';
      case 'high': return 'text-orange-500 bg-orange-500/10';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10';
      default: return 'text-green-500 bg-green-500/10';
    }
  };

  const getUtilizationColor = (percent: number): string => {
    if (percent > 120) return 'bg-destructive';
    if (percent > 100) return 'bg-orange-500';
    if (percent > 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {userSummaries.map(summary => (
          <TooltipProvider key={summary.userId}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  'flex items-center gap-2 px-2 py-1 rounded-md',
                  getRiskColor(summary.riskLevel)
                )}>
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px]">
                      {summary.userName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{summary.utilizationPercent}%</span>
                  {summary.isOverloaded && <AlertTriangle className="h-3 w-3" />}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{summary.userName}</p>
                <p className="text-xs">
                  {summary.totalAllocated}h / {summary.totalCapacity}h
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Capacidade da Equipe
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="space-y-4">
            {userSummaries.map(summary => {
              const userDailyData = dailyAllocations.filter(a => a.userId === summary.userId);
              
              return (
                <div key={summary.userId} className="space-y-2">
                  {/* User header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {summary.userName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{summary.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {summary.totalAllocated}h alocadas de {summary.totalCapacity}h
                        </p>
                      </div>
                    </div>
                    <Badge className={cn('ml-2', getRiskColor(summary.riskLevel))}>
                      {summary.utilizationPercent}%
                      {summary.isOverloaded ? (
                        <AlertTriangle className="h-3 w-3 ml-1" />
                      ) : (
                        <CheckCircle className="h-3 w-3 ml-1" />
                      )}
                    </Badge>
                  </div>

                  {/* Weekly progress */}
                  <Progress 
                    value={Math.min(summary.utilizationPercent, 100)} 
                    className="h-2"
                  />

                  {/* Daily breakdown */}
                  <div className="flex gap-1">
                    {days.map((day, i) => {
                      const dayData = userDailyData.find(d => isSameDay(d.date, day));
                      const utilization = dayData?.utilizationPercent || 0;
                      
                      return (
                        <TooltipProvider key={i}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex-1 text-center">
                                <div className="text-[10px] text-muted-foreground mb-1">
                                  {format(day, 'EEE', { locale: ptBR })}
                                </div>
                                <div className="relative h-8 bg-muted rounded overflow-hidden">
                                  <div
                                    className={cn(
                                      'absolute bottom-0 left-0 right-0 transition-all',
                                      getUtilizationColor(utilization)
                                    )}
                                    style={{ height: `${Math.min(utilization, 100)}%` }}
                                  />
                                  {utilization > 100 && (
                                    <div
                                      className="absolute top-0 left-0 right-0 bg-destructive/50"
                                      style={{ height: `${Math.min(utilization - 100, 50)}%` }}
                                    />
                                  )}
                                </div>
                                <div className="text-[10px] font-medium mt-1">
                                  {dayData?.allocatedHours || 0}h
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">
                                {format(day, 'EEEE, dd/MM', { locale: ptBR })}
                              </p>
                              <p className="text-xs">
                                {dayData?.allocatedHours || 0}h / {dayData?.capacityHours || 8}h
                              </p>
                              {dayData?.cards && dayData.cards.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {dayData.cards.map(card => (
                                    <p key={card.id} className="text-xs text-muted-foreground">
                                      • {card.title} ({card.hours.toFixed(1)}h)
                                    </p>
                                  ))}
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
