// Missoes da semana (gamificacao, Onda 2): regras puras, sem rede nem React, para poderem ser testadas.
// Quem decide o que e missao, quem recebe e quanto vale e o banco (get_missoes_semana); aqui ficam so os rotulos e as contas.

export type TipoDeMissao = 'atraso' | 'aprovacao';
export type StatusDeMissao = 'aberta' | 'cumprida' | 'expirada';

export interface Missao {
  id: string;
  card_id: string;
  space_id: string | null;
  titulo: string;
  tipo: TipoDeMissao;
  status: StatusDeMissao;
  dias: number;
  criada_em: string;
  expira_em: string;
  encerrada_em: string | null;
  pontos_cobranca: number;
  pontos_resolucao: number;
  cobrada_por: string | null;
  resolvida_por: string | null;
}

export const TIPOS_DE_MISSAO: Record<TipoDeMissao, { nome: string; verbo: string }> = {
  atraso: { nome: 'Caça-atraso', verbo: 'Entregar' },
  aprovacao: { nome: 'Destrava aprovação', verbo: 'Destravar' },
};

function pluralDias(n: number): string {
  return n === 1 ? '1 dia' : `${n} dias`;
}

/** "Vencido há 3 dias" / "Parado em aprovação há 4 dias" */
export function situacaoDaMissao(m: Pick<Missao, 'tipo' | 'dias'>): string {
  const dias = Math.max(1, m.dias);
  return m.tipo === 'atraso' ? `Vencido há ${pluralDias(dias)}` : `Parado em aprovação há ${pluralDias(dias)}`;
}

/** Quanto falta para a missao expirar, em palavras. */
export function tempoRestanteDaMissao(expiraEm: string, agora: Date = new Date()): string {
  const ms = new Date(expiraEm).getTime() - agora.getTime();
  if (ms <= 0) return 'expirou';
  const horas = ms / 3_600_000;
  if (horas < 24) return 'expira hoje';
  const dias = Math.ceil(horas / 24);
  return `expira em ${pluralDias(dias)}`;
}

/** Separa o que ainda esta em jogo do que ja foi encerrado (cumprido ou expirado) nos ultimos dias. */
export function separarMissoes(lista: Missao[]): { abertas: Missao[]; encerradas: Missao[] } {
  return {
    abertas: lista.filter(m => m.status === 'aberta'),
    encerradas: lista.filter(m => m.status !== 'aberta'),
  };
}

/** Pontos que ainda estao na mesa: cobranca (se ninguem cobrou ainda) + resolucao de cada missao aberta. */
export function pontosEmJogo(abertas: Missao[]): number {
  return abertas.reduce((t, m) => t + m.pontos_resolucao + (m.cobrada_por ? 0 : m.pontos_cobranca), 0);
}
