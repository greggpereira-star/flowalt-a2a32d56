import { describe, expect, it } from 'vitest';
import { faltamParaMeta, inicioDaSemanaSP, percentualDaMeta, sugerirAlvo, type SemanaDeEntregas } from './metaDoTime';

describe('percentualDaMeta', () => {
  it('arredonda, limita em 100 e trata alvo ou progresso invalido', () => {
    expect(percentualDaMeta(8, 12)).toBe(67);
    expect(percentualDaMeta(15, 12)).toBe(100);
    expect(percentualDaMeta(0, 12)).toBe(0);
    expect(percentualDaMeta(5, 0)).toBe(0);
    expect(percentualDaMeta(-2, 10)).toBe(0);
  });
});

describe('faltamParaMeta', () => {
  it('nunca fica negativo', () => {
    expect(faltamParaMeta(8, 12)).toBe(4);
    expect(faltamParaMeta(12, 12)).toBe(0);
    expect(faltamParaMeta(20, 12)).toBe(0);
  });
});

describe('inicioDaSemanaSP', () => {
  it('devolve a segunda-feira da semana', () => {
    expect(inicioDaSemanaSP(new Date('2026-10-30T15:00:00Z'))).toBe('2026-10-26'); // sexta
    expect(inicioDaSemanaSP(new Date('2026-10-26T15:00:00Z'))).toBe('2026-10-26'); // a propria segunda
    expect(inicioDaSemanaSP(new Date('2026-11-01T15:00:00Z'))).toBe('2026-10-26'); // domingo ainda e da semana anterior
  });
  it('usa o fuso de Sao Paulo na virada do dia (domingo a noite no UTC ja e segunda em outro fuso, mas aqui ainda e domingo)', () => {
    // 01/11 (domingo) 22:00 em Sao Paulo = 02/11 01:00 UTC; ainda e a semana de 26/10
    expect(inicioDaSemanaSP(new Date('2026-11-02T01:00:00Z'))).toBe('2026-10-26');
    // 02/11 (segunda) 08:00 em Sao Paulo = 11:00 UTC: ja e a semana nova
    expect(inicioDaSemanaSP(new Date('2026-11-02T11:00:00Z'))).toBe('2026-11-02');
  });
});

describe('sugerirAlvo', () => {
  const hist: SemanaDeEntregas[] = [
    { semana_inicio: '2026-09-28', entregas: 6, no_prazo: 0 },
    { semana_inicio: '2026-10-05', entregas: 10, no_prazo: 1 },
    { semana_inicio: '2026-10-12', entregas: 6, no_prazo: 0 },
    { semana_inicio: '2026-10-19', entregas: 9, no_prazo: 1 },
    { semana_inicio: '2026-10-26', entregas: 15, no_prazo: 2 }, // semana atual (incompleta)
  ];
  it('entregas: media das ultimas 4 semanas fechadas + 10%, sem contar a atual', () => {
    // media (6 + 10 + 6 + 9) / 4 = 7,75; +10% = 8,525; arredonda para 9. A semana de 26/10 (15 entregas) esta incompleta e fica de fora.
    expect(sugerirAlvo('entregas', hist, '2026-10-26')).toBe(9);
  });
  it('no prazo: media + 2, minimo 3', () => {
    expect(sugerirAlvo('entregas_no_prazo', hist, '2026-10-26')).toBe(3);
  });
  it('sem historico fechado nao sugere nada', () => {
    expect(sugerirAlvo('entregas', [], '2026-10-26')).toBeNull();
    expect(sugerirAlvo('entregas', [{ semana_inicio: '2026-10-26', entregas: 15, no_prazo: 2 }], '2026-10-26')).toBeNull();
  });
  it('nunca sugere menos de 3', () => {
    expect(sugerirAlvo('entregas', [{ semana_inicio: '2026-10-19', entregas: 1, no_prazo: 0 }], '2026-10-26')).toBe(3);
  });
});
