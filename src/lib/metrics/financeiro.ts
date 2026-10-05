// Definições OFICIAIS das métricas financeiras da visão executiva.
//
// O Painel dos Sócios misturava duas regras de receita: o resumo do mês contava tudo (pago + pendente) e o
// gráfico de tendência só o pago. Aqui há uma regra só, e ela sempre separa "o que já aconteceu" de "o que
// está previsto":
//  - COMPETÊNCIA: uma transação pertence ao mês do seu vencimento (due_date), igual ao Financeiro;
//  - cancelada não conta em nada;
//  - receita/despesa do mês = tudo que vence no mês (pago + a receber/pagar), e o painel mostra o split;
//  - resultado = receita − despesa; margem = resultado / receita;
//  - concentração por cliente usa só a receita JÁ RECEBIDA (paid), para não premiar promessa;
//  - caixa previsto = pendências que vencem nos próximos N dias; vencidas = pendentes com vencimento antes de hoje.

export interface Transacao {
  type: 'income' | 'expense';
  status: string;
  amount: number;
  /** yyyy-mm-dd */
  due_date: string;
  client_id: string | null;
}

export const ehValida = (t: Pick<Transacao, 'status'>) => t.status !== 'cancelled';

const dois = (n: number) => String(n).padStart(2, '0');
/** Chave do mês: 2026-10. `mes` é 0-11, como em Date. */
export const chaveDoMes = (ano: number, mes: number) => `${ano}-${dois(mes + 1)}`;
const soma = (lista: Transacao[]) => lista.reduce((s, t) => s + Number(t.amount), 0);

export interface ResumoMes {
  chave: string;
  receita: number;
  recebido: number;
  aReceber: number;
  despesa: number;
  pago: number;
  aPagar: number;
  resultado: number;
  /** null quando não há receita no mês. */
  margemPct: number | null;
}

export function resumoDoMes(transacoes: Transacao[], ano: number, mes: number): ResumoMes {
  const chave = chaveDoMes(ano, mes);
  const doMes = transacoes.filter(t => ehValida(t) && t.due_date.slice(0, 7) === chave);
  const receitas = doMes.filter(t => t.type === 'income');
  const despesas = doMes.filter(t => t.type === 'expense');
  const receita = soma(receitas);
  const despesa = soma(despesas);
  const resultado = receita - despesa;
  return {
    chave,
    receita,
    recebido: soma(receitas.filter(t => t.status === 'paid')),
    aReceber: soma(receitas.filter(t => t.status !== 'paid')),
    despesa,
    pago: soma(despesas.filter(t => t.status === 'paid')),
    aPagar: soma(despesas.filter(t => t.status !== 'paid')),
    resultado,
    margemPct: receita > 0 ? Math.round((resultado / receita) * 1000) / 10 : null,
  };
}

/** Os `meses` meses terminando em `fim` (inclusive), do mais antigo para o mais novo. */
export function serieMensal(transacoes: Transacao[], fim: Date, meses = 6): ResumoMes[] {
  return Array.from({ length: meses }, (_, i) => {
    const d = new Date(fim.getFullYear(), fim.getMonth() - (meses - 1 - i), 1);
    return resumoDoMes(transacoes, d.getFullYear(), d.getMonth());
  });
}

export interface ReceitaPorCliente {
  total: number;
  semCliente: number;
  semClientePct: number;
  itens: { clientId: string; valor: number; pct: number }[];
}

/** Receita já recebida no intervalo [desde, ate] (yyyy-mm-dd), por cliente. */
export function receitaPorCliente(transacoes: Transacao[], desde: string, ate: string): ReceitaPorCliente {
  const recebidas = transacoes.filter(
    t => ehValida(t) && t.type === 'income' && t.status === 'paid' && t.due_date >= desde && t.due_date <= ate
  );
  const total = soma(recebidas);
  const porCliente = new Map<string, number>();
  let semCliente = 0;
  recebidas.forEach(t => {
    if (!t.client_id) semCliente += Number(t.amount);
    else porCliente.set(t.client_id, (porCliente.get(t.client_id) ?? 0) + Number(t.amount));
  });
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);
  return {
    total,
    semCliente,
    semClientePct: pct(semCliente),
    itens: [...porCliente.entries()]
      .map(([clientId, valor]) => ({ clientId, valor, pct: pct(valor) }))
      .sort((a, b) => b.valor - a.valor),
  };
}

export interface CaixaPrevisto {
  aReceber: number;
  aPagar: number;
  saldo: number;
  vencidasQtd: number;
  vencidasValor: number;
}

/** `hoje` em yyyy-mm-dd. */
export function caixaPrevisto(transacoes: Transacao[], hoje: string, dias = 90): CaixaPrevisto {
  const limite = new Date(`${hoje}T12:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + dias);
  const ate = limite.toISOString().slice(0, 10);
  const pendentes = transacoes.filter(t => ehValida(t) && t.status === 'pending');
  const naJanela = pendentes.filter(t => t.due_date >= hoje && t.due_date <= ate);
  const vencidas = pendentes.filter(t => t.due_date < hoje);
  const aReceber = soma(naJanela.filter(t => t.type === 'income'));
  const aPagar = soma(naJanela.filter(t => t.type === 'expense'));
  return { aReceber, aPagar, saldo: aReceber - aPagar, vencidasQtd: vencidas.length, vencidasValor: soma(vencidas) };
}
