// Definições OFICIAIS das métricas de cards do Flowalt.
//
// Toda tela que mostra "em aberto", "atrasado" ou "encerrado" importa daqui. Antes cada tela tinha a
// sua lista de status (havia ~15 variações) e o mesmo card era atrasado no Dashboard e não era na
// Coordenação. Mudou a regra de negócio? Muda AQUI e todas as telas acompanham.
//
// Regras:
//  - ENCERRADO = status entregue, aprovado ou arquivado. "Aprovado" já tem a decisão do cliente: sai do
//    trabalho em aberto e nunca conta como atrasado (mesma regra da Coordenação desde o início).
//  - ABERTO    = qualquer card que não está encerrado.
//  - ATRASADO  = aberto, com prazo, e o prazo já passou. A comparação é por INSTANTE, não por dia:
//                um prazo de 16:00 vira atraso às 16:01.
//  - PARADO    = aberto sem nenhuma alteração há mais de PARADO_DIAS dias.

const DIA_MS = 86_400_000;

/** Status que NÃO representam trabalho em aberto. */
export const STATUS_ENCERRADOS: readonly string[] = ['delivered', 'approved', 'archived'];

/** Dias sem alteração para um card aberto ser considerado parado. */
export const PARADO_DIAS = 14;

/** Lista pronta para filtros do PostgREST: `.not('status', 'in', STATUS_ENCERRADOS_SQL)`. */
export const STATUS_ENCERRADOS_SQL = `(${STATUS_ENCERRADOS.join(',')})`;

/** Mesma lista com aspas, para as telas que montam o filtro assim: `("delivered","approved","archived")`. */
export const STATUS_ENCERRADOS_SQL_ASPAS = `(${STATUS_ENCERRADOS.map(s => `"${s}"`).join(',')})`;

export interface CardMinimo {
  status: string;
  due_date?: string | null;
  updated_at?: string | null;
}

export const ehEncerrado = (c: Pick<CardMinimo, 'status'>): boolean => STATUS_ENCERRADOS.includes(c.status);

export const ehAberto = (c: Pick<CardMinimo, 'status'>): boolean => !ehEncerrado(c);

export const ehAtrasado = (c: CardMinimo, agora: Date = new Date()): boolean =>
  ehAberto(c) && !!c.due_date && new Date(c.due_date).getTime() < agora.getTime();

/** Dias inteiros de atraso (0 quando não está atrasado). */
export const diasDeAtraso = (c: CardMinimo, agora: Date = new Date()): number =>
  ehAtrasado(c, agora) ? Math.floor((agora.getTime() - new Date(c.due_date as string).getTime()) / DIA_MS) : 0;

export const ehParado = (c: CardMinimo, agora: Date = new Date()): boolean =>
  ehAberto(c) && !!c.updated_at && (agora.getTime() - new Date(c.updated_at).getTime()) / DIA_MS > PARADO_DIAS;

/** Quantos cards da lista estão em aberto / atrasados: o par de números que todo painel mostra. */
export function contarAbertosEAtrasados(cards: CardMinimo[], agora: Date = new Date()) {
  const abertos = cards.filter(ehAberto);
  return { abertos: abertos.length, atrasados: abertos.filter(c => ehAtrasado(c, agora)).length };
}
