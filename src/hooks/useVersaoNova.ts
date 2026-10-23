import { useEffect, useState } from 'react';
import { arquivoPrincipalCarregado, arquivoPrincipalDeHtml, temVersaoNova } from '@/lib/monitor/versao';

const INTERVALO_PADRAO_MS = 10 * 60_000;

// Para teste: localStorage "monitor-verificacao-ms" encurta o intervalo (ex.: 5000). Sem isso, 10 minutos.
function intervaloDeVerificacao(): number {
  try {
    const n = Number(localStorage.getItem('monitor-verificacao-ms'));
    return Number.isFinite(n) && n >= 1000 ? n : INTERVALO_PADRAO_MS;
  } catch {
    return INTERVALO_PADRAO_MS;
  }
}

/**
 * Diz se ja existe uma versao nova do Flowalt publicada. Um monitor fica aberto por dias e, sem isso, nunca recebe uma
 * correcao. Compara o arquivo principal desta pagina com o do index.html publicado (o nome muda a cada build). Falha de rede
 * ou resposta estranha nunca contam como "versao nova".
 */
export function useVersaoNova(): boolean {
  const [nova, setNova] = useState(false);

  useEffect(() => {
    const atual = arquivoPrincipalCarregado(document);
    if (!atual) return;
    let cancelado = false;

    const verificar = async () => {
      try {
        const resposta = await fetch('/', { cache: 'no-store', headers: { Accept: 'text/html' } });
        if (!resposta.ok) return;
        const publicada = arquivoPrincipalDeHtml(await resposta.text());
        if (!cancelado && temVersaoNova(atual, publicada)) setNova(true);
      } catch {
        /* sem rede agora: tenta de novo no proximo ciclo */
      }
    };

    const id = setInterval(verificar, intervaloDeVerificacao());
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, []);

  return nova;
}
