import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMyRunningTimer, useStopTimer } from '@/hooks/useTimeEntries';

const formatar = (segundos: number) => {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const dois = (n: number) => n.toString().padStart(2, '0');
  return `${dois(h)}:${dois(m)}:${dois(s)}`;
};

/**
 * Cronômetro ativo da pessoa, visível em qualquer tela. Sem isto o cronômetro só
 * existia dentro do card aberto, e quem saía de lá esquecia que ele estava rodando.
 */
export const GlobalTimerChip: React.FC = () => {
  const { data: timer } = useMyRunningTimer();
  const parar = useStopTimer();
  const [decorrido, setDecorrido] = useState(0);

  useEffect(() => {
    if (!timer) {
      setDecorrido(0);
      return;
    }
    const inicio = new Date(timer.started_at).getTime();
    const tick = () => setDecorrido(Math.max(0, Math.floor((Date.now() - inicio) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timer]);

  if (!timer) return null;

  const titulo = timer.cards?.title || 'Card';

  return (
    <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 py-1 pl-3 pr-1 text-sm">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <Link
        to="/tempo"
        className="max-w-[10rem] truncate text-xs text-muted-foreground hover:text-foreground sm:max-w-[16rem]"
        title={`Cronômetro rodando em: ${titulo}`}
      >
        {titulo}
      </Link>
      <span className="font-mono text-xs font-semibold tabular-nums text-primary">{formatar(decorrido)}</span>
      <Button
        size="icon"
        variant="destructive"
        className="h-6 w-6 rounded-full"
        disabled={parar.isPending}
        onClick={() => parar.mutate({ id: timer.id, card_id: timer.card_id })}
        aria-label="Parar cronômetro"
      >
        {parar.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-2.5 w-2.5" />}
      </Button>
    </div>
  );
};
