import { describe, it, expect } from 'vitest';
import { contarRodadas, duracoesPorEtapa, enriquecerRisco, mediana, rotuloRisco } from './risco';
import type { CardEmAtencao } from '@/lib/coordination/coordMetrics';

const agora = new Date('2026-10-20T12:00:00Z');
const dia = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString();

const avaliado = (over: Partial<CardEmAtencao['card']> = {}, resp: string[] = ['u1']): CardEmAtencao => ({
  card: {
    id: 'c1', title: 'Post', status: 'in_progress', due_date: null, updated_at: dia(1), created_at: dia(20),
    current_stage: 'em_producao', stage_entered_at: dia(6), ...over,
  },
  responsaveis: resp, problemas: [], pontos: 0,
});

const hist = (n: number, dias: number) =>
  Array.from({ length: n }, (_, i) => [
    { card_id: `h${i}`, from_stage: null, to_stage: 'em_producao', created_at: dia(100) },
    { card_id: `h${i}`, from_stage: 'em_producao', to_stage: 'revisao', created_at: new Date(new Date(dia(100)).getTime() + dias * 86_400_000).toISOString() },
  ]).flat();

const base = { agora, nomeEtapa: (s: string) => s, abertosPorPessoa: new Map<string, number>(), pendentes: [] };

describe('mediana', () => {
  it('vazio, ímpar e par', () => {
    expect(mediana([])).toBeNull();
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('duracoesPorEtapa', () => {
  it('mede o tempo entre passagens consecutivas do mesmo card', () => {
    const d = duracoesPorEtapa(hist(2, 2));
    expect(d.get('em_producao')).toEqual([2, 2]);
  });
});

describe('enriquecerRisco', () => {
  it('marca lento quando passa do dobro da mediana com amostra suficiente', () => {
    const [r] = enriquecerRisco([avaliado()], { ...base, duracoes: duracoesPorEtapa(hist(5, 2)) });
    expect(r.problemas.map(p => p.tipo)).toContain('lento-historico');
    expect(r.pontos).toBe(2);
  });
  it('fica calado com poucas amostras', () => {
    const [r] = enriquecerRisco([avaliado()], { ...base, duracoes: duracoesPorEtapa(hist(4, 2)) });
    expect(r.problemas).toHaveLength(0);
  });
  it('não duplica quando o SLA da etapa já avisou', () => {
    const a = avaliado();
    a.problemas = [{ tipo: 'sla-aviso', etapa: 'x', dias: 6, limiteHoras: 72 }];
    const [r] = enriquecerRisco([a], { ...base, duracoes: duracoesPorEtapa(hist(5, 2)) });
    expect(r.problemas.map(p => p.tipo)).not.toContain('lento-historico');
  });
  it('sobrecarga acima do limite', () => {
    const [r] = enriquecerRisco([avaliado()], { ...base, duracoes: new Map(), abertosPorPessoa: new Map([['u1', 9]]) });
    expect(r.problemas.map(p => p.tipo)).toContain('sobrecarga');
  });
  it('aprovação parada só a partir de 3 dias', () => {
    const c = (d: number) => enriquecerRisco([avaliado()], { ...base, duracoes: new Map(), pendentes: [{ card_id: 'c1', enviado_em: dia(d) }] })[0];
    expect(c(2).problemas).toHaveLength(0);
    expect(c(4).problemas.map(p => p.tipo)).toContain('aprovacao-parada');
  });
  it('rotuloRisco explica com números', () => {
    expect(rotuloRisco({ tipo: 'aprovacao-parada', dias: 8 })).toEqual({ texto: 'cliente sem responder há 8 d', grave: true });
    expect(rotuloRisco({ tipo: 'sem-prazo' })).toBeNull();
  });
});

describe('rodadas de ajuste', () => {
  const comCliente = () => avaliado({ client_id: 'cli1' });
  const rodar = (usadas: number, limite?: number) =>
    enriquecerRisco([comCliente()], {
      ...base,
      duracoes: new Map(),
      rodadas: new Map([['c1', usadas]]),
      limitePorCliente: limite == null ? new Map() : new Map([['cli1', limite]]),
    })[0];

  it('alerta grave quando passa do contratado', () => {
    const r = rodar(3, 2);
    expect(r.problemas).toContainEqual({ tipo: 'rodadas', rodadas: 3, limite: 2 });
    expect(r.pontos).toBe(3);
  });
  it('avisa quando chega no limite', () => {
    const r = rodar(2, 2);
    expect(r.pontos).toBe(1);
  });
  it('fica calado abaixo do limite, sem rodadas ou sem limite definido', () => {
    expect(rodar(1, 2).problemas).toHaveLength(0);
    expect(rodar(0, 0).problemas).toHaveLength(0);
    expect(rodar(5).problemas).toHaveLength(0);
  });
  it('contarRodadas usa o maior entre voltas de etapa e ajustes do cliente, sem somar', () => {
    const m = contarRodadas([{ card_id: 'a' }, { card_id: 'a' }, { card_id: 'b' }], [{ card_id: 'a' }, { card_id: 'b' }, { card_id: 'b' }, { card_id: 'c' }]);
    expect(m.get('a')).toBe(2);
    expect(m.get('b')).toBe(2);
    expect(m.get('c')).toBe(1);
  });
  it('rotuloRisco explica as duas situações', () => {
    expect(rotuloRisco({ tipo: 'rodadas', rodadas: 3, limite: 2 })).toEqual({ texto: '3 rodadas de ajuste, 1 acima do contratado (2)', grave: true });
    expect(rotuloRisco({ tipo: 'rodadas', rodadas: 2, limite: 2 })?.grave).toBe(false);
  });
});
