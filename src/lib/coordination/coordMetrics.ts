// Cálculos da página de Coordenação. Funções puras: recebem cards, responsáveis e etapas já carregados.
// Regras:
//  - "aberto" = card que não está em entregue, aprovado nem arquivado;
//  - responsável = vínculos de card_members (cards.owner_id é legado);
//  - SLA e limite de WIP vêm da configuração de cada etapa do fluxo (workflow_stages);
//  - "parado" = aberto sem nenhuma alteração há mais de 14 dias.

const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;

// A regra de "aberto/encerrado" mora em lib/metrics/definicoes (fonte única); aqui só é reexportada.
import { STATUS_ENCERRADOS, ehAberto } from '@/lib/metrics/definicoes';
export { STATUS_ENCERRADOS, ehAberto };

export interface CoordCard {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  updated_at: string;
  created_at: string;
  current_stage: string | null;
  stage_entered_at: string | null;
  space?: { id: string; name: string; color: string | null } | null;
}

export interface EtapaConfig {
  slug: string;
  name: string;
  sort_order: number;
  is_final: boolean;
  wip_limit: number | null;
  wip_limit_per_person: number | null;
  sla_warning_hours: number | null;
  sla_critical_hours: number | null;
}

export interface Vinculo {
  card_id: string;
  user_id: string;
}

export type Problema =
  | { tipo: 'atrasado'; dias: number }
  | { tipo: 'sla-critico'; etapa: string; dias: number; limiteHoras: number }
  | { tipo: 'sla-aviso'; etapa: string; dias: number; limiteHoras: number }
  | { tipo: 'parado'; dias: number }
  | { tipo: 'sem-responsavel' }
  | { tipo: 'responsavel-inativo' }
  | { tipo: 'sem-prazo' };

export interface CardEmAtencao {
  card: CoordCard;
  responsaveis: string[]; // user_ids
  problemas: Problema[];
  pontos: number;
}

const diasEntre = (a: string | Date, b: Date) => (b.getTime() - new Date(a).getTime()) / DIA_MS;

export function avaliarCards(
  cards: CoordCard[],
  vinculos: Vinculo[],
  etapas: EtapaConfig[],
  agora: Date,
  ativos?: Set<string>
): CardEmAtencao[] {
  const porSlug = new Map(etapas.map(e => [e.slug, e]));
  const donos = new Map<string, string[]>();
  vinculos.forEach(v => donos.set(v.card_id, [...(donos.get(v.card_id) ?? []), v.user_id]));

  return cards.filter(ehAberto).map(card => {
    const problemas: Problema[] = [];
    let pontos = 0;
    const responsaveis = donos.get(card.id) ?? [];

    if (card.due_date && new Date(card.due_date) < agora) {
      const dias = Math.floor(diasEntre(card.due_date, agora));
      problemas.push({ tipo: 'atrasado', dias });
      pontos += Math.min(5, 1 + Math.floor(dias / 7));
    }

    const etapa = card.current_stage ? porSlug.get(card.current_stage) : undefined;
    if (etapa && card.stage_entered_at) {
      const horas = (agora.getTime() - new Date(card.stage_entered_at).getTime()) / HORA_MS;
      const dias = Math.floor(horas / 24);
      if (etapa.sla_critical_hours && horas >= etapa.sla_critical_hours) {
        problemas.push({ tipo: 'sla-critico', etapa: etapa.name, dias, limiteHoras: etapa.sla_critical_hours });
        pontos += 3;
      } else if (etapa.sla_warning_hours && horas >= etapa.sla_warning_hours) {
        problemas.push({ tipo: 'sla-aviso', etapa: etapa.name, dias, limiteHoras: etapa.sla_warning_hours });
        pontos += 1;
      }
    }

    const diasParado = Math.floor(diasEntre(card.updated_at, agora));
    if (diasParado > 14) {
      problemas.push({ tipo: 'parado', dias: diasParado });
      pontos += diasParado > 30 ? 2 : 1;
    }
    if (responsaveis.length === 0) {
      problemas.push({ tipo: 'sem-responsavel' });
      pontos += 2;
    } else if (ativos && !responsaveis.some(id => ativos.has(id))) {
      // Todos os responsáveis do card já saíram da equipe: na prática o card está sem dono.
      problemas.push({ tipo: 'responsavel-inativo' });
      pontos += 2;
    }
    if (!card.due_date) {
      problemas.push({ tipo: 'sem-prazo' });
      pontos += 1;
    }
    return { card, responsaveis, problemas, pontos };
  });
}

export interface Resumo {
  abertos: number;
  atrasados: number;
  vencem7d: number;
  foraDoSla: number;
  semResponsavel: number;
  semPrazo: number;
  parados: number;
}

export function resumir(avaliados: CardEmAtencao[], agora: Date): Resumo {
  const tem = (a: CardEmAtencao, t: Problema['tipo']) => a.problemas.some(p => p.tipo === t);
  return {
    abertos: avaliados.length,
    atrasados: avaliados.filter(a => tem(a, 'atrasado')).length,
    vencem7d: avaliados.filter(a => {
      if (!a.card.due_date) return false;
      const d = new Date(a.card.due_date).getTime();
      return d >= agora.getTime() && d <= agora.getTime() + 7 * DIA_MS;
    }).length,
    foraDoSla: avaliados.filter(a => tem(a, 'sla-critico') || tem(a, 'sla-aviso')).length,
    semResponsavel: avaliados.filter(a => tem(a, 'sem-responsavel') || tem(a, 'responsavel-inativo')).length,
    semPrazo: avaliados.filter(a => tem(a, 'sem-prazo')).length,
    parados: avaliados.filter(a => tem(a, 'parado')).length,
  };
}

export interface ResumoEtapa {
  etapa: EtapaConfig;
  cards: number;
  diasMedio: number | null;
  diasMax: number | null;
  foraDoSlaCritico: number;
  excedeWip: boolean;
}

export function resumirEtapas(avaliados: CardEmAtencao[], etapas: EtapaConfig[], agora: Date): ResumoEtapa[] {
  return [...etapas]
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter(e => !e.is_final)
    .map(etapa => {
      const naEtapa = avaliados.filter(a => a.card.current_stage === etapa.slug);
      const dias = naEtapa
        .filter(a => a.card.stage_entered_at)
        .map(a => diasEntre(a.card.stage_entered_at!, agora));
      return {
        etapa,
        cards: naEtapa.length,
        diasMedio: dias.length ? Math.round((dias.reduce((s, d) => s + d, 0) / dias.length) * 10) / 10 : null,
        diasMax: dias.length ? Math.round(Math.max(...dias) * 10) / 10 : null,
        foraDoSlaCritico: naEtapa.filter(a => a.problemas.some(p => p.tipo === 'sla-critico')).length,
        excedeWip: !!etapa.wip_limit && naEtapa.length > etapa.wip_limit,
      };
    });
}

export interface CargaPessoa {
  userId: string;
  abertos: number;
  atrasados: number;
  vencem14d: number;
  semPrazo: number;
  porSemana: number[]; // prazos nas próximas 4 semanas
}

export function cargaPorPessoa(avaliados: CardEmAtencao[], agora: Date): CargaPessoa[] {
  const mapa = new Map<string, CargaPessoa>();
  avaliados.forEach(a => {
    a.responsaveis.forEach(uid => {
      const p = mapa.get(uid) ?? { userId: uid, abertos: 0, atrasados: 0, vencem14d: 0, semPrazo: 0, porSemana: [0, 0, 0, 0] };
      p.abertos++;
      if (a.problemas.some(x => x.tipo === 'atrasado')) p.atrasados++;
      if (!a.card.due_date) p.semPrazo++;
      else {
        const d = new Date(a.card.due_date).getTime();
        const delta = d - agora.getTime();
        if (delta >= 0 && delta <= 14 * DIA_MS) p.vencem14d++;
        if (delta >= 0) {
          const sem = Math.floor(delta / (7 * DIA_MS));
          if (sem < 4) p.porSemana[sem]++;
        }
      }
      mapa.set(uid, p);
    });
  });
  return [...mapa.values()].sort((a, b) => b.abertos - a.abertos);
}

export function proximosPrazos(avaliados: CardEmAtencao[], agora: Date, dias = 30) {
  return avaliados
    .filter(a => {
      if (!a.card.due_date) return false;
      const d = new Date(a.card.due_date).getTime();
      return d >= agora.getTime() && d <= agora.getTime() + dias * DIA_MS;
    })
    .sort((a, b) => new Date(a.card.due_date!).getTime() - new Date(b.card.due_date!).getTime());
}
