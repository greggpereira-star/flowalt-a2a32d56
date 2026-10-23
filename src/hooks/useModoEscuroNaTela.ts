import { useEffect } from 'react';

/**
 * Deixa a pagina inteira em modo escuro enquanto a tela esta aberta, e devolve o estado anterior ao sair.
 *
 * O monitor ja era escuro, mas a ficha do card, o aviso de bloqueio e as notificacoes abrem em "portal" (anexados ao body,
 * fora do wrapper escuro) e apareciam em tema claro: um clarao branco sobre o monitor, de noite. A classe `dark` no <html> e o
 * que o app usa (Tailwind darkMode "class", next-themes), entao os portais passam a herdar os tokens escuros.
 *
 * Nao grava nada na preferencia de tema da pessoa (nao chama setTheme). Se o next-themes reaplicar o tema no meio do caminho
 * (ex.: o sistema troca de claro para escuro), o observador devolve a classe.
 */
export function useModoEscuroNaTela() {
  useEffect(() => {
    const raiz = document.documentElement;
    const jaEstavaEscuro = raiz.classList.contains('dark');
    const esquemaAnterior = raiz.style.colorScheme;

    const aplicar = () => {
      if (!raiz.classList.contains('dark')) raiz.classList.add('dark');
      if (raiz.style.colorScheme !== 'dark') raiz.style.colorScheme = 'dark';
    };
    aplicar();

    const observador = new MutationObserver(aplicar);
    observador.observe(raiz, { attributes: true, attributeFilter: ['class', 'style'] });

    return () => {
      observador.disconnect();
      if (!jaEstavaEscuro) raiz.classList.remove('dark');
      raiz.style.colorScheme = esquemaAnterior;
    };
  }, []);
}
