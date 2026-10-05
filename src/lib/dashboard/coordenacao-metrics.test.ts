import { describe, expect, it } from 'vitest';
import type { CardRow } from '@/lib/analytics/metrics';
import { calcularCoordenacao, segundaDaSemana, type EtapaMin, type TransicaoEtapa } from './coordenacao-metrics';

// segunda-feira, 12h em São Paulo
const agora = new Date('2026-10-05T15:00:00Z');

const ETAPAS: EtapaMin[] = [
  { slug: 'backlog', name: 'Backlog', sort_order: 0, is_final: false },
  { slug: 'producao', name: 'Em Produção', sort_order: 1, is_final: false },
  { slug: 'revisao', name: 'Revisão', sort_order: 2, is_final: false },
  { slug: 'concluido', name: 'Concluído', sort_order: 3, is_final: true },
];

let seq = 0;
const card = (p: Partial<CardRow>): CardRow => ({
  id: `c${++seq}`,
  title: `Card ${seq}`,
  status: 'todo',
  due_date: null,
  completed_at: null,
  created_at: '2026-09-01T12:00:00Z',
  updated_at: '2026-10-04T12:00:00Z',
  space_id: 's1',
  client_id: null,
  estimated_hours: null,
  actual_hours: null,
  members: ['ana'],
  ...p,
});

const entrega = (p: Partial<CardRow> = {}) =>
  card({ status: 'delivered', created_at: '2026-09-20T12:00:00Z', completed_at: '2026-09-28T12:00:00Z', due_date: '2026-09-30T12:00:00Z', ...p });

const t = (card_id: string, from_stage: string | null, to_stage: string, created_at: string): TransicaoEtapa => ({
  card_id,
  from_stage,
  to_stage,
  created_at,
});

describe('Dashboard da coordenação', () => {
  it('saldo da fila = criados − entregues no período', () => {
    const r = calcularCoordenacao({
      todos: [card({ created_at: '2026-09-25T12:00:00Z' }), card({ created_at: '2026-09-26T12:00:00Z' }), entrega()],
      historico: [],
      etapas: ETAPAS,
      agora,
    });
    expect(r.time.criados).toBe(3);
    expect(r.time.concluidos).toBe(1);
    expect(r.saldo).toBe(2);
  });

  it('abertos e atrasados seguem a definição oficial (aprovado vencido não conta)', () => {
    const r = calcularCoordenacao({
      todos: [
        card({ status: 'review', due_date: '2026-10-01T00:00:00Z' }),
        card({ status: 'approved', due_date: '2026-10-01T00:00:00Z' }),
        card({ members: [] }),
      ],
      historico: [],
      etapas: ETAPAS,
      agora,
    });
    expect(r.abertos).toBe(2);
    expect(r.atrasados).toBe(1);
  });

  it('compara pessoas pelos cards em que são responsáveis', () => {
    const r = calcularCoordenacao({
      todos: [entrega({ members: ['ana'] }), entrega({ members: ['ana', 'rui'] }), card({ members: ['rui'] })],
      historico: [],
      etapas: ETAPAS,
      agora,
    });
    const ana = r.pessoas.find(p => p.chave === 'ana')!;
    const rui = r.pessoas.find(p => p.chave === 'rui')!;
    expect(ana.concluidos).toBe(2);
    expect(rui.concluidos).toBe(1);
    expect(rui.abertos).toBe(1);
  });

  it('filtra tudo pelo espaço escolhido', () => {
    const r = calcularCoordenacao({
      todos: [entrega({ space_id: 's1' }), entrega({ space_id: 's2' }), entrega({ space_id: 's2' })],
      historico: [],
      etapas: ETAPAS,
      agora,
      espacoId: 's2',
    });
    expect(r.time.concluidos).toBe(2);
    expect(r.espacos.map(e => e.chave)).toEqual(['s2']);
  });

  it('tempo por etapa: mediana dos dias entre entrar e sair, só de quem saiu no período', () => {
    const a = card({ id: 'a' });
    const b = card({ id: 'b' });
    const r = calcularCoordenacao({
      todos: [a, b],
      etapas: ETAPAS,
      agora,
      historico: [
        t('a', 'backlog', 'producao', '2026-09-10T12:00:00Z'),
        t('a', 'producao', 'revisao', '2026-09-14T12:00:00Z'), // 4 dias em produção
        t('b', 'backlog', 'producao', '2026-09-10T12:00:00Z'),
        t('b', 'producao', 'revisao', '2026-09-20T12:00:00Z'), // 10 dias em produção
      ],
    });
    const producao = r.tempoPorEtapa.find(e => e.slug === 'producao')!;
    expect(producao).toMatchObject({ mediana: 7, n: 2 });
    expect(r.tempoPorEtapa.map(e => e.slug)).toEqual(['backlog', 'producao', 'revisao']); // etapa final fica de fora
  });

  it('voltas no fluxo: contam transições para uma etapa anterior e agrupam as principais', () => {
    const r = calcularCoordenacao({
      todos: [card({ id: 'a' }), card({ id: 'b' }), card({ id: 'c' })],
      etapas: ETAPAS,
      agora,
      historico: [
        t('a', 'producao', 'revisao', '2026-09-20T12:00:00Z'),
        t('a', 'revisao', 'producao', '2026-09-22T12:00:00Z'), // volta
        t('b', 'producao', 'revisao', '2026-09-21T12:00:00Z'),
        t('b', 'revisao', 'producao', '2026-09-23T12:00:00Z'), // volta
        t('c', 'producao', 'revisao', '2026-09-24T12:00:00Z'),
      ],
    });
    expect(r.voltas.cardsComVolta).toBe(2);
    expect(r.voltas.cardsComMovimento).toBe(3);
    expect(r.voltas.pct).toBe(67);
    expect(r.voltas.principais[0]).toEqual({ de: 'Revisão', para: 'Em Produção', n: 2 });
  });

  it('capacidade: compara os prazos das próximas semanas com a média de entregas por semana', () => {
    // 8 entregas espalhadas nas semanas fechadas anteriores => média 1/semana
    const entregas = Array.from({ length: 8 }, (_, i) =>
      entrega({ completed_at: new Date(agora.getTime() - (i + 1) * 7 * 86_400_000).toISOString() })
    );
    const abertos = [
      card({ due_date: '2026-10-07T12:00:00Z' }), // esta semana
      card({ due_date: '2026-10-08T12:00:00Z' }), // esta semana
      card({ due_date: '2026-10-09T12:00:00Z' }), // esta semana
      card({ due_date: '2026-10-14T12:00:00Z' }), // próxima semana
      card({ due_date: '2026-10-01T12:00:00Z' }), // atrasado: fora das próximas semanas
    ];
    const r = calcularCoordenacao({ todos: [...entregas, ...abertos], historico: [], etapas: ETAPAS, agora });
    expect(r.capacidade.porSemana).toBe(1);
    expect(r.capacidade.proximas[0]).toMatchObject({ rotulo: 'Esta semana', prazos: 3, nivel: 'estouro' });
    expect(r.capacidade.proximas[1]).toMatchObject({ prazos: 1, nivel: 'ok' });
    expect(r.capacidade.atrasadosNaFila).toBe(1);
  });

  it('segunda-feira da semana, no fuso de São Paulo', () => {
    expect(segundaDaSemana(new Date('2026-10-08T15:00:00Z')).toISOString()).toBe('2026-10-05T03:00:00.000Z');
  });
});
