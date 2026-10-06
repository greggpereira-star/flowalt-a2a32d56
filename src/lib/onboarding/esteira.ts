// Regras do onboarding em esteira, puras e testadas: em que etapa o cliente esta, em que dia, o que esta atrasado.
// Datas sao YYYY-MM-DD (campo date do banco); nada aqui passa por fuso, exceto hojeSP().

export interface EtapaOnb {
  key: string;
  name: string;
  sort_order: number;
  playbook?: string | null;
}

export interface TarefaOnb {
  id: string;
  stage_key: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  assignee_id: string | null;
  sort_order: number;
}

/** Hoje em Sao Paulo, como YYYY-MM-DD. */
export const hojeSP = (agora: Date = new Date()) => agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

const emDias = (data: string) => {
  const [a, m, d] = data.split('-').map(Number);
  return Date.UTC(a, m - 1, d) / 86_400_000;
};

/** Dias de a ate b (b - a). Negativo se b e anterior. */
export const diasEntre = (a: string, b: string) => Math.round(emDias(b) - emDias(a));

/** Dia do onboarding: o dia do inicio e o dia 1. */
export const diaDoOnboarding = (inicio: string, hoje: string) => diasEntre(inicio, hoje) + 1;

export const somaDias = (data: string, dias: number) => {
  const ms = emDias(data) * 86_400_000 + dias * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
};

export const tarefaAtrasada = (t: Pick<TarefaOnb, 'due_date' | 'completed_at'>, hoje: string) =>
  !t.completed_at && !!t.due_date && t.due_date < hoje;

export function progresso(tarefas: Pick<TarefaOnb, 'completed_at'>[]) {
  const total = tarefas.length;
  const feitas = tarefas.filter(t => !!t.completed_at).length;
  return { feitas, total, pct: total ? Math.round((feitas / total) * 100) : 0 };
}

const ordenadas = (etapas: EtapaOnb[]) => [...etapas].sort((a, b) => a.sort_order - b.sort_order);

/** Etapa atual: a primeira (na ordem do modelo) que ainda tem tarefa pendente. Nulo quando tudo esta feito ou nao ha tarefas. */
export function etapaAtual(etapas: EtapaOnb[], tarefas: Pick<TarefaOnb, 'stage_key' | 'completed_at'>[]): string | null {
  for (const e of ordenadas(etapas)) {
    if (tarefas.some(t => t.stage_key === e.key && !t.completed_at)) return e.key;
  }
  return null;
}

export interface ResumoDeEtapa {
  key: string;
  name: string;
  feitas: number;
  total: number;
  atrasadas: number;
  concluida: boolean;
}

export function resumoPorEtapa(etapas: EtapaOnb[], tarefas: TarefaOnb[], hoje: string): ResumoDeEtapa[] {
  return ordenadas(etapas).map(e => {
    const dela = tarefas.filter(t => t.stage_key === e.key);
    const feitas = dela.filter(t => !!t.completed_at).length;
    return {
      key: e.key,
      name: e.name,
      feitas,
      total: dela.length,
      atrasadas: dela.filter(t => tarefaAtrasada(t, hoje)).length,
      concluida: dela.length > 0 && feitas === dela.length,
    };
  });
}

/** Proxima tarefa a fazer: a pendente de menor prazo; as sem prazo ficam por ultimo. */
export function proximaTarefa<T extends TarefaOnb>(tarefas: T[]): T | null {
  const pendentes = tarefas.filter(t => !t.completed_at);
  if (pendentes.length === 0) return null;
  return [...pendentes].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : a.sort_order - b.sort_order;
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return a.sort_order - b.sort_order;
  })[0];
}

export type SituacaoOnboarding = 'concluido' | 'atrasado' | 'no_prazo';

export function situacaoDoOnboarding(tarefas: TarefaOnb[], hoje: string): SituacaoOnboarding {
  if (tarefas.length > 0 && tarefas.every(t => !!t.completed_at)) return 'concluido';
  return tarefas.some(t => tarefaAtrasada(t, hoje)) ? 'atrasado' : 'no_prazo';
}

/** Marcos de 15 e 30 dias a partir do inicio (o dia do inicio e o dia 1, entao o dia 15 e inicio + 14). */
export function marcos(inicio: string, hoje: string) {
  const dia15 = somaDias(inicio, 14);
  const dia30 = somaDias(inicio, 29);
  return {
    dia15: { data: dia15, passou: hoje > dia15, faltam: Math.max(0, diasEntre(hoje, dia15)) },
    dia30: { data: dia30, passou: hoje > dia30, faltam: Math.max(0, diasEntre(hoje, dia30)) },
  };
}
