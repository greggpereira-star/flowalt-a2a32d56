/**
 * Última atividade do card: "há 2 h", "agora", e o aviso de card aberto parado há muito tempo.
 * O dado vem de `cards.last_activity_at/by`, que só conta ações de pessoas (não o updated_at, que as rotinas também mexem).
 */

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

/** Forma curta para espaços apertados: "agora", "5 min", "2 h", "3 d", "2 sem", "4 mês", "1 a". */
export function tempoCurto(iso: string, agora: Date = new Date()): string {
  const dif = Math.max(0, agora.getTime() - new Date(iso).getTime());
  if (dif < MIN) return 'agora';
  if (dif < HORA) return `${Math.floor(dif / MIN)} min`;
  if (dif < DIA) return `${Math.floor(dif / HORA)} h`;
  if (dif < 7 * DIA) return `${Math.floor(dif / DIA)} d`;
  if (dif < 30 * DIA) return `${Math.floor(dif / (7 * DIA))} sem`;
  if (dif < 365 * DIA) return `${Math.floor(dif / (30 * DIA))} mês`;
  return `${Math.floor(dif / (365 * DIA))} a`;
}

/** Com prefixo, para ler como frase: "agora", "há 2 h". */
export function rotuloAtividade(iso: string, agora: Date = new Date()): string {
  const curto = tempoCurto(iso, agora);
  return curto === 'agora' ? 'agora' : `há ${curto}`;
}

/** Texto completo para dica de ferramenta: "Atualizado há 2 h por Brendon · 07/10 às 18:04". */
export function descricaoDaAtividade(iso: string, nome?: string | null, agora: Date = new Date()): string {
  const d = new Date(iso);
  const dia = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const quando = rotuloAtividade(iso, agora);
  return `Atualizado ${quando}${nome ? ` por ${nome}` : ''} · ${dia} às ${hora}`;
}

/** Card em aberto que ninguém mexe há `limiteDias` ou mais. Entregue e arquivado nunca ficam "parados". */
export function atividadeParada(
  card: { status: string; last_activity_at?: string | null },
  agora: Date = new Date(),
  limiteDias = 7
): boolean {
  if (!card.last_activity_at) return false;
  if (card.status === 'delivered' || card.status === 'archived') return false;
  return agora.getTime() - new Date(card.last_activity_at).getTime() >= limiteDias * DIA;
}

export const diasSemAtividade = (iso: string, agora: Date = new Date()) =>
  Math.floor(Math.max(0, agora.getTime() - new Date(iso).getTime()) / DIA);
