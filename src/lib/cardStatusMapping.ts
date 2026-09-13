import type { CardStatus } from '@/lib/supabase';

// Fonte unica da correspondencia entre o estagio do workflow e o `status`
// legado do card. Os dois convivem na tabela `cards` e precisam andar juntos:
// o Kanban le `status`, o workflow escreve `current_stage`, e ate um tempo
// atras cada caminho atualizava so o seu campo.
//
// Os tipos aqui nao sao enfeite. Enquanto estas funcoes devolviam `string`,
// qualquer texto podia ser gravado na coluna `status`, que e um enum no banco:
// o erro so apareceria como falha de INSERT em producao, nunca no editor.

/** Slug de estagio -> status legado. */
const ESTAGIO_PARA_STATUS: Record<string, CardStatus> = {
  backlog: 'backlog',
  planejamento: 'todo',
  a_fazer: 'todo', // alias do slug novo
  em_producao: 'in_progress',
  revisao: 'review',
  aprovacao: 'approved',
  concluido: 'delivered',
};

/** Status legado -> slug de estagio. */
const STATUS_PARA_ESTAGIO: Record<CardStatus, string> = {
  backlog: 'backlog',
  briefing: 'planejamento',
  todo: 'planejamento',
  in_progress: 'em_producao',
  review: 'revisao',
  approved: 'aprovacao',
  delivered: 'concluido',
  archived: 'backlog',
};

/**
 * `alvo` e um status do enum?
 *
 * Necessario porque `target_status` de automacao e `toStage` de workflow chegam
 * como string solta, vinda do banco ou de tela antiga. Sem esta checagem, um
 * valor como 'a_fazer' — que e slug de estagio, nao status — seria gravado na
 * coluna `status` e o INSERT quebraria em producao.
 */
function ehCardStatus(alvo: string): alvo is CardStatus {
  return alvo in STATUS_PARA_ESTAGIO;
}

/** Status legado -> slug de estagio. Desconhecido cai em backlog. */
export const mapStatusToStage = (status: string): string =>
  ehCardStatus(status) ? STATUS_PARA_ESTAGIO[status] : 'backlog';

/** Slug de estagio -> status legado. Desconhecido cai em backlog. */
export const mapStageToStatus = (stage: string): CardStatus =>
  ESTAGIO_PARA_STATUS[stage] ?? 'backlog';

/**
 * Automacoes gravam `target_status` sem dizer de qual dominio o valor veio:
 * a tela de workflow manda slug de estagio, a de automacoes manda status
 * legado. Aceita os dois e devolve o par coerente.
 *
 * A ordem importa: slug de estagio e testado primeiro porque 'a_fazer' existe
 * nos dois mapas, e so como slug ele tem significado valido.
 */
export const normalizarDestino = (
  alvo: string,
): { stage: string; status: CardStatus } => {
  if (alvo in ESTAGIO_PARA_STATUS) {
    return { stage: alvo, status: ESTAGIO_PARA_STATUS[alvo] };
  }
  if (ehCardStatus(alvo)) {
    return { stage: STATUS_PARA_ESTAGIO[alvo], status: alvo };
  }
  return { stage: 'backlog', status: 'backlog' };
};
