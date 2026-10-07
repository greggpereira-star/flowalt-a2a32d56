// Relatório mensal do cliente (Onda 6). Funções puras: montam a FOTO dos números do mês a partir de cards e
// aprovações reais e um texto-base por regra (sem IA, sem adjetivos: só o que foi medido). O gestor revisa e edita.
import { mediana } from '@/lib/inteligencia/risco';

const DIA_MS = 86_400_000;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export interface CardRelatorio {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
}

export interface AprovacaoRelatorio {
  status: string;
  created_at: string;
  decided_at: string | null;
}

export interface SnapshotRelatorio {
  periodo: string; // AAAA-MM
  entregas: { total: number; mesAnterior: number; itens: { titulo: string; concluidoEm: string; noPrazo: boolean | null }[] };
  prazos: { comPrazo: number; noPrazo: number; percentual: number | null };
  aprovacoes: { enviadas: number; aprovadas: number; ajustes: number; pendentes: number; medianaRespostaDias: number | null };
  andamento: { abertos: number; atrasados: number; proximos: { titulo: string; prazo: string }[] };
}

/** Primeiro dia do mês (AAAA-MM-01) a partir de AAAA-MM ou de uma data. */
export function primeiroDia(periodo: string | Date): string {
  if (typeof periodo === 'string') return `${periodo.slice(0, 7)}-01`;
  return `${periodo.getUTCFullYear()}-${String(periodo.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function rotuloPeriodo(periodo: string): string {
  const [a, m] = periodo.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

const limites = (periodo: string) => {
  const [a, m] = periodo.split('-').map(Number);
  return { ini: Date.UTC(a, m - 1, 1), fim: Date.UTC(a, m, 1), iniAnterior: Date.UTC(a, m - 2, 1) };
};
const dentro = (iso: string | null, ini: number, fim: number) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= ini && t < fim;
};

export function montarSnapshot(
  periodo: string,
  cards: CardRelatorio[],
  aprovacoes: AprovacaoRelatorio[],
  encerrados: readonly string[],
  agora: Date
): SnapshotRelatorio {
  const { ini, fim, iniAnterior } = limites(periodo);

  const entregues = cards.filter(c => dentro(c.completed_at, ini, fim)).sort((a, b) => a.completed_at!.localeCompare(b.completed_at!));
  const itens = entregues.map(c => ({
    titulo: c.title,
    concluidoEm: c.completed_at!.slice(0, 10),
    // Compara só o dia (UTC), porque due_date é uma data e não um instante.
    noPrazo: c.due_date ? c.completed_at!.slice(0, 10) <= c.due_date.slice(0, 10) : null,
  }));
  const comPrazo = itens.filter(i => i.noPrazo !== null);
  const noPrazo = comPrazo.filter(i => i.noPrazo).length;

  const enviadas = aprovacoes.filter(a => dentro(a.created_at, ini, fim));
  const decididasNoMes = aprovacoes.filter(a => dentro(a.decided_at, ini, fim));
  const respostas = enviadas
    .filter(a => a.decided_at && (a.status === 'approved' || a.status === 'changes_requested'))
    .map(a => (new Date(a.decided_at!).getTime() - new Date(a.created_at).getTime()) / DIA_MS);
  const med = mediana(respostas);

  const abertos = cards.filter(c => !encerrados.includes(c.status));
  const proximos = abertos
    .filter(c => c.due_date && new Date(c.due_date).getTime() >= agora.getTime() && new Date(c.due_date).getTime() < agora.getTime() + 30 * DIA_MS)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
    .slice(0, 5)
    .map(c => ({ titulo: c.title, prazo: c.due_date!.slice(0, 10) }));

  return {
    periodo,
    entregas: { total: itens.length, mesAnterior: cards.filter(c => dentro(c.completed_at, iniAnterior, ini)).length, itens },
    prazos: { comPrazo: comPrazo.length, noPrazo, percentual: comPrazo.length ? Math.round((noPrazo / comPrazo.length) * 100) : null },
    aprovacoes: {
      enviadas: enviadas.length,
      aprovadas: decididasNoMes.filter(a => a.status === 'approved').length,
      ajustes: decididasNoMes.filter(a => a.status === 'changes_requested').length,
      pendentes: aprovacoes.filter(a => a.status === 'pending').length,
      medianaRespostaDias: med == null ? null : Math.round(med * 10) / 10,
    },
    andamento: {
      abertos: abertos.length,
      atrasados: abertos.filter(c => c.due_date && new Date(c.due_date).getTime() < agora.getTime()).length,
      proximos,
    },
  };
}

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
const dataBR = (iso: string) => iso.split('-').reverse().join('/');

/** Texto-base do relatório. Seção sem dado é omitida em vez de preenchida com número inventado. */
export function gerarResumo(s: SnapshotRelatorio, cliente: string): string {
  const blocos: string[] = [`Relatório de ${rotuloPeriodo(s.periodo)} — ${cliente}`];

  if (s.entregas.total > 0) {
    const cmp = s.entregas.mesAnterior > 0 ? ` (mês anterior: ${s.entregas.mesAnterior})` : '';
    const lista = s.entregas.itens.slice(0, 8).map(i => `- ${i.titulo} (${dataBR(i.concluidoEm)})`).join('\n');
    const resto = s.entregas.total > 8 ? `\n- e mais ${s.entregas.total - 8}` : '';
    blocos.push(`Entregas: ${plural(s.entregas.total, 'peça entregue', 'peças entregues')} no mês${cmp}.\n${lista}${resto}`);
  } else {
    blocos.push('Entregas: nenhuma peça foi concluída neste mês.');
  }

  if (s.prazos.percentual != null) {
    blocos.push(`Prazos: ${s.prazos.noPrazo} de ${s.prazos.comPrazo} entregas com prazo definido saíram dentro do prazo (${s.prazos.percentual}%).`);
  }

  const a = s.aprovacoes;
  if (a.enviadas + a.aprovadas + a.ajustes + a.pendentes > 0) {
    const partes = [
      `${plural(a.enviadas, 'pedido enviado', 'pedidos enviados')}`,
      `${plural(a.aprovadas, 'aprovado', 'aprovados')}`,
      `${plural(a.ajustes, 'com ajuste solicitado', 'com ajustes solicitados')}`,
    ];
    const resp = a.medianaRespostaDias != null ? ` Tempo típico de resposta: ${a.medianaRespostaDias} dias.` : '';
    const pend = a.pendentes ? ` Aguardando sua resposta hoje: ${a.pendentes}.` : '';
    blocos.push(`Aprovações: ${partes.join(', ')}.${resp}${pend}`);
  }

  const an = s.andamento;
  if (an.abertos > 0) {
    const atr = an.atrasados ? `, dos quais ${plural(an.atrasados, 'está atrasado', 'estão atrasados')}` : '';
    const prox = an.proximos.length ? `\nPróximas entregas:\n${an.proximos.map(p => `- ${p.titulo} (${dataBR(p.prazo)})`).join('\n')}` : '';
    blocos.push(`Em andamento: ${plural(an.abertos, 'peça aberta', 'peças abertas')}${atr}.${prox}`);
  }

  return blocos.join('\n\n');
}
