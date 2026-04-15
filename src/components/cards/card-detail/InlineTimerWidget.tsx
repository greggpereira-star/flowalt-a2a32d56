import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Loader2, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useTimeEntries,
  useRunningTimer,
  useStartTimer,
  useStopTimer,
} from '@/hooks/useTimeEntries';
import { useCard } from '@/hooks/useCards';

interface InlineTimerWidgetProps {
  cardId: string;
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
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
    <div className="flex items-center min-h-[36px] px-2 py-1 rounded-md transition-all hover:bg-muted/40 group">
      <div className="w-[140px] flex-shrink-0 flex items-center gap-2 text-[13px] text-muted-foreground">
        <Timer className="h-3.5 w-3.5" />
        <span>Rastrear tempo</span>
      </div>
      <div className="flex-1 flex items-center gap-2.5">
        <Button
          size="icon"
          variant={isRunning ? 'destructive' : 'ghost'}
          className={cn(
            'h-6 w-6 rounded-full flex-shrink-0 transition-all',
            !isRunning && 'border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary'
          )}
          onClick={handleToggle}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isRunning ? (
            <Square className="h-2.5 w-2.5" />
          ) : (
            <Play className="h-3 w-3 ml-0.5" />
          )}
        </Button>

        <span
          className={cn(
            'font-mono text-sm tabular-nums',
            isRunning ? 'text-primary font-semibold' : 'text-muted-foreground'
          )}
        >
          {isRunning ? formatDuration(elapsed) : '0:00:00'}
        </span>

        {isRunning && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
        )}

        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
          <span className={cn('tabular-nums', isOver && 'text-destructive font-medium')}>
            {totalH}h
          </span>
          {estH != null && estH > 0 && (
            <>
              <span className="text-muted-foreground/40">/</span>
              <span className="tabular-nums">{estH}h</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
