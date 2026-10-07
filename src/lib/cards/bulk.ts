/**
 * Regras puras da seleção múltipla de cards (duplicar e arquivar em lote).
 * Ficam fora dos componentes para serem testadas sem tela.
 */

export interface CardComAutor {
  id: string;
  created_by?: string | null;
}

/**
 * Arquivar segue a regra do menu de contexto: administrador/sócio arquiva qualquer card,
 * os demais só os que criaram.
 */
export function separarArquivaveis<T extends CardComAutor>(
  cards: T[],
  { podeArquivarTudo, userId }: { podeArquivarTudo: boolean; userId?: string | null }
): { permitidos: T[]; ignorados: T[] } {
  const permitidos: T[] = [];
  const ignorados: T[] = [];
  for (const c of cards) {
    if (podeArquivarTudo || (!!userId && c.created_by === userId)) permitidos.push(c);
    else ignorados.push(c);
  }
  return { permitidos, ignorados };
}

/** Ids entre dois pontos de uma lista ordenada (inclusive), em qualquer direção. */
export function intervaloDeIds(ordem: string[], de: string, ate: string): string[] {
  const a = ordem.indexOf(de);
  const b = ordem.indexOf(ate);
  if (a < 0 || b < 0) return b >= 0 ? [ordem[b]] : [];
  const [ini, fim] = a <= b ? [a, b] : [b, a];
  return ordem.slice(ini, fim + 1);
}

export type AcaoEmLote = 'duplicar' | 'copiar' | 'espelhar' | 'arquivar';

const VERBO: Record<AcaoEmLote, [string, string]> = {
  duplicar: ['duplicado', 'duplicados'],
  copiar: ['copiado', 'copiados'],
  espelhar: ['espelhado', 'espelhados'],
  arquivar: ['arquivado', 'arquivados'],
};

/** Frase do aviso final: "5 duplicados, 1 falhou, 2 ignorados (sem permissão)". */
export function resumoDoLote(
  acao: AcaoEmLote,
  { ok, falhas, ignorados }: { ok: number; falhas: number; ignorados: number }
): string {
  const partes: string[] = [];
  const [singular, plural] = VERBO[acao];
  if (ok > 0 || (falhas === 0 && ignorados === 0)) partes.push(`${ok} ${ok === 1 ? singular : plural}`);
  if (falhas > 0) partes.push(`${falhas} ${falhas === 1 ? 'falhou' : 'falharam'}`);
  if (ignorados > 0) partes.push(`${ignorados} ${ignorados === 1 ? 'ignorado' : 'ignorados'} (sem permissão)`);
  return partes.join(', ');
}

/** Status da cópia: entregue e arquivado não fazem sentido para um card recém-criado. */
export function statusDaCopia(status: string): string {
  return status === 'delivered' || status === 'archived' ? 'backlog' : status;
}
