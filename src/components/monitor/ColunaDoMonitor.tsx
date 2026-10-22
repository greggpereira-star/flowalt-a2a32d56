import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useRotacaoDaLista } from '@/hooks/useRotacaoDaLista';
import { contarEscondidos } from '@/lib/monitor/rolagem';
import { cn } from '@/lib/utils';

interface Props {
  rotulo: string;
  total: number;
  /** Rolagem automatica por paginas quando as demandas nao cabem na altura da coluna. */
  rotacaoAtiva: boolean;
  className?: string;
  /** As demandas, como <li data-demanda>. */
  children: React.ReactNode;
}

/**
 * Coluna do monitor. Se as demandas passam da altura, ela (1) avisa quantas nao estao inteiras na tela ("+2 abaixo") e
 * (2) passa as paginas sozinha. Sem isso, num monitor sem mouse, o que fica abaixo da dobra simplesmente nao existe.
 */
export function ColunaDoMonitor({ rotulo, total, rotacaoAtiva, className, children }: Props) {
  const listaRef = useRef<HTMLUListElement>(null);
  const [escondidos, setEscondidos] = useState({ acima: 0, abaixo: 0 });

  useRotacaoDaLista(listaRef, { ativo: rotacaoAtiva });

  const medir = useCallback(() => {
    const lista = listaRef.current;
    if (!lista) return;
    const faixas = [...lista.querySelectorAll<HTMLElement>(':scope > li[data-demanda]')].map(li => ({ top: li.offsetTop, bottom: li.offsetTop + li.offsetHeight }));
    const novo = contarEscondidos(faixas, lista.scrollTop, lista.scrollTop + lista.clientHeight);
    setEscondidos(atual => (atual.acima === novo.acima && atual.abaixo === novo.abaixo ? atual : novo));
  }, []);

  // Depois de cada renderizacao (demanda entrou, saiu, mudou de tamanho) e a cada rolagem ou mudanca de altura da coluna.
  useLayoutEffect(() => {
    medir();
  });
  useEffect(() => {
    const lista = listaRef.current;
    if (!lista) return;
    lista.addEventListener('scroll', medir, { passive: true });
    const observador = new ResizeObserver(medir);
    observador.observe(lista);
    return () => {
      lista.removeEventListener('scroll', medir);
      observador.disconnect();
    };
  }, [medir]);

  return (
    <section aria-label={rotulo} className={cn('relative flex min-h-0 flex-col rounded-2xl bg-white/[0.04] ring-1 ring-white/10', className)}>
      <h2 className="flex items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
        {rotulo}
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-sm tabular-nums">{total}</span>
      </h2>

      <ul
        ref={listaRef}
        tabIndex={0}
        aria-label={`Demandas de ${rotulo}`}
        className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 [scrollbar-color:theme(colors.slate.600)_transparent] [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        {children}
      </ul>

      {escondidos.acima > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-[3.1rem] flex justify-center bg-gradient-to-b from-slate-950/90 to-transparent pb-6 pt-1" role="status">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-sm font-bold text-sky-300 ring-1 ring-sky-400/50">
            <ArrowUp className="h-4 w-4" aria-hidden /> +{escondidos.acima} acima
          </span>
        </div>
      )}
      {escondidos.abaixo > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center rounded-b-2xl bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent pb-3 pt-10" role="status">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-sm font-bold text-sky-300 ring-1 ring-sky-400/50">
            <ArrowDown className="h-4 w-4" aria-hidden /> +{escondidos.abaixo} abaixo
          </span>
        </div>
      )}
    </section>
  );
}
