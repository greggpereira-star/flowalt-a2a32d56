import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Play, Pause, Clock, MoreHorizontal, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useTimeEntries,
  useRunningTimer,
  useStartTimer,
  useStopTimer,
  useDeleteTimeEntry,
  type TimeEntry,
} from '@/hooks/useTimeEntries';
import { useCard } from '@/hooks/useCards';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TimeTrackingPanelProps {
  cardId: string;
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
};

const formatHours = (seconds: number): string => {
  const hours = seconds / 3600;
  return hours.toFixed(1);
};

export const TimeTrackingPanel: React.FC<TimeTrackingPanelProps> = ({ cardId }) => {
  const { data: card } = useCard(cardId);
  const { data: entries, isLoading } = useTimeEntries(cardId);
  const { data: runningTimer } = useRunningTimer(cardId);
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const deleteEntry = useDeleteTimeEntry();

  const [currentDuration, setCurrentDuration] = useState(0);

  // Update running timer display
  useEffect(() => {
    if (!runningTimer) {
      setCurrentDuration(0);
      return;
    }

    const startedAt = new Date(runningTimer.started_at).getTime();
    
    const updateDuration = () => {
      const now = Date.now();
      setCurrentDuration(Math.floor((now - startedAt) / 1000));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [runningTimer]);

  const totalSeconds = entries?.reduce((acc, e) => acc + e.duration_seconds, 0) || 0;
  const totalHours = totalSeconds / 3600;

  const handleToggleTimer = async () => {
    if (runningTimer) {
      await stopTimer.mutateAsync({
        id: runningTimer.id,
        card_id: cardId,
      });
    } else {
      await startTimer.mutateAsync({
        card_id: cardId,
      });
    }
  };

  const handleDeleteEntry = async (entry: TimeEntry) => {
    await deleteEntry.mutateAsync({
      id: entry.id,
      card_id: cardId,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timer Control — High Visibility */}
      <Card className={cn(
        'border-2 transition-all duration-300 overflow-hidden',
        runningTimer 
          ? 'border-primary shadow-lg shadow-primary/20 animate-pulse-subtle' 
          : 'border-border hover:border-primary/40'
      )}>
        {/* Animated top bar when running */}
        {runningTimer && (
          <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-primary animate-[shimmer_2s_infinite]" />
        )}
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            {/* Big play/pause button */}
            <Button
              size="lg"
              variant={runningTimer ? 'destructive' : 'default'}
              className={cn(
                "h-16 w-16 rounded-full p-0 flex-shrink-0 shadow-md transition-transform hover:scale-105",
                !runningTimer && "bg-primary hover:bg-primary/90"
              )}
              onClick={handleToggleTimer}
              disabled={startTimer.isPending || stopTimer.isPending}
            >
              {startTimer.isPending || stopTimer.isPending ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : runningTimer ? (
                <Pause className="h-7 w-7" />
              ) : (
                <Play className="h-7 w-7 ml-1" />
              )}
            </Button>

            {/* Timer display */}
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-xs font-semibold uppercase tracking-wider mb-0.5",
                runningTimer ? "text-primary" : "text-muted-foreground"
              )}>
                {runningTimer ? '⏱ Timer em execução' : 'Timer parado'}
              </p>
              <p className={cn(
                "font-mono font-black tracking-tight",
                runningTimer ? "text-4xl text-primary" : "text-3xl text-muted-foreground/60"
              )}>
                {runningTimer ? formatDuration(currentDuration) : '00m 00s'}
              </p>
            </div>

            {/* Estimated vs Actual — compact */}
            <div className="flex gap-3 flex-shrink-0">
              <div className="text-center px-3 py-2 rounded-lg bg-muted/50">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Estimado</p>
                <p className="text-lg font-bold">
                  {card?.estimated_hours ? `${card.estimated_hours}h` : '-'}
                </p>
              </div>
              <div className={cn(
                "text-center px-3 py-2 rounded-lg",
                card?.estimated_hours && totalHours > card.estimated_hours 
                  ? "bg-destructive/10" 
                  : "bg-muted/50"
              )}>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Trabalhado</p>
                <p className={cn(
                  'text-lg font-bold',
                  card?.estimated_hours && totalHours > card.estimated_hours && 'text-destructive'
                )}>
                  {formatHours(totalSeconds)}h
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Entries Log */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Histórico de Tempo ({entries?.length || 0} registros)
        </h3>

        {entries?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum tempo registrado ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries?.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="text-xs">U</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {format(new Date(entry.started_at), "dd MMM", { locale: ptBR })}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.started_at), "HH:mm", { locale: ptBR })}
                      {entry.ended_at && (
                        <> - {format(new Date(entry.ended_at), "HH:mm", { locale: ptBR })}</>
                      )}
                    </span>
                    {entry.is_running && (
                      <Badge variant="secondary" className="text-xs">
                        Em execução
                      </Badge>
                    )}
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {entry.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">
                    {entry.is_running
                      ? formatDuration(currentDuration)
                      : formatDuration(entry.duration_seconds)}
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleDeleteEntry(entry)}
                        className="text-destructive"
                        disabled={entry.is_running}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
