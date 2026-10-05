import { describe, expect, it } from 'vitest';
import {
  caixaPrevisto,
  receitaPorCliente,
  resumoDoMes,
  serieMensal,
  type Transacao,
} from './financeiro';

const t = (p: Partial<Transacao>): Transacao => ({
  type: 'income',
  status: 'paid',
  amount: 100,
  due_date: '2026-09-10',
  client_id: null,
  ...p,
});

describe('métricas financeiras oficiais', () => {
  it('receita do mês = tudo que vence no mês, separando recebido e a receber', () => {
    const r = resumoDoMes(
      [
        t({ amount: 1000, status: 'paid' }),
        t({ amount: 500, status: 'pending' }),
        t({ amount: 999, status: 'cancelled' }), // cancelada não conta
        t({ amount: 300, due_date: '2026-10-01' }), // outro mês
      ],
      2026,
      8
    );
    expect(r).toMatchObject({ receita: 1500, recebido: 1000, aReceber: 500 });
  });

  it('resultado e margem: despesa pendente também entra na competência', () => {
    const r = resumoDoMes(
      [
        t({ amount: 1000 }),
        t({ type: 'expense', amount: 400, status: 'paid' }),
        t({ type: 'expense', amount: 200, status: 'pending' }),
      ],
      2026,
      8
    );
    expect(r).toMatchObject({ despesa: 600, pago: 400, aPagar: 200, resultado: 400, margemPct: 40 });
  });

  it('mês sem receita não tem margem (evita divisão por zero)', () => {
    const r = resumoDoMes([t({ type: 'expense', amount: 50 })], 2026, 8);
    expect(r.margemPct).toBeNull();
    expect(r.resultado).toBe(-50);
  });

  it('série mensal: seis meses terminando no mês pedido, mais antigo primeiro', () => {
    const serie = serieMensal([t({ due_date: '2026-04-05' }), t({ due_date: '2026-09-05' })], new Date(2026, 8, 15), 6);
    expect(serie.map(m => m.chave)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(serie[0].receita).toBe(100);
    expect(serie[5].receita).toBe(100);
  });

  it('virada de ano na série', () => {
    const serie = serieMensal([], new Date(2027, 1, 10), 4);
    expect(serie.map(m => m.chave)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('concentração usa só receita recebida e mostra o que não tem cliente', () => {
    const r = receitaPorCliente(
      [
        t({ amount: 600, client_id: 'a' }),
        t({ amount: 200, client_id: 'b' }),
        t({ amount: 200 }), // sem cliente
        t({ amount: 5000, status: 'pending', client_id: 'a' }), // promessa não conta
        t({ amount: 100, due_date: '2025-01-01', client_id: 'b' }), // fora do período
      ],
      '2026-04-01',
      '2026-10-05'
    );
    expect(r.total).toBe(1000);
    expect(r.semClientePct).toBe(20);
    expect(r.itens[0]).toEqual({ clientId: 'a', valor: 600, pct: 60 });
    expect(r.itens[1]).toEqual({ clientId: 'b', valor: 200, pct: 20 });
  });

  it('caixa previsto: pendências dos próximos 90 dias; vencidas ficam à parte', () => {
    const c = caixaPrevisto(
      [
        t({ status: 'pending', amount: 800, due_date: '2026-10-20' }),
        t({ status: 'pending', amount: 300, due_date: '2026-12-31' }), // dentro dos 90 dias
        t({ status: 'pending', amount: 999, due_date: '2027-03-01' }), // fora
        t({ type: 'expense', status: 'pending', amount: 500, due_date: '2026-10-10' }),
        t({ type: 'expense', status: 'pending', amount: 70, due_date: '2026-09-01' }), // vencida
        t({ type: 'expense', status: 'paid', amount: 400, due_date: '2026-10-10' }), // já paga
      ],
      '2026-10-05',
      90
    );
    expect(c).toEqual({ aReceber: 1100, aPagar: 500, saldo: 600, vencidasQtd: 1, vencidasValor: 70 });
  });

  it('retrato real de hoje: setembro fechou no vermelho e outubro está previsto negativo', () => {
    const base: Transacao[] = [
      t({ amount: 26655, due_date: '2026-09-10' }),
      t({ type: 'expense', amount: 41214, due_date: '2026-09-12' }),
      t({ amount: 23925, status: 'pending', due_date: '2026-10-15' }),
      t({ type: 'expense', amount: 21367, due_date: '2026-10-08' }),
      t({ type: 'expense', amount: 5085, status: 'pending', due_date: '2026-10-25' }),
    ];
    expect(resumoDoMes(base, 2026, 8).resultado).toBe(-14559);
    expect(resumoDoMes(base, 2026, 9)).toMatchObject({ receita: 23925, despesa: 26452, resultado: -2527 });
  });
});
