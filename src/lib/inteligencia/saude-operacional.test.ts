import { describe, it, expect } from 'vitest';
import { rotuloSinal, sinaisPorCliente, type AprovacaoDoCliente, type CardDoCliente } from './saude-operacional';

const agora = new Date('2026-10-20T12:00:00Z');
const dia = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString();
const encerrados = ['delivered', 'approved', 'archived'];

const card = (id: string, status = 'in_progress', completed_at: string | null = null): CardDoCliente => ({ id, client_id: 'k', status, completed_at });
const apr = (over: Partial<AprovacaoDoCliente>): AprovacaoDoCliente => ({ client_id: 'k', card_id: 'c1', status: 'pending', created_at: dia(1), decided_at: null, ...over });
const rodar = (over: Partial<Parameters<typeof sinaisPorCliente>[0]>) =>
  sinaisPorCliente({ agora, cards: [], aprovacoes: [], rodadas: new Map(), limitePorCliente: new Map(), encerrados, ...over }).get('k') ?? [];

describe('sinaisPorCliente', () => {
  it('aprovação parada só a partir de 3 dias e conta a mais antiga', () => {
    expect(rodar({ aprovacoes: [apr({ created_at: dia(2) })] })).toEqual([]);
    const s = rodar({ aprovacoes: [apr({ created_at: dia(4) }), apr({ created_at: dia(9) })] });
    expect(s).toContainEqual({ tipo: 'aprovacao-parada', quantidade: 2, maisAntigaDias: 9 });
  });
  it('resposta lenta exige 3 respostas e mediana acima de 5 dias', () => {
    const r = (d: number) => apr({ status: 'approved', created_at: dia(d + 10), decided_at: dia(10) });
    expect(rodar({ aprovacoes: [r(8), r(9)] })).toEqual([]);
    expect(rodar({ aprovacoes: [r(2), r(3), r(4)] })).toEqual([]);
    expect(rodar({ aprovacoes: [r(6), r(8), r(9)] })).toContainEqual({ tipo: 'resposta-lenta', medianaDias: 8, amostras: 3 });
  });
  it('rodadas acima só em card aberto e só com limite definido', () => {
    const base = { cards: [card('a'), card('b', 'delivered')], rodadas: new Map([['a', 3], ['b', 5]]) };
    expect(rodar({ ...base })).toEqual([]);
    expect(rodar({ ...base, limitePorCliente: new Map([['k', 2]]) })).toEqual([{ tipo: 'rodadas-acima', cards: 1, limite: 2 }]);
  });
  it('sem entrega: com card aberto e última entrega antiga; sem entrega registrada fica calado', () => {
    expect(rodar({ cards: [card('a'), card('b', 'delivered', dia(45))] })).toContainEqual({ tipo: 'sem-entrega', dias: 45 });
    expect(rodar({ cards: [card('a'), card('b', 'delivered', dia(10))] })).toEqual([]);
    expect(rodar({ cards: [card('a')] })).toEqual([]);
    expect(rodar({ cards: [card('b', 'delivered', dia(45))] })).toEqual([]);
  });
  it('rótulos mostram os números e marcam gravidade', () => {
    expect(rotuloSinal({ tipo: 'aprovacao-parada', quantidade: 1, maisAntigaDias: 8 })).toEqual({ texto: '1 aprovação parada (8 d)', grave: true });
    expect(rotuloSinal({ tipo: 'sem-entrega', dias: 45 })).toEqual({ texto: 'sem entrega há 45 d', grave: false });
    expect(rotuloSinal({ tipo: 'rodadas-acima', cards: 2, limite: 3 }).texto).toBe('2 peças acima de 3 rodadas');
  });
});
