import { describe, it, expect } from 'vitest';
import { gerarResumo, montarSnapshot, primeiroDia, rotuloPeriodo, type CardRelatorio } from './relatorio-mensal';

const agora = new Date('2026-10-02T12:00:00Z');
const enc = ['delivered', 'approved', 'archived'];
const card = (id: string, over: Partial<CardRelatorio> = {}): CardRelatorio => ({ id, title: `Peça ${id}`, status: 'delivered', due_date: null, completed_at: null, ...over });

describe('período', () => {
  it('primeiroDia e rótulo', () => {
    expect(primeiroDia('2026-09')).toBe('2026-09-01');
    expect(primeiroDia(new Date('2026-09-17T10:00:00Z'))).toBe('2026-09-01');
    expect(rotuloPeriodo('2026-09')).toBe('setembro de 2026');
  });
});

describe('montarSnapshot', () => {
  const cards = [
    card('a', { completed_at: '2026-09-10T12:00:00Z', due_date: '2026-09-12' }),
    card('b', { completed_at: '2026-09-20T12:00:00Z', due_date: '2026-09-15' }),
    card('c', { completed_at: '2026-09-25T12:00:00Z' }),
    card('d', { completed_at: '2026-08-30T12:00:00Z' }),
    card('e', { status: 'in_progress', due_date: '2026-10-10' }),
    card('f', { status: 'in_progress', due_date: '2026-09-28' }),
  ];
  const s = montarSnapshot('2026-09', cards, [], enc, agora);
  it('conta entregas do mês e do anterior, em ordem', () => {
    expect(s.entregas.total).toBe(3);
    expect(s.entregas.mesAnterior).toBe(1);
    expect(s.entregas.itens.map(i => i.titulo)).toEqual(['Peça a', 'Peça b', 'Peça c']);
  });
  it('prazo só entra no percentual quando o card tem prazo', () => {
    expect(s.prazos).toEqual({ comPrazo: 2, noPrazo: 1, percentual: 50 });
    expect(s.entregas.itens[2].noPrazo).toBeNull();
  });
  it('andamento: abertos, atrasados e próximos 30 dias', () => {
    expect(s.andamento.abertos).toBe(2);
    expect(s.andamento.atrasados).toBe(1);
    expect(s.andamento.proximos).toEqual([{ titulo: 'Peça e', prazo: '2026-10-10' }]);
  });
  it('aprovações do mês, ajustes e mediana de resposta', () => {
    const ap = [
      { status: 'approved', created_at: '2026-09-02T00:00:00Z', decided_at: '2026-09-04T00:00:00Z' },
      { status: 'changes_requested', created_at: '2026-09-10T00:00:00Z', decided_at: '2026-09-16T00:00:00Z' },
      { status: 'approved', created_at: '2026-09-12T00:00:00Z', decided_at: '2026-09-18T00:00:00Z' },
      { status: 'pending', created_at: '2026-09-29T00:00:00Z', decided_at: null },
      { status: 'approved', created_at: '2026-08-01T00:00:00Z', decided_at: '2026-08-02T00:00:00Z' },
    ];
    const r = montarSnapshot('2026-09', [], ap, enc, agora).aprovacoes;
    expect(r).toEqual({ enviadas: 4, aprovadas: 2, ajustes: 1, pendentes: 1, medianaRespostaDias: 6 });
  });
});

describe('gerarResumo', () => {
  it('escreve só o que foi medido e omite seções sem dado', () => {
    const s = montarSnapshot('2026-09', [card('a', { completed_at: '2026-09-10T12:00:00Z', due_date: '2026-09-12' })], [], enc, agora);
    const t = gerarResumo(s, 'CasaBe');
    expect(t).toContain('Relatório de setembro de 2026 — CasaBe');
    expect(t).toContain('1 peça entregue no mês.');
    expect(t).toContain('- Peça a (10/09/2026)');
    expect(t).toContain('1 de 1 entregas com prazo definido saíram dentro do prazo (100%)');
    expect(t).not.toContain('Aprovações');
    expect(t).not.toContain('Em andamento');
  });
  it('mês sem entrega diz isso, sem número inventado', () => {
    const t = gerarResumo(montarSnapshot('2026-09', [], [], enc, agora), 'X');
    expect(t).toContain('nenhuma peça foi concluída neste mês');
    expect(t).not.toContain('Prazos');
  });
  it('lista corta em 8 e informa o resto', () => {
    const muitos = Array.from({ length: 10 }, (_, i) => card(String(i), { completed_at: `2026-09-${String(i + 1).padStart(2, '0')}T12:00:00Z` }));
    expect(gerarResumo(montarSnapshot('2026-09', muitos, [], enc, agora), 'X')).toContain('- e mais 2');
  });
});
