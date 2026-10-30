// Temporada (gamificacao, Onda 2): regras puras, sem rede nem React, para poderem ser testadas.
// Os pontos em si sao calculados no banco (get_temporada); aqui ficam so a legenda e as contas de calendario.

/** Pontos da temporada. Espelha _pontos_temporada no banco: se mudar la, mude aqui (so a legenda da tela). */
export const PONTOS_DA_TEMPORADA = {
  entrega: 20,
  entregaAtrasada: 14, // 20 x 70% (a regra de atraso do ranking)
  comentario: 3,
  movimentacao: 2,
  movimentacaoMaxPorDia: 8,
  diaComAcao: 5,
  hora: 5,
} as const;

export interface LinhaDaTemporada {
  mes: string;
  oficial: boolean;
  encerrada: boolean;
  premio: string | null;
  user_id: string;
  nome: string | null;
  avatar_url: string | null;
  posicao: number;
  pontos: number;
  entregas: number;
  comentarios: number;
  movimentacoes: number;
  dias_acao: number;
}

export interface PodioDeTemporada {
  mes: string;
  premio: string | null;
  user_id: string;
  nome: string | null;
  avatar_url: string | null;
  posicao: number;
  pontos: number;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function partesSP(agora: Date): { a: number; m: number; d: number } {
  const [a, m, d] = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).split('-').map(Number);
  return { a, m, d };
}

/** Primeiro dia do mes de `agora` no fuso de Sao Paulo, como 'YYYY-MM-01' (a mesma conta do banco). */
export function mesDaTemporadaSP(agora: Date = new Date()): string {
  const { a, m } = partesSP(agora);
  return `${a}-${String(m).padStart(2, '0')}-01`;
}

export function proximoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
}

/** '2026-11-01' -> 'novembro de 2026' */
export function rotuloDoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

/** Dias que ainda faltam depois de hoje; 0 no ultimo dia do mes. */
export function diasRestantesNaTemporada(agora: Date = new Date()): number {
  const { a, m, d } = partesSP(agora);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return ultimo - d;
}

export function rotuloDeDiasRestantes(n: number): string {
  if (n <= 0) return 'último dia';
  return n === 1 ? 'falta 1 dia' : `faltam ${n} dias`;
}

/** Quanto falta para alcancar quem esta na frente (0 para o lider). */
export function pontosParaAlcancar(pontos: number, naFrente: number | null): number {
  return naFrente == null ? 0 : Math.max(0, naFrente - pontos + 1);
}
