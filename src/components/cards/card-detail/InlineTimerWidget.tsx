import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Loader2 } from 'lucide-react';
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
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2 transition-all',
        isRunning
          ? 'border-primary/50 bg-primary/5'
          : 'border-border bg-muted/20'
      )}
    >
      <Button
        size="icon"
        variant={isRunning ? 'destructive' : 'default'}
        className={cn(
          'h-8 w-8 rounded-full flex-shrink-0',
          !isRunning && 'bg-primary hover:bg-primary/90'
        )}
        onClick={handleToggle}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isRunning ? (
          <Square className="h-3 w-3" />
        ) : (
          <Play className="h-3.5 w-3.5 ml-0.5" />
        )}
      </Button>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span
          className={cn(
            'font-mono text-sm font-semibold tabular-nums',
            isRunning ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {isRunning ? formatDuration(elapsed) : '00:00:00'}
        </span>
        {isRunning && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
        <span className={cn('font-medium tabular-nums', isOver && 'text-destructive')}>
          {totalH}h
        </span>
        {estH != null && estH > 0 && (
          <>
            <span>/</span>
            <span className="font-medium tabular-nums">{estH}h</span>
          </>
        )}
      </div>
    </div>
  );
};
