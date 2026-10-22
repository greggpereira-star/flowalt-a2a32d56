import { useEffect, type RefObject } from 'react';
import { proximaPagina } from '@/lib/monitor/rolagem';

// Qualquer uso humano da lista pausa a rolagem automatica: quem esta lendo ou mexendo nao pode ter a tela puxada.
const EVENTOS_DE_USO = ['pointerdown', 'pointermove', 'wheel', 'touchstart', 'keydown', 'focusin'] as const;

interface Opcoes {
  ativo: boolean;
  intervaloMs?: number;
  pausaAposUsoMs?: number;
}

/**
 * Passa as demandas de uma coluna por paginas, de tempos em tempos, quando elas nao cabem na altura da tela, e volta ao inicio
 * no fim. Num monitor sem mouse e a unica forma de ver o que esta abaixo da dobra. Pausa quando a pessoa usa a coluna (e por
 * um tempo depois), quando a aba esta oculta e quando nao ha o que rolar. Com "reduzir movimento" a troca de pagina e seca.
 */
export function useRotacaoDaLista(ref: RefObject<HTMLElement>, { ativo, intervaloMs = 8000, pausaAposUsoMs = 20_000 }: Opcoes) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !ativo) return;

    let pausadoAte = 0;
    const pausar = () => {
      pausadoAte = Date.now() + pausaAposUsoMs;
    };
    EVENTOS_DE_USO.forEach(evento => el.addEventListener(evento, pausar, { passive: true }));

    const passarDePagina = () => {
      if (document.visibilityState !== 'visible' || Date.now() < pausadoAte) return;
      const proxima = proximaPagina(el.scrollTop, el.clientHeight, el.scrollHeight);
      if (proxima === null) return;
      const reduzMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({ top: proxima, behavior: reduzMovimento ? 'auto' : 'smooth' });
    };
    const id = setInterval(passarDePagina, intervaloMs);

    return () => {
      clearInterval(id);
      EVENTOS_DE_USO.forEach(evento => el.removeEventListener(evento, pausar));
    };
  }, [ref, ativo, intervaloMs, pausaAposUsoMs]);
}
