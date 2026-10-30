import { describe, expect, it } from 'vitest';
import { BONUS_DIA_COMPLETO, diaCompleto, feitasNoDia, fraseDoProgresso, MISSOES_DIARIAS, percentualDoDia } from './diarias';

const nada = { moveu: false, comentou: false, entregou: false };

describe('missoes diarias', () => {
  it('os valores da legenda somam o maximo do dia com o bonus (12)', () => {
    expect(MISSOES_DIARIAS.reduce((t, m) => t + m.pontos, 0) + BONUS_DIA_COMPLETO).toBe(12);
  });
  it('conta feitas e detecta o dia completo', () => {
    expect(feitasNoDia(nada)).toBe(0);
    expect(feitasNoDia({ ...nada, comentou: true })).toBe(1);
    expect(diaCompleto({ moveu: true, comentou: true, entregou: false })).toBe(false);
    expect(diaCompleto({ moveu: true, comentou: true, entregou: true })).toBe(true);
  });
  it('a frase acompanha o progresso', () => {
    expect(fraseDoProgresso(nada)).toMatch(/Nenhuma feita/);
    expect(fraseDoProgresso({ ...nada, moveu: true })).toBe('Faltam 2 para fechar o dia.');
    expect(fraseDoProgresso({ moveu: true, comentou: true, entregou: false })).toMatch(/Falta 1 .* \+4/);
    expect(fraseDoProgresso({ moveu: true, comentou: true, entregou: true })).toMatch(/Dia completo/);
  });
  it('percentual nunca passa de 100 e nao quebra com maximo zero', () => {
    expect(percentualDoDia({ pontos_hoje: 6, pontos_max: 12 })).toBe(50);
    expect(percentualDoDia({ pontos_hoje: 20, pontos_max: 12 })).toBe(100);
    expect(percentualDoDia({ pontos_hoje: 3, pontos_max: 0 })).toBe(0);
  });
});
