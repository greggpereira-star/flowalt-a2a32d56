import { describe, expect, it } from 'vitest';
import {
  STATUS_ENCERRADOS,
  STATUS_ENCERRADOS_SQL,
  contarAbertosEAtrasados,
  diasDeAtraso,
  ehAberto,
  ehAtrasado,
  ehEncerrado,
  ehParado,
} from './definicoes';

const agora = new Date('2026-10-05T16:00:00Z');

describe('definições oficiais de métricas', () => {
  it('entregue, aprovado e arquivado são encerrados', () => {
    expect(STATUS_ENCERRADOS).toEqual(['delivered', 'approved', 'archived']);
    ['delivered', 'approved', 'archived'].forEach(status => expect(ehEncerrado({ status })).toBe(true));
    ['backlog', 'briefing', 'todo', 'in_progress', 'review'].forEach(status => expect(ehAberto({ status })).toBe(true));
  });

  it('gera o filtro do PostgREST a partir da mesma lista', () => {
    expect(STATUS_ENCERRADOS_SQL).toBe('(delivered,approved,archived)');
  });

  it('atrasado = aberto + prazo vencido, comparando por instante', () => {
    const vencido = { status: 'review', due_date: '2026-10-05T15:59:00Z' };
    const noMesmoDiaAindaNoPrazo = { status: 'review', due_date: '2026-10-05T16:01:00Z' };
    expect(ehAtrasado(vencido, agora)).toBe(true);
    expect(ehAtrasado(noMesmoDiaAindaNoPrazo, agora)).toBe(false);
  });

  it('card aprovado ou entregue nunca é atrasado, mesmo com prazo vencido', () => {
    ['approved', 'delivered', 'archived'].forEach(status =>
      expect(ehAtrasado({ status, due_date: '2026-01-01T00:00:00Z' }, agora)).toBe(false)
    );
  });

  it('sem prazo não é atrasado', () => {
    expect(ehAtrasado({ status: 'todo', due_date: null }, agora)).toBe(false);
    expect(ehAtrasado({ status: 'todo' }, agora)).toBe(false);
  });

  it('dias de atraso são inteiros e zeram quando não está atrasado', () => {
    expect(diasDeAtraso({ status: 'todo', due_date: '2026-10-02T16:00:00Z' }, agora)).toBe(3);
    expect(diasDeAtraso({ status: 'todo', due_date: '2026-10-09T16:00:00Z' }, agora)).toBe(0);
    expect(diasDeAtraso({ status: 'approved', due_date: '2026-10-02T16:00:00Z' }, agora)).toBe(0);
  });

  it('parado = aberto sem alteração há mais de 14 dias', () => {
    expect(ehParado({ status: 'todo', updated_at: '2026-09-20T00:00:00Z' }, agora)).toBe(true);
    expect(ehParado({ status: 'todo', updated_at: '2026-10-01T00:00:00Z' }, agora)).toBe(false);
    expect(ehParado({ status: 'delivered', updated_at: '2026-01-01T00:00:00Z' }, agora)).toBe(false);
  });

  it('o par abertos/atrasados bate com o retrato real de hoje (12 abertos, 3 atrasados)', () => {
    const vencido = '2026-09-01T00:00:00Z';
    const cards = [
      ...Array.from({ length: 3 }, () => ({ status: 'backlog', due_date: vencido })),
      ...Array.from({ length: 4 }, () => ({ status: 'review', due_date: null })),
      ...Array.from({ length: 4 }, () => ({ status: 'briefing', due_date: null })),
      { status: 'todo', due_date: '2026-12-01T00:00:00Z' },
      // os dois "aprovados" vencidos que antes o Dashboard contava como atrasados
      ...Array.from({ length: 2 }, () => ({ status: 'approved', due_date: vencido })),
      ...Array.from({ length: 39 }, () => ({ status: 'delivered', due_date: vencido })),
    ];
    expect(contarAbertosEAtrasados(cards, agora)).toEqual({ abertos: 12, atrasados: 3 });
  });
});
