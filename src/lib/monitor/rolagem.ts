// Rolagem do monitor: o painel fica num monitor sem mouse, entao o que passa da altura da coluna precisa se mostrar sozinho
// (por paginas) e a coluna precisa dizer quantas demandas ainda nao estao inteiras na tela. Funcoes puras, testadas.

/** Quanto da pagina anterior continua visivel ao passar para a proxima, para o olho nao perder o fio. */
export const SOBREPOSICAO_DA_PAGINA_PX = 56;

/**
 * Proxima posicao de rolagem de uma lista, passando uma pagina por vez; no fim, volta ao inicio.
 * Devolve null quando tudo cabe e nao ha nada para rolar.
 */
export function proximaPagina(scrollTop: number, alturaVisivel: number, alturaTotal: number, sobreposicao = SOBREPOSICAO_DA_PAGINA_PX): number | null {
  const maximo = alturaTotal - alturaVisivel;
  if (maximo <= 2) return null;
  if (scrollTop >= maximo - 2) return 0;
  const passo = Math.max(alturaVisivel - sobreposicao, alturaVisivel / 2);
  return Math.min(maximo, scrollTop + passo);
}

export interface Faixa {
  top: number;
  bottom: number;
}

/** Quantas demandas nao estao INTEIRAS na area visivel: as que comecam acima dela e as que terminam abaixo dela. */
export function contarEscondidos(faixas: Faixa[], visivelTop: number, visivelBottom: number, tolerancia = 4): { acima: number; abaixo: number } {
  let acima = 0;
  let abaixo = 0;
  for (const f of faixas) {
    if (f.top < visivelTop - tolerancia) acima++;
    else if (f.bottom > visivelBottom + tolerancia) abaixo++;
  }
  return { acima, abaixo };
}
