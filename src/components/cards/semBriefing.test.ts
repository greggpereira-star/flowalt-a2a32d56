import { describe, expect, it } from 'vitest';
import { cardSemBriefing } from './SemBriefingTag';

const completo = Object.fromEntries(['context', 'target_audience', 'deliverables', 'references', 'deadline_notes', 'special_instructions'].map(c => [c, 'a'.repeat(300)]));

describe('cardSemBriefing', () => {
  it('card completo sem briefing em qualquer etapa aberta tem a marca', () => {
    for (const status of ['backlog', 'todo', 'in_progress', 'review', 'approved']) {
      expect(cardSemBriefing({ status, card_type: 'full', briefing_data: {} })).toBe(true);
    }
  });

  it('card rapido nunca tem a marca (dispensado por desenho do produto)', () => {
    expect(cardSemBriefing({ status: 'in_progress', card_type: 'quick', briefing_data: {} })).toBe(false);
  });

  it('card entregue ou arquivado nao tem a marca, mesmo sem briefing', () => {
    expect(cardSemBriefing({ status: 'delivered', card_type: 'full', briefing_data: {} })).toBe(false);
    expect(cardSemBriefing({ status: 'archived', card_type: 'full', briefing_data: {} })).toBe(false);
  });

  it('briefing preenchido tira a marca', () => {
    expect(cardSemBriefing({ status: 'todo', card_type: 'full', briefing_data: completo })).toBe(false);
  });

  it('briefing de trafego preenchido (objetivo e plataforma) tambem tira a marca', () => {
    expect(cardSemBriefing({ status: 'todo', card_type: 'full', briefing_data: {}, traffic_briefing_data: { objective: 'vendas', platform: 'meta' } })).toBe(false);
  });

  it('briefing parcial (so contexto) continua com a marca', () => {
    expect(cardSemBriefing({ status: 'todo', card_type: 'full', briefing_data: { context: 'a'.repeat(300) } })).toBe(true);
  });

  it('sem dados nenhum de briefing (null) continua com a marca', () => {
    expect(cardSemBriefing({ status: 'todo', card_type: 'full', briefing_data: null })).toBe(true);
  });
});
