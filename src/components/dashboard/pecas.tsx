import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Peças visuais compartilhadas pelos Dashboards (executor e coordenação).

export const cartao = 'rounded-2xl border border-border/60 bg-card shadow-sm';

// ---------------------------------------------------------------------------
// peças
// ---------------------------------------------------------------------------
export function Variacao({ valor, unidade = '', melhorQuandoMaior = true }: { valor: number | null; unidade?: string; melhorQuandoMaior?: boolean }) {
  if (valor === null) return <span className="text-xs text-muted-foreground">sem base de comparação</span>;
  if (valor === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <Minus className="h-3 w-3" /> igual ao período anterior
      </span>
    );
  }
  const subiu = valor > 0;
  const bom = subiu === melhorQuandoMaior;
  const Seta = subiu ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', bom ? 'text-emerald-600' : 'text-red-600')}>
      <Seta className="h-3 w-3" />
      {subiu ? '+' : '−'}
      {Math.abs(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
      {unidade} vs período anterior
    </span>
  );
}

export function Indicador({
  rotulo,
  valor,
  unidade,
  rodape,
  tom,
}: {
  rotulo: string;
  valor: React.ReactNode;
  unidade?: string;
  rodape: React.ReactNode;
  tom?: 'perigo';
}) {
  return (
    <div className={cn(cartao, 'flex flex-col gap-1 p-5', tom === 'perigo' && 'border-red-300/70')}>
      <p className="text-[13px] font-medium text-muted-foreground">{rotulo}</p>
      <p className={cn('text-[32px] font-extrabold leading-none tracking-tight tabular-nums', tom === 'perigo' && 'text-red-600')}>
        {valor}
        {unidade && <span className="ml-1 text-base font-semibold text-muted-foreground">{unidade}</span>}
      </p>
      <div className="mt-2 border-t border-border/50 pt-2">{rodape}</div>
    </div>
  );
}

export function Bloco({ titulo, subtitulo, children, className, acao }: { titulo: string; subtitulo?: string; children: React.ReactNode; className?: string; acao?: React.ReactNode }) {
  return (
    <section className={cn(cartao, 'p-5', className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold tracking-tight">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitulo}</p>}
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}
