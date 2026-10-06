// Regras do feed editorial, puras e testadas: em que situacao esta um post e a que mes ele pertence.

export type SituacaoDoPost = 'planejado' | 'em_producao' | 'em_aprovacao' | 'aprovado' | 'publicado';
export type AprovacaoDoPost = 'pendente' | 'aprovado' | 'ajustes' | null;

/**
 * Situacao do post a partir do card e do ultimo pedido de aprovacao do cliente.
 * Um link de post preenchido significa publicado; depois vem aprovado, em aprovacao, em producao e planejado.
 */
export function situacaoDoPost(status: string, etapa: string | null, linkDoPost: string | null, aprov: AprovacaoDoPost): SituacaoDoPost {
  if (linkDoPost && linkDoPost.trim()) return 'publicado';
  // Ajustes pedidos pelo cliente voltam o post para producao, mesmo que o card ainda esteja marcado como aprovado.
  if (aprov === 'ajustes') return 'em_producao';
  if (aprov === 'aprovado' || status === 'delivered' || status === 'approved' || etapa === 'concluido') return 'aprovado';
  if (aprov === 'pendente' || etapa === 'aprovacao') return 'em_aprovacao';
  if (etapa === 'em_producao' || etapa === 'revisao' || status === 'in_progress' || status === 'review') return 'em_producao';
  return 'planejado';
}

/** Chave YYYY-MM de um mes (mes0 = 0 a 11), para comparar com o inicio de uma data YYYY-MM-DD sem passar por fuso. */
export const chaveMes = (ano: number, mes0: number) => `${ano}-${String(mes0 + 1).padStart(2, '0')}`;

/** Data YYYY-MM-DD valida no inicio do texto, ou null. */
export function dataDoPost(valor: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((valor ?? '').trim());
  if (!m) return null;
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return m[0];
}
