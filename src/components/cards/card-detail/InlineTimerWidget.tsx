import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useTimeEntries,
  useRunningTimer,
  useStartTimer,
  useStopTimer,
} from '@/hooks/useTimeEntries';
import { useCard } from '@/hooks/useCards';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InlineTimerWidgetProps {
  cardId: string;
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  return `${pad(minutes)}:${pad(secs)}`;
};

export const InlineTimerWidget: React.FC<InlineTimerWidgetProps> = ({ cardId }) => {
  const { data: card } = useCard(cardId);
  const { data: entries } = useTimeEntries(cardId);
  const { data: runningTimer } = useRunningTimer(cardId);
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!runningTimer) { setElapsed(0); return; }
    const t0 = new Date(runningTimer.started_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - t0) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [runningTimer]);

  const totalSec = entries?.reduce((a, e) => a + e.duration_seconds, 0) || 0;
  const totalH = (totalSec / 3600).toFixed(1);
  const estH = card?.estimated_hours;
  const isOver = estH ? totalSec / 3600 > estH : false;
  const isRunning = !!runningTimer;
  const isPending = startTimer.isPending || stopTimer.isPending;

  const handleToggle = async () => {
    if (isRunning) {
      await stopTimer.mutateAsync({ id: runningTimer!.id, card_id: cardId });
    } else {
      await startTimer.mutateAsync({ card_id: cardId });
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all duration-300',
        isRunning
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
          : 'border-border bg-muted/30 hover:border-primary/30'
      )}
    >
      {/* Play/Pause Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant={isRunning ? 'destructive' : 'default'}
            className={cn(
              'h-11 w-11 rounded-full flex-shrink-0 shadow-sm transition-transform hover:scale-105',
              !isRunning && 'bg-primary hover:bg-primary/90'
            )}
            onClick={handleToggle}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isRunning ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isRunning ? 'Pausar timer' : 'Iniciar timer'}</TooltipContent>
      </Tooltip>

      {/* Timer Display */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-mono font-bold text-xl tracking-tight tabular-nums',
              isRunning ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {isRunning ? formatDuration(elapsed) : '00:00'}
          </span>
          {isRunning && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
          )}
        </div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {isRunning ? 'Timer em execução' : 'Contador de tempo'}
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-center">
              <p className={cn(
                'text-sm font-bold tabular-nums',
                isOver ? 'text-destructive' : 'text-foreground'
              )}>
                {totalH}h
              </p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Trabalhado</p>
            </div>
          </TooltipTrigger>
          <TooltipContent>Total de horas trabalhadas</TooltipContent>
        </Tooltip>

        {estH != null && estH > 0 && (
          <>
            <div className="h-6 w-px bg-border" />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center">
                  <p className="text-sm font-bold tabular-nums">{estH}h</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Estimado</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>Horas estimadas</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
};
