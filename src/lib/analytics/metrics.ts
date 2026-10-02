// Cálculos de analytics de entrega. Funções puras: recebem os cards já carregados e devolvem números.
// Regras de contagem (iguais em toda a página):
//  - "concluído" = card com completed_at e status entregue, aprovado ou arquivado;
//  - "aberto" = card que ainda não está em entregue, aprovado ou arquivado;
//  - quem responde pelo card vem de card_members (cards.owner_id é legado e quase não é usado);
//  - datas são agrupadas pelo dia no fuso de São Paulo, não em UTC.

const TZ = 'America/Sao_Paulo';
const DIA_MS = 86_400_000;

export const STATUS_ENCERRADOS = ['delivered', 'approved', 'archived'];

export interface CardRow {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  space_id: string | null;
  client_id: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  members: string[];
}

export interface Janela {
  start: Date;
  end: Date;
}

export const diaKey = (d: string | Date) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });

export const ehConcluido = (c: CardRow) => !!c.completed_at && STATUS_ENCERRADOS.includes(c.status);
export const ehAberto = (c: CardRow) => !STATUS_ENCERRADOS.includes(c.status);
const dentro = (iso: string | null, j: Janela) => !!iso && new Date(iso) >= j.start && new Date(iso) <= j.end;

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(p * v.length))];
}

const arred = (n: number | null, casas = 1) => (n == null ? null : Math.round(n * 10 ** casas) / 10 ** casas);
const diasEntre = (a: string | Date, b: string | Date) => (new Date(b).getTime() - new Date(a).getTime()) / DIA_MS;

export interface Resumo {
  criados: number;
  concluidos: number;
  leadMediana: number | null; // dias entre criar e concluir
  leadP90: number | null;
  comPrazo: number;
  noPrazo: number;
  noPrazoPct: number | null;
  atrasoMediana: number | null; // dias de atraso, só entre os que passaram do prazo
}

export function resumoDaJanela(cards: CardRow[], j: Janela): Resumo {
  const concl = cards.filter(c => ehConcluido(c) && dentro(c.completed_at, j));
  const leads = concl.map(c => diasEntre(c.created_at, c.completed_at!));
  const comPrazo = concl.filter(c => c.due_date);
  const noPrazo = comPrazo.filter(c => new Date(c.completed_at!) <= new Date(c.due_date!));
  const atrasos = comPrazo
    .filter(c => new Date(c.completed_at!) > new Date(c.due_date!))
    .map(c => diasEntre(c.due_date!, c.completed_at!));
  return {
    criados: cards.filter(c => dentro(c.created_at, j)).length,
    concluidos: concl.length,
    leadMediana: arred(mediana(leads)),
    leadP90: arred(percentil(leads, 0.9)),
    comPrazo: comPrazo.length,
    noPrazo: noPrazo.length,
    noPrazoPct: comPrazo.length ? Math.round((noPrazo.length / comPrazo.length) * 100) : null,
    atrasoMediana: arred(mediana(atrasos)),
  };
}

export interface Situacao {
  abertos: number;
  atrasados: number;
  semResponsavel: number;
  parados: number; // abertos sem alteração há mais de 14 dias
  maisAtrasados: { card: CardRow; diasAtraso: number }[];
}

export function situacaoAtual(cards: CardRow[], agora: Date): Situacao {
  const abertos = cards.filter(ehAberto);
  const atrasados = abertos
    .filter(c => c.due_date && new Date(c.due_date) < agora)
    .map(c => ({ card: c, diasAtraso: Math.floor(diasEntre(c.due_date!, agora)) }))
    .sort((a, b) => b.diasAtraso - a.diasAtraso);
  return {
    abertos: abertos.length,
    atrasados: atrasados.length,
    semResponsavel: abertos.filter(c => c.members.length === 0).length,
    parados: abertos.filter(c => diasEntre(c.updated_at, agora) > 14).length,
    maisAtrasados: atrasados.slice(0, 8),
  };
}

// ---- série semanal (segunda a domingo, fuso de São Paulo)
const segundaDe = (dia: string) => {
  const d = new Date(`${dia}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = segunda
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
};

export interface SemanaPonto {
  semana: string; // yyyy-mm-dd da segunda
  rotulo: string; // dd/MM
  criados: number;
  concluidos: number;
  leadMediana: number | null;
}

export function serieSemanal(cards: CardRow[], agora: Date, semanas = 12): SemanaPonto[] {
  const atual = segundaDe(diaKey(agora));
  const chaves: string[] = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const d = new Date(`${atual}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    chaves.push(d.toISOString().slice(0, 10));
  }
  return chaves.map(semana => {
    const concl = cards.filter(c => ehConcluido(c) && segundaDe(diaKey(c.completed_at!)) === semana);
    const leads = concl.map(c => diasEntre(c.created_at, c.completed_at!));
    const [, mes, dia] = semana.split('-');
    return {
      semana,
      rotulo: `${dia}/${mes}`,
      criados: cards.filter(c => segundaDe(diaKey(c.created_at)) === semana).length,
      concluidos: concl.length,
      leadMediana: arred(mediana(leads)),
    };
  });
}

// ---- distribuição do atraso das entregas com prazo
export const FAIXAS_ATRASO = [
  { id: 'prazo', rotulo: 'No prazo', ok: true },
  { id: 'd2', rotulo: '1–2 dias', ok: false },
  { id: 'd7', rotulo: '3–7 dias', ok: false },
  { id: 'd14', rotulo: '8–14 dias', ok: false },
  { id: 'd15', rotulo: '15+ dias', ok: false },
];

export function distribuicaoAtraso(cards: CardRow[], j: Janela) {
  const contagem: Record<string, number> = { prazo: 0, d2: 0, d7: 0, d14: 0, d15: 0 };
  cards
    .filter(c => ehConcluido(c) && dentro(c.completed_at, j) && c.due_date)
    .forEach(c => {
      const atraso = diasEntre(c.due_date!, c.completed_at!);
      const faixa = atraso <= 0 ? 'prazo' : atraso <= 2 ? 'd2' : atraso <= 7 ? 'd7' : atraso <= 14 ? 'd14' : 'd15';
      contagem[faixa]++;
    });
  return FAIXAS_ATRASO.map(f => ({ ...f, total: contagem[f.id] }));
}

// ---- recortes: por pessoa, space e cliente
export interface Recorte {
  chave: string;
  concluidos: number;
  abertos: number;
  atrasados: number;
  leadMediana: number | null;
  noPrazoPct: number | null;
  horas: number;
}

export function recortarPor(
  cards: CardRow[],
  j: Janela,
  agora: Date,
  chaves: (c: CardRow) => string[]
): Recorte[] {
  const mapa = new Map<string, CardRow[]>();
  cards.forEach(c => {
    chaves(c).forEach(k => {
      const lista = mapa.get(k) ?? [];
      lista.push(c);
      mapa.set(k, lista);
    });
  });
  return [...mapa.entries()]
    .map(([chave, lista]) => {
      const r = resumoDaJanela(lista, j);
      const abertos = lista.filter(ehAberto);
      return {
        chave,
        concluidos: r.concluidos,
        abertos: abertos.length,
        atrasados: abertos.filter(c => c.due_date && new Date(c.due_date) < agora).length,
        leadMediana: r.leadMediana,
        noPrazoPct: r.noPrazoPct,
        horas: Math.round(lista.reduce((s, c) => s + (c.actual_hours ?? 0), 0) * 10) / 10,
      };
    })
    .sort((a, b) => b.concluidos - a.concluidos || b.abertos - a.abertos);
}

// ---- qualidade do cadastro (cards não arquivados)
export interface Qualidade {
  total: number;
  semCliente: number;
  semPrazo: number;
  semResponsavel: number;
  semEstimativa: number;
  semHoras: number;
}

export function qualidadeDoCadastro(cards: CardRow[]): Qualidade {
  const vivos = cards.filter(c => c.status !== 'archived');
  return {
    total: vivos.length,
    semCliente: vivos.filter(c => !c.client_id).length,
    semPrazo: vivos.filter(c => !c.due_date).length,
    semResponsavel: vivos.filter(c => c.members.length === 0).length,
    semEstimativa: vivos.filter(c => !c.estimated_hours).length,
    semHoras: vivos.filter(c => !c.actual_hours).length,
  };
}

// ---- entregas registradas em lote
export function concentracaoDeEntregas(cards: CardRow[], j: Janela) {
  const porDia = new Map<string, number>();
  cards
    .filter(c => ehConcluido(c) && dentro(c.completed_at, j))
    .forEach(c => {
      const k = diaKey(c.completed_at!);
      porDia.set(k, (porDia.get(k) ?? 0) + 1);
    });
  const total = [...porDia.values()].reduce((a, b) => a + b, 0);
  const [dia, qtd] = [...porDia.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
  return { total, dia, qtd, pct: total ? Math.round((qtd / total) * 100) : 0 };
}

// ---- janelas
export type OpcaoPeriodo = '7d' | '30d' | '90d' | 'week' | 'month';

export function janelaDoPeriodo(op: OpcaoPeriodo, agora: Date): { atual: Janela; anterior: Janela; rotulo: string } {
  let start: Date;
  let end = agora;
  let rotulo: string;
  if (op === 'week') {
    const seg = segundaDe(diaKey(agora));
    start = new Date(`${seg}T00:00:00-03:00`);
    rotulo = 'esta semana';
  } else if (op === 'month') {
    const [a, m] = diaKey(agora).split('-');
    start = new Date(`${a}-${m}-01T00:00:00-03:00`);
    rotulo = 'este mês';
  } else {
    const dias = op === '7d' ? 7 : op === '30d' ? 30 : 90;
    start = new Date(agora.getTime() - dias * DIA_MS);
    rotulo = `últimos ${dias} dias`;
  }
  const dur = end.getTime() - start.getTime();
  return {
    atual: { start, end },
    anterior: { start: new Date(start.getTime() - dur), end: new Date(start.getTime() - 1) },
    rotulo,
  };
}
