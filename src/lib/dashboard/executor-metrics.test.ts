import { describe, expect, it } from 'vitest';
import type { CardRow } from '@/lib/analytics/metrics';
import { calcularExecutor } from './executor-metrics';

const agora = new Date('2026-10-05T16:00:00Z');
const EU = 'eu';
const OUTRO = 'outro';

let seq = 0;
const card = (p: Partial<CardRow>): CardRow => ({
  id: `c${++seq}`,
  title: `Card ${seq}`,
  status: 'todo',
  due_date: null,
  completed_at: null,
  created_at: '2026-09-01T12:00:00Z',
  updated_at: '2026-10-04T12:00:00Z',
  space_id: null,
  client_id: null,
  estimated_hours: null,
  actual_hours: null,
  members: [EU],
  ...p,
});

describe('Dashboard do executor', () => {
  it('conta só os cards em que a pessoa é responsável', () => {
    const r = calcularExecutor({
      meuId: EU,
      agora,
      todos: [card({}), card({}), card({ members: [OUTRO] }), card({ members: [OUTRO, EU] })],
    });
    expect(r.abertos).toBe(3);
  });

  it('atrasados seguem a definição oficial: aprovado vencido não conta', () => {
    const r = calcularExecutor({
      meuId: EU,
      agora,
      todos: [
        card({ status: 'review', due_date: '2026-10-01T12:00:00Z' }),
        card({ status: 'approved', due_date: '2026-10-01T12:00:00Z' }),
        card({ status: 'todo', due_date: '2026-10-09T12:00:00Z' }),
      ],
    });
    expect(r.atrasados).toBe(1);
    expect(r.abertos).toBe(2);
    expect(r.vencem7d).toBe(1);
  });

  it('próximos prazos: atrasados primeiro, do mais antigo, e informa os dias', () => {
    const r = calcularExecutor({
      meuId: EU,
      agora,
      todos: [
        card({ title: 'futuro', due_date: '2026-10-08T16:00:00Z' }),
        card({ title: 'velho', due_date: '2026-09-25T16:00:00Z' }),
        card({ title: 'recente', due_date: '2026-10-03T16:00:00Z' }),
      ],
    });
    expect(r.proximosPrazos.map(p => p.title)).toEqual(['velho', 'recente', 'futuro']);
    expect(r.proximosPrazos[0]).toMatchObject({ atrasado: true, diasAtraso: 10 });
    expect(r.proximosPrazos[2]).toMatchObject({ atrasado: false, diasAtraso: -3 });
  });

  it('compara com o time na mesma janela (no prazo e tempo de entrega)', () => {
    const concl = (members: string[], criado: string, concluido: string, prazo: string) =>
      card({ members, status: 'delivered', created_at: criado, completed_at: concluido, due_date: prazo });
    const r = calcularExecutor({
      meuId: EU,
      agora,
      todos: [
        concl([EU], '2026-09-20T12:00:00Z', '2026-09-25T12:00:00Z', '2026-09-26T12:00:00Z'), // no prazo
        concl([OUTRO], '2026-09-20T12:00:00Z', '2026-09-30T12:00:00Z', '2026-09-22T12:00:00Z'), // atrasado
      ],
    });
    expect(r.meu).toMatchObject({ concluidos: 1, noPrazoPct: 100 });
    expect(r.time).toMatchObject({ concluidos: 2, noPrazoPct: 50 });
  });

  it('distribui o trabalho aberto por etapa, na ordem do fluxo', () => {
    const r = calcularExecutor({
      meuId: EU,
      agora,
      todos: [card({ status: 'review' }), card({ status: 'review' }), card({ status: 'backlog' }), card({ status: 'delivered' })],
    });
    expect(r.porEtapa).toEqual([
      { status: 'backlog', n: 1 },
      { status: 'briefing', n: 0 },
      { status: 'todo', n: 0 },
      { status: 'in_progress', n: 0 },
      { status: 'review', n: 2 },
    ]);
  });

  it('postagens: só aparecem para quem tem card em espaço de Social Media', () => {
    const social = new Set(['sm']);
    const c1 = card({ space_id: 'sm', title: 'Reels' });
    const c2 = card({ space_id: 'sm', title: 'Carrossel' });
    const c3 = card({ space_id: 'sm', title: 'Sem data' });
    const datas = new Map([[c1.id, '2026-10-07'], [c2.id, '2026-10-30']]);

    const r = calcularExecutor({ meuId: EU, agora, todos: [c1, c2, c3], espacosSocial: social, datasDePostagem: datas });
    expect(r.postagens?.proximas.map(p => p.title)).toEqual(['Reels']); // 30/10 fica fora dos 7 dias
    expect(r.postagens?.semData).toBe(1);

    const semSocial = calcularExecutor({ meuId: EU, agora, todos: [card({ space_id: 'design' })], espacosSocial: social });
    expect(semSocial.postagens).toBeNull();
  });

  it('cards parados e sem prazo entram na saúde da fila', () => {
    const r = calcularExecutor({
      meuId: EU,
      agora,
      todos: [card({ updated_at: '2026-09-01T00:00:00Z' }), card({ due_date: '2026-10-20T00:00:00Z' })],
    });
    expect(r.parados).toBe(1);
    expect(r.semPrazo).toBe(1);
  });
});
