// Regras da lista "Decisões e riscos" da visão executiva do sócio. Pura e testada: recebe os números já
// calculados (financeiro, carteira, operação) e devolve o que merece a atenção de quem decide, em ordem de gravidade.

import type { CaixaPrevisto, ReceitaPorCliente, ResumoMes } from '@/lib/metrics/financeiro';

export type NivelDecisao = 'critico' | 'atencao' | 'info';

export interface ItemDecisao {
  id: string;
  nivel: NivelDecisao;
  titulo: string;
  descricao: string;
  rota: string;
}

export interface EntradaDecisoes {
  /** Mês em foco, já com receita/despesa/resultado. */
  mes: ResumoMes;
  /** Série dos últimos meses (inclui o mês em foco como último). */
  serie: ResumoMes[];
  caixa: CaixaPrevisto;
  carteira: ReceitaPorCliente;
  /** Nome do cliente de maior receita, para a mensagem de concentração. */
  nomeDoMaiorCliente?: string;
  clientesCriticos: { nome: string }[];
  aprovacoesPendentes: number;
  cardsAtrasados: number;
}

export const LIMITE_CONCENTRACAO_PCT = 40;
export const LIMITE_SEM_CLIENTE_PCT = 15;

const ORDEM: Record<NivelDecisao, number> = { critico: 0, atencao: 1, info: 2 };

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function gerarDecisoes(e: EntradaDecisoes): ItemDecisao[] {
  const itens: ItemDecisao[] = [];

  const noVermelho = e.serie.filter(m => m.receita + m.despesa > 0 && m.resultado < 0).length;
  if (noVermelho >= 2) {
    itens.push({
      id: 'meses-vermelho',
      nivel: 'critico',
      titulo: `${noVermelho} dos últimos ${e.serie.length} meses fecharam no vermelho`,
      descricao: 'As despesas passaram a receita mais de uma vez no semestre. Vale rever custos e preço antes do próximo ciclo.',
      rota: '/financial',
    });
  }

  if (e.mes.receita > 0 && e.mes.resultado < 0) {
    itens.push({
      id: 'resultado-negativo',
      nivel: 'atencao',
      titulo: 'Resultado do mês negativo',
      descricao: `As despesas superam a receita em ${brl(Math.abs(e.mes.resultado))} neste mês.`,
      rota: '/financial',
    });
  }

  if (e.caixa.saldo < 0) {
    itens.push({
      id: 'caixa-negativo',
      nivel: 'critico',
      titulo: 'Caixa previsto negativo nos próximos 90 dias',
      descricao: `Há ${brl(e.caixa.aPagar)} a pagar contra ${brl(e.caixa.aReceber)} a receber.`,
      rota: '/financial',
    });
  }

  if (e.caixa.vencidasQtd > 0) {
    itens.push({
      id: 'vencidas',
      nivel: 'atencao',
      titulo: `${e.caixa.vencidasQtd} ${e.caixa.vencidasQtd === 1 ? 'pagamento vencido' : 'pagamentos vencidos'}`,
      descricao: `${brl(e.caixa.vencidasValor)} em aberto depois do vencimento.`,
      rota: '/financial',
    });
  }

  const maior = e.carteira.itens[0];
  if (maior && maior.pct >= LIMITE_CONCENTRACAO_PCT) {
    itens.push({
      id: 'concentracao',
      nivel: 'atencao',
      titulo: `${e.nomeDoMaiorCliente ?? 'Um cliente'} concentra ${Math.round(maior.pct)}% da receita`,
      descricao: 'Perder esse cliente abre um buraco grande no caixa. Considere diversificar a carteira.',
      rota: '/clients',
    });
  }

  if (e.carteira.total > 0 && e.carteira.semClientePct >= LIMITE_SEM_CLIENTE_PCT) {
    itens.push({
      id: 'receita-sem-cliente',
      nivel: 'atencao',
      titulo: `${Math.round(e.carteira.semClientePct)}% da receita recebida não está ligada a um cliente`,
      descricao: 'Sem esse vínculo não dá para medir margem nem concentração por cliente. Ligue os lançamentos no Financeiro.',
      rota: '/financial',
    });
  }

  if (e.clientesCriticos.length > 0) {
    const nomes = e.clientesCriticos.slice(0, 3).map(c => c.nome).join(', ');
    itens.push({
      id: 'clientes-criticos',
      nivel: 'atencao',
      titulo: `${e.clientesCriticos.length} ${e.clientesCriticos.length === 1 ? 'cliente em estado crítico' : 'clientes em estado crítico'}`,
      descricao: nomes + (e.clientesCriticos.length > 3 ? ' e outros' : ''),
      rota: '/clients',
    });
  }

  if (e.aprovacoesPendentes > 0) {
    itens.push({
      id: 'aprovacoes',
      nivel: 'info',
      titulo: `${e.aprovacoesPendentes} ${e.aprovacoesPendentes === 1 ? 'proposta aguarda' : 'propostas aguardam'} a sua aprovação`,
      descricao: 'Propostas comerciais do AltControl dependem de uma decisão sua.',
      rota: '/altcontrol',
    });
  }

  if (e.cardsAtrasados > 0) {
    itens.push({
      id: 'cards-atrasados',
      nivel: 'info',
      titulo: `${e.cardsAtrasados} ${e.cardsAtrasados === 1 ? 'card atrasado' : 'cards atrasados'}`,
      descricao: 'O detalhe e quem está com cada um ficam na Coordenação.',
      rota: '/coordination',
    });
  }

  return itens.sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel]);
}
