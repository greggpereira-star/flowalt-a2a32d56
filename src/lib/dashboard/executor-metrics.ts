// Cálculos do Dashboard do executor ("Meu desempenho"). Funções puras: recebem os cards já carregados.
//
// Escopo: só os cards em que a pessoa é responsável (card_members). O time entra apenas como régua de
// comparação (mediana e % no prazo do time na mesma janela). As definições de aberto/atrasado/parado vêm
// de lib/metrics/definicoes, as mesmas de todas as telas.

import {
  janelaDoPeriodo,
  resumoDaJanela,
  serieSemanal,
  type CardRow,
  type OpcaoPeriodo,
  type Resumo,
  type SemanaPonto,
} from '@/lib/analytics/metrics';
import { diasDeAtraso, ehAberto, ehAtrasado, ehParado } from '@/lib/metrics/definicoes';

const DIA_MS = 86_400_000;

/** Etapas que aparecem em "Onde está meu trabalho", na ordem do fluxo. */
export const ETAPAS_DO_TRABALHO = ['backlog', 'briefing', 'todo', 'in_progress', 'review'] as const;

export interface PrazoProximo {
  id: string;
  title: string;
  due: string;
  status: string;
  /** Positivo = dias de atraso; negativo = dias que faltam. */
  diasAtraso: number;
  atrasado: boolean;
}

export interface Postagem {
  id: string;
  title: string;
  data: string; // yyyy-mm-dd
}

export interface ResultadoExecutor {
  rotuloPeriodo: string;
  meu: Resumo;
  meuAnterior: Resumo;
  time: Resumo;
  abertos: number;
  atrasados: number;
  vencem7d: number;
  parados: number;
  semPrazo: number;
  proximosPrazos: PrazoProximo[];
  porEtapa: { status: string; n: number }[];
  semanal: SemanaPonto[];
  porCliente: { clientId: string | null; n: number }[];
  /** null quando a pessoa não tem cards em espaço de Social Media. */
  postagens: { proximas: Postagem[]; semData: number } | null;
}

export interface EntradaExecutor {
  todos: CardRow[];
  meuId: string;
  agora: Date;
  periodo?: OpcaoPeriodo;
  /** card_id → data de postagem (yyyy-mm-dd), vinda dos campos personalizados. */
  datasDePostagem?: Map<string, string>;
  /** Ids dos espaços do tipo Social Media. */
  espacosSocial?: Set<string>;
}

const diaLocal = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export function calcularExecutor({
  todos,
  meuId,
  agora,
  periodo = '30d',
  datasDePostagem = new Map(),
  espacosSocial = new Set(),
}: EntradaExecutor): ResultadoExecutor {
  const { atual, anterior, rotulo } = janelaDoPeriodo(periodo, agora);
  const meus = todos.filter(c => c.members.includes(meuId));
  const abertos = meus.filter(ehAberto);
  const atrasados = abertos.filter(c => ehAtrasado(c, agora));

  const vencem7d = abertos.filter(c => {
    if (!c.due_date) return false;
    const t = new Date(c.due_date).getTime();
    return t >= agora.getTime() && t <= agora.getTime() + 7 * DIA_MS;
  });

  // Atrasados primeiro (do mais antigo), depois os que vencem logo.
  const proximosPrazos: PrazoProximo[] = abertos
    .filter(c => !!c.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 6)
    .map(c => {
      const atrasado = ehAtrasado(c, agora);
      const dias = atrasado
        ? diasDeAtraso(c, agora)
        : -Math.ceil((new Date(c.due_date!).getTime() - agora.getTime()) / DIA_MS);
      return { id: c.id, title: c.title, due: c.due_date!, status: c.status, diasAtraso: dias, atrasado };
    });

  const porEtapa = ETAPAS_DO_TRABALHO.map(status => ({ status, n: abertos.filter(c => c.status === status).length }));

  // Por cliente: cards abertos + os concluídos no período (é onde a pessoa colocou esforço agora).
  const doPeriodo = meus.filter(
    c => ehAberto(c) || (!!c.completed_at && new Date(c.completed_at) >= atual.start && new Date(c.completed_at) <= atual.end)
  );
  const contagem = new Map<string | null, number>();
  doPeriodo.forEach(c => contagem.set(c.client_id ?? null, (contagem.get(c.client_id ?? null) ?? 0) + 1));
  const porCliente = [...contagem.entries()]
    .map(([clientId, n]) => ({ clientId, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);

  // Postagens: só para quem trabalha em espaço de Social Media.
  const sociais = abertos.filter(c => c.space_id && espacosSocial.has(c.space_id));
  let postagens: ResultadoExecutor['postagens'] = null;
  if (sociais.length > 0) {
    const hoje = diaLocal(agora);
    const limite = diaLocal(new Date(agora.getTime() + 7 * DIA_MS));
    const proximas = sociais
      .filter(c => {
        const d = datasDePostagem.get(c.id);
        return !!d && d >= hoje && d <= limite;
      })
      .map(c => ({ id: c.id, title: c.title, data: datasDePostagem.get(c.id)! }))
      .sort((a, b) => a.data.localeCompare(b.data));
    postagens = { proximas, semData: sociais.filter(c => !datasDePostagem.get(c.id)).length };
  }

  return {
    rotuloPeriodo: rotulo,
    meu: resumoDaJanela(meus, atual),
    meuAnterior: resumoDaJanela(meus, anterior),
    time: resumoDaJanela(todos, atual),
    abertos: abertos.length,
    atrasados: atrasados.length,
    vencem7d: vencem7d.length,
    parados: abertos.filter(c => ehParado(c, agora)).length,
    semPrazo: abertos.filter(c => !c.due_date).length,
    proximosPrazos,
    porEtapa,
    semanal: serieSemanal(meus, agora, 8),
    porCliente,
    postagens,
  };
}
