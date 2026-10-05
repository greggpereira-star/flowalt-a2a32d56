import { describe, expect, it } from 'vitest';
import type { CaixaPrevisto, ReceitaPorCliente, ResumoMes } from '@/lib/metrics/financeiro';
import { gerarDecisoes, type EntradaDecisoes } from './executiva-metrics';

const mes = (resultado: number, receita = 10000): ResumoMes => ({
  chave: '2026-09',
  receita,
  recebido: receita,
  aReceber: 0,
  despesa: receita - resultado,
  pago: receita - resultado,
  aPagar: 0,
  resultado,
  margemPct: receita ? Math.round((resultado / receita) * 1000) / 10 : null,
});

const caixaOk: CaixaPrevisto = { aReceber: 5000, aPagar: 2000, saldo: 3000, vencidasQtd: 0, vencidasValor: 0 };
const carteiraSaudavel: ReceitaPorCliente = {
  total: 10000,
  semCliente: 500,
  semClientePct: 5,
  itens: [
    { clientId: 'a', valor: 3000, pct: 30 },
    { clientId: 'b', valor: 2000, pct: 20 },
  ],
};

const base = (extra: Partial<EntradaDecisoes> = {}): EntradaDecisoes => ({
  mes: mes(2000),
  serie: [mes(1000), mes(2000), mes(500), mes(800), mes(900), mes(2000)],
  caixa: caixaOk,
  carteira: carteiraSaudavel,
  clientesCriticos: [],
  aprovacoesPendentes: 0,
  cardsAtrasados: 0,
  ...extra,
});

describe('decisões e riscos do sócio', () => {
  it('sem problema nenhum, nada pede decisão', () => {
    expect(gerarDecisoes(base())).toEqual([]);
  });

  it('dois ou mais meses no vermelho é crítico e vem primeiro', () => {
    const itens = gerarDecisoes(
      base({ serie: [mes(-500), mes(1000), mes(-2300), mes(800), mes(900), mes(-14559)], cardsAtrasados: 3 })
    );
    expect(itens[0]).toMatchObject({ id: 'meses-vermelho', nivel: 'critico' });
    expect(itens[0].titulo).toBe('3 dos últimos 6 meses fecharam no vermelho');
    expect(itens[itens.length - 1].id).toBe('cards-atrasados'); // informativo fica no fim
  });

  it('um mês no vermelho isolado não é crítico, mas o resultado negativo do mês avisa', () => {
    const itens = gerarDecisoes(base({ mes: mes(-2527, 23925), serie: [mes(1000), mes(2000), mes(500), mes(800), mes(900), mes(-2527, 23925)] }));
    expect(itens.map(i => i.id)).toEqual(['resultado-negativo']);
    expect(itens[0].descricao).toContain('2.527');
  });

  it('caixa previsto negativo é crítico', () => {
    const itens = gerarDecisoes(base({ caixa: { aReceber: 1000, aPagar: 5000, saldo: -4000, vencidasQtd: 0, vencidasValor: 0 } }));
    expect(itens[0]).toMatchObject({ id: 'caixa-negativo', nivel: 'critico' });
  });

  it('pagamentos vencidos aparecem com quantidade e valor', () => {
    const itens = gerarDecisoes(base({ caixa: { ...caixaOk, vencidasQtd: 2, vencidasValor: 1500 } }));
    expect(itens[0].titulo).toBe('2 pagamentos vencidos');
    expect(itens[0].descricao).toContain('1.500');
  });

  it('concentração acima de 40% cita o cliente', () => {
    const itens = gerarDecisoes(
      base({
        carteira: { ...carteiraSaudavel, itens: [{ clientId: 'a', valor: 4630, pct: 46.3 }] },
        nomeDoMaiorCliente: 'Mela and Kera',
      })
    );
    expect(itens[0].titulo).toBe('Mela and Kera concentra 46% da receita');
  });

  it('receita sem cliente acima de 15% é sinalizada (sem isso não há margem por cliente)', () => {
    const itens = gerarDecisoes(base({ carteira: { ...carteiraSaudavel, semClientePct: 23 } }));
    expect(itens[0].id).toBe('receita-sem-cliente');
    expect(itens[0].titulo).toContain('23%');
  });

  it('clientes críticos listam até três nomes', () => {
    const itens = gerarDecisoes(base({ clientesCriticos: ['A', 'B', 'C', 'D'].map(nome => ({ nome })) }));
    expect(itens[0].titulo).toBe('4 clientes em estado crítico');
    expect(itens[0].descricao).toBe('A, B, C e outros');
  });

  it('propostas pendentes viram uma decisão do sócio', () => {
    const itens = gerarDecisoes(base({ aprovacoesPendentes: 1 }));
    expect(itens[0]).toMatchObject({ id: 'aprovacoes', nivel: 'info', rota: '/altcontrol' });
    expect(itens[0].titulo).toBe('1 proposta aguarda a sua aprovação');
  });
});
