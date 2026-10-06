import { describe, expect, it } from 'vitest';
import {
  diaDoOnboarding,
  diasEntre,
  etapaAtual,
  marcos,
  progresso,
  proximaTarefa,
  resumoPorEtapa,
  situacaoDoOnboarding,
  somaDias,
  tarefaAtrasada,
  type EtapaOnb,
  type TarefaOnb,
} from './esteira';

const etapas: EtapaOnb[] = [
  { key: 'kickoff', name: 'Kick-off', sort_order: 2 },
  { key: 'administrativo', name: 'Administrativo', sort_order: 1 },
  { key: 'cadencia_15', name: 'Cadência de 15 dias', sort_order: 3 },
];

const t = (p: Partial<TarefaOnb>): TarefaOnb => ({
  id: Math.random().toString(36).slice(2),
  stage_key: 'administrativo',
  title: 'Tarefa',
  due_date: null,
  completed_at: null,
  assignee_id: null,
  sort_order: 1,
  ...p,
});

describe('datas do onboarding', () => {
  it('o dia do início é o dia 1', () => {
    expect(diaDoOnboarding('2026-09-23', '2026-09-23')).toBe(1);
    expect(diaDoOnboarding('2026-09-23', '2026-10-06')).toBe(14);
  });

  it('diferença de dias atravessa mês e ano sem erro de fuso', () => {
    expect(diasEntre('2026-12-30', '2027-01-02')).toBe(3);
    expect(diasEntre('2026-10-31', '2026-11-01')).toBe(1);
    expect(diasEntre('2026-10-10', '2026-10-05')).toBe(-5);
  });

  it('soma de dias vira o mês corretamente', () => {
    expect(somaDias('2026-09-23', 30)).toBe('2026-10-23');
    expect(somaDias('2026-12-20', 15)).toBe('2027-01-04');
  });

  it('marcos de 15 e 30 dias contam o início como dia 1', () => {
    const m = marcos('2026-09-23', '2026-10-06');
    expect(m.dia15).toEqual({ data: '2026-10-07', passou: false, faltam: 1 });
    expect(m.dia30).toEqual({ data: '2026-10-22', passou: false, faltam: 16 });
    expect(marcos('2026-09-23', '2026-10-08').dia15.passou).toBe(true);
  });
});

describe('tarefas e etapas', () => {
  it('tarefa atrasada: pendente com prazo anterior a hoje', () => {
    expect(tarefaAtrasada(t({ due_date: '2026-10-05' }), '2026-10-06')).toBe(true);
    expect(tarefaAtrasada(t({ due_date: '2026-10-06' }), '2026-10-06')).toBe(false);
    expect(tarefaAtrasada(t({ due_date: '2026-10-01', completed_at: '2026-10-02T10:00:00Z' }), '2026-10-06')).toBe(false);
    expect(tarefaAtrasada(t({ due_date: null }), '2026-10-06')).toBe(false);
  });

  it('progresso conta feitas sobre o total', () => {
    expect(progresso([t({ completed_at: 'x' }), t({}), t({ completed_at: 'y' }), t({})])).toEqual({ feitas: 2, total: 4, pct: 50 });
    expect(progresso([])).toEqual({ feitas: 0, total: 0, pct: 0 });
  });

  it('etapa atual é a primeira, na ordem do modelo, com tarefa pendente', () => {
    const tarefas = [
      t({ stage_key: 'administrativo', completed_at: 'x' }),
      t({ stage_key: 'kickoff' }),
      t({ stage_key: 'cadencia_15' }),
    ];
    expect(etapaAtual(etapas, tarefas)).toBe('kickoff');
  });

  it('uma tarefa pendente numa etapa anterior mantém o cliente nela', () => {
    const tarefas = [t({ stage_key: 'administrativo' }), t({ stage_key: 'kickoff', completed_at: 'x' })];
    expect(etapaAtual(etapas, tarefas)).toBe('administrativo');
  });

  it('tudo feito, ou sem tarefas, não tem etapa atual', () => {
    expect(etapaAtual(etapas, [t({ completed_at: 'x' })])).toBeNull();
    expect(etapaAtual(etapas, [])).toBeNull();
  });

  it('resumo por etapa traz feitas, atrasadas e se está concluída', () => {
    const tarefas = [
      t({ stage_key: 'administrativo', completed_at: 'x', due_date: '2026-10-01' }),
      t({ stage_key: 'administrativo', completed_at: 'y', due_date: '2026-10-02' }),
      t({ stage_key: 'kickoff', due_date: '2026-10-03' }),
      t({ stage_key: 'kickoff', due_date: '2026-10-20' }),
    ];
    const r = resumoPorEtapa(etapas, tarefas, '2026-10-06');
    expect(r.map(e => e.key)).toEqual(['administrativo', 'kickoff', 'cadencia_15']);
    expect(r[0]).toMatchObject({ feitas: 2, total: 2, atrasadas: 0, concluida: true });
    expect(r[1]).toMatchObject({ feitas: 0, total: 2, atrasadas: 1, concluida: false });
    expect(r[2]).toMatchObject({ total: 0, concluida: false });
  });

  it('próxima tarefa: menor prazo pendente, sem prazo por último', () => {
    const a = t({ id: 'a', due_date: '2026-10-10' });
    const b = t({ id: 'b', due_date: '2026-10-08' });
    const c = t({ id: 'c', due_date: null });
    const d = t({ id: 'd', due_date: '2026-10-01', completed_at: 'x' });
    expect(proximaTarefa([a, b, c, d])?.id).toBe('b');
    expect(proximaTarefa([c])?.id).toBe('c');
    expect(proximaTarefa([d])).toBeNull();
  });

  it('situação do onboarding: concluído, atrasado ou no prazo', () => {
    expect(situacaoDoOnboarding([t({ completed_at: 'x' })], '2026-10-06')).toBe('concluido');
    expect(situacaoDoOnboarding([t({ due_date: '2026-10-01' }), t({ completed_at: 'x' })], '2026-10-06')).toBe('atrasado');
    expect(situacaoDoOnboarding([t({ due_date: '2026-10-20' })], '2026-10-06')).toBe('no_prazo');
  });
});
