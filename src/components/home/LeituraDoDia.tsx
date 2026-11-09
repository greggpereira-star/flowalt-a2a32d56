import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Info, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Leitura, SeveridadeDaLeitura } from '@/lib/home/leituraDoDia';

const ESTILO: Record<SeveridadeDaLeitura, { icone: typeof Info; cor: string; leitor: string }> = {
  critico: { icone: AlertCircle, cor: 'text-red-600', leitor: 'Crítico:' },
  atencao: { icone: AlertCircle, cor: 'text-amber-600', leitor: 'Atenção:' },
  info: { icone: Lightbulb, cor: 'text-violet-600', leitor: 'Oportunidade:' },
  positivo: { icone: CheckCircle2, cor: 'text-emerald-600', leitor: 'Tudo certo:' },
};

/**
 * Leitura do dia: ate 4 recomendacoes geradas por regras sobre os numeros que a Inicio ja carrega (sem IA).
 * Cada linha diz o que aconteceu e, quando existe, qual e o proximo passo (abrir o card ou ir para a tela).
 */
export function LeituraDoDia({ leituras, onAbrirCard }: { leituras: Leitura[]; onAbrirCard: (id: string) => void }) {
  if (leituras.length === 0) return null;
  return (
    <section aria-labelledby="leitura-do-dia" className="rounded-2xl border border-border/60 bg-card p-[21px] shadow-sm">
      <header className="mb-[13px] flex items-center gap-2.5">
        <Lightbulb className="h-7 w-7 rounded-lg bg-amber-500/10 p-1.5 text-amber-500" strokeWidth={1.75} aria-hidden />
        <div>
          <h2 id="leitura-do-dia" className="text-[15px] font-bold leading-tight tracking-tight">
            Leitura do dia
          </h2>
          <p className="text-xs text-muted-foreground">Gerada dos números de hoje, por regras claras.</p>
        </div>
      </header>
      <ul className="space-y-[13px]">
        {leituras.map(l => {
          const { icone: Icone, cor, leitor } = ESTILO[l.severidade];
          return (
            <li key={l.chave} className="flex items-start gap-2.5 text-sm leading-snug">
              <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', cor)} strokeWidth={2} aria-hidden />
              <span className="sr-only">{leitor}</span>
              <span className="min-w-0 flex-1 text-foreground/90">{l.texto}</span>
              {l.acao?.cardId && (
                <button type="button" onClick={() => onAbrirCard(l.acao!.cardId!)} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                  {l.acao.rotulo}
                </button>
              )}
              {l.acao?.to && (
                <Link to={l.acao.to} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                  {l.acao.rotulo}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
