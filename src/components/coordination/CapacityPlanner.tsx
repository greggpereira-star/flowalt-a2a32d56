import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Users,
  TrendingUp,
  BarChart3,
  Zap,
} from 'lucide-react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  subWeeks, 
  eachDayOfInterval, 
  isSameDay,
  isWeekend,
  addDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Card as CardType } from '@/hooks/useCards';
import type { WorkspaceMember } from '@/hooks/useWorkspaceMembers';

interface CapacityPlannerProps {
  cards: CardType[];
  members: Array<{
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    weekly_hours: number;
    allocated_hours: number;
    active_cards: number;
    available_hours: number;
  }>;
  onCardClick?: (cardId: string) => void;
}

interface DayAllocation {
  date: Date;
  cards: Array<{
    card: CardType;
    hoursOnDay: number;
  }>;
  totalHours: number;
  capacity: number;
  utilization: number;
}

interface MemberSchedule {
  memberId: string;
  memberName: string;
  avatar: string | null;
  weeklyCapacity: number;
  allocatedHours: number;
  utilizationPercent: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dailyAllocations: DayAllocation[];
}

const HOURS_PER_DAY = 8;
const HOURS_PER_WEEK = 40;

export const CapacityPlanner: React.FC<CapacityPlannerProps> = ({
  cards,
  members,
  onCardClick,
}) => {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [viewMode, setViewMode] = useState<'week' | 'two-weeks'>('week');
  
  const weekEnd = viewMode === 'week' 
    ? endOfWeek(currentWeek, { weekStartsOn: 1 })
    : endOfWeek(addWeeks(currentWeek, 1), { weekStartsOn: 1 });
  
  const days = eachDayOfInterval({ start: currentWeek, end: weekEnd }).filter(d => !isWeekend(d));

  // Calculate member schedules
  const memberSchedules = useMemo((): MemberSchedule[] => {
    const activeCards = cards.filter(c => 
      c.status !== 'delivered' && 
      c.status !== 'archived' &&
      c.owner_id
    );

    return members.map(member => {
      const memberCards = activeCards.filter(c => c.owner_id === member.id);
      
      // Calculate daily allocations
      const dailyAllocations: DayAllocation[] = days.map(day => {
        const cardsOnDay: Array<{ card: CardType; hoursOnDay: number }> = [];
        
        memberCards.forEach(card => {
          const cardStart = new Date(card.created_at);
          const cardEnd = card.due_date ? new Date(card.due_date) : addDays(cardStart, 7);
          
          // Check if card is active on this day
          if (day >= cardStart && day <= cardEnd) {
            // Calculate working days for this card
            const allDays = eachDayOfInterval({ start: cardStart, end: cardEnd });
            const workingDays = allDays.filter(d => !isWeekend(d)).length;
            
            const estimatedHours = card.estimated_hours || 4;
            const hoursPerDay = workingDays > 0 ? estimatedHours / workingDays : estimatedHours;
            
            cardsOnDay.push({
              card,
              hoursOnDay: Math.round(hoursPerDay * 10) / 10,
            });
          }
        });
        
        const totalHours = cardsOnDay.reduce((sum, c) => sum + c.hoursOnDay, 0);
        
        return {
          date: day,
          cards: cardsOnDay,
          totalHours: Math.round(totalHours * 10) / 10,
          capacity: HOURS_PER_DAY,
          utilization: Math.round((totalHours / HOURS_PER_DAY) * 100),
        };
      });

      const totalAllocated = dailyAllocations.reduce((sum, d) => sum + d.totalHours, 0);
      const weekCount = viewMode === 'week' ? 1 : 2;
      const weeklyCapacity = HOURS_PER_WEEK * weekCount;
      const utilizationPercent = Math.round((totalAllocated / weeklyCapacity) * 100);
      
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (utilizationPercent > 120) riskLevel = 'critical';
      else if (utilizationPercent > 100) riskLevel = 'high';
      else if (utilizationPercent > 80) riskLevel = 'medium';

      return {
        memberId: member.id,
        memberName: member.name,
        avatar: member.avatar_url,
        weeklyCapacity,
        allocatedHours: Math.round(totalAllocated * 10) / 10,
        utilizationPercent,
        riskLevel,
        dailyAllocations,
      };
    });
  }, [cards, members, days, viewMode]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const overloaded = memberSchedules.filter(m => m.utilizationPercent > 100).length;
    const atRisk = memberSchedules.filter(m => m.riskLevel === 'high' || m.riskLevel === 'critical').length;
    const avgUtilization = memberSchedules.length > 0
      ? Math.round(memberSchedules.reduce((sum, m) => sum + m.utilizationPercent, 0) / memberSchedules.length)
      : 0;
    const totalCapacity = memberSchedules.reduce((sum, m) => sum + m.weeklyCapacity, 0);
    const totalAllocated = memberSchedules.reduce((sum, m) => sum + m.allocatedHours, 0);

    return { overloaded, atRisk, avgUtilization, totalCapacity, totalAllocated };
  }, [memberSchedules]);

  const getRiskColor = (level: string) => {
    const colors: Record<string, string> = {
      critical: 'text-red-600 bg-red-500/10 border-red-500/20',
      high: 'text-orange-600 bg-orange-500/10 border-orange-500/20',
      medium: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20',
      low: 'text-green-600 bg-green-500/10 border-green-500/20',
    };
    return colors[level] || colors.low;
  };

  const getUtilizationColor = (percent: number) => {
    if (percent > 120) return 'bg-red-500';
    if (percent > 100) return 'bg-orange-500';
    if (percent > 80) return 'bg-yellow-500';
    if (percent > 50) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
  };

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium">
            {format(currentWeek, "dd MMM", { locale: ptBR })} - {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(v: 'week' | 'two-weeks') => setViewMode(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">1 Semana</SelectItem>
              <SelectItem value="two-weeks">2 Semanas</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Hoje
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{members.length}</p>
                <p className="text-xs text-muted-foreground">Membros</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{summaryStats.avgUtilization}%</p>
                <p className="text-xs text-muted-foreground">Utilização Média</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={summaryStats.overloaded > 0 ? 'border-orange-500/50' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn("h-5 w-5", summaryStats.overloaded > 0 ? "text-orange-500" : "text-muted-foreground")} />
              <div>
                <p className={cn("text-2xl font-bold", summaryStats.overloaded > 0 && "text-orange-500")}>
                  {summaryStats.overloaded}
                </p>
                <p className="text-xs text-muted-foreground">Sobrecarregados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(summaryStats.totalAllocated)}h
                </p>
                <p className="text-xs text-muted-foreground">
                  de {summaryStats.totalCapacity}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Capacity Grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Planejamento de Capacidade
          </CardTitle>
          <CardDescription>
            Visualização da alocação diária por membro
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="min-w-[800px]">
              {/* Header row with days */}
              <div className="flex border-b pb-2 mb-2">
                <div className="w-48 shrink-0 font-medium text-sm">Membro</div>
                <div className="w-20 shrink-0 text-center font-medium text-sm">Total</div>
                {days.map((day, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "flex-1 min-w-[80px] text-center text-sm",
                      isSameDay(day, new Date()) && "font-bold text-primary"
                    )}
                  >
                    <div className="font-medium">{format(day, 'EEE', { locale: ptBR })}</div>
                    <div className="text-xs text-muted-foreground">{format(day, 'dd/MM')}</div>
                  </div>
                ))}
              </div>

              {/* Member rows */}
              <div className="space-y-3">
                {memberSchedules.map(schedule => (
                  <div key={schedule.memberId} className="flex items-center">
                    {/* Member info */}
                    <div className="w-48 shrink-0 flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={schedule.avatar || undefined} />
                        <AvatarFallback className="text-xs">
                          {schedule.memberName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{schedule.memberName}</p>
                        <Badge 
                          variant="outline" 
                          className={cn("text-[10px] h-4", getRiskColor(schedule.riskLevel))}
                        >
                          {schedule.utilizationPercent}%
                        </Badge>
                      </div>
                    </div>

                    {/* Total hours */}
                    <div className="w-20 shrink-0 text-center">
                      <span className={cn(
                        "text-sm font-medium",
                        schedule.utilizationPercent > 100 && "text-orange-500"
                      )}>
                        {schedule.allocatedHours}h
                      </span>
                    </div>

                    {/* Daily cells */}
                    {schedule.dailyAllocations.map((dayAlloc, i) => (
                      <TooltipProvider key={i}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div 
                              className={cn(
                                "flex-1 min-w-[80px] h-12 mx-0.5 rounded-md relative overflow-hidden cursor-pointer transition-colors hover:ring-1 hover:ring-primary",
                                "bg-muted/50",
                                isSameDay(dayAlloc.date, new Date()) && "ring-1 ring-primary/50"
                              )}
                            >
                              {/* Utilization bar */}
                              <div 
                                className={cn(
                                  "absolute bottom-0 left-0 right-0 transition-all",
                                  getUtilizationColor(dayAlloc.utilization)
                                )}
                                style={{ height: `${Math.min(dayAlloc.utilization, 100)}%` }}
                              />
                              
                              {/* Overflow indicator */}
                              {dayAlloc.utilization > 100 && (
                                <div 
                                  className="absolute top-0 left-0 right-0 bg-red-500/30"
                                  style={{ height: `${Math.min(dayAlloc.utilization - 100, 50)}%` }}
                                />
                              )}

                              {/* Hours label */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className={cn(
                                  "text-xs font-medium",
                                  dayAlloc.utilization > 50 ? "text-white" : "text-foreground"
                                )}>
                                  {dayAlloc.totalHours > 0 ? `${dayAlloc.totalHours}h` : '-'}
                                </span>
                              </div>

                              {/* Card count badge */}
                              {dayAlloc.cards.length > 0 && (
                                <div className="absolute top-0.5 right-0.5">
                                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                                    {dayAlloc.cards.length}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="font-medium">
                              {format(dayAlloc.date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-muted-foreground mb-2">
                              {dayAlloc.totalHours}h alocadas de {dayAlloc.capacity}h
                            </p>
                            {dayAlloc.cards.length > 0 ? (
                              <div className="space-y-1">
                                {dayAlloc.cards.map(({ card, hoursOnDay }) => (
                                  <div 
                                    key={card.id} 
                                    className="text-xs p-1 rounded bg-muted cursor-pointer hover:bg-muted/80"
                                    onClick={() => onCardClick?.(card.id)}
                                  >
                                    <span className="font-medium">{card.title}</span>
                                    <span className="text-muted-foreground ml-1">({hoursOnDay}h)</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">Sem cards alocados</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <Separator className="my-4" />
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="font-medium">Legenda:</span>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span>&lt;50%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-blue-500" />
                  <span>50-80%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-yellow-500" />
                  <span>80-100%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-orange-500" />
                  <span>100-120%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  <span>&gt;120%</span>
                </div>
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
