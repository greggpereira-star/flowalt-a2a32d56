import { describe, expect, it } from 'vitest';
import { mensagemDeErroDeDuelo, placarDoDuelo, resultadoParaMim, rotuloDaCategoriaDeDuelo, tempoRestanteDoDuelo } from './duelos';

describe('placarDoDuelo', () => {
  it('lider, empate e a barra proporcional', () => {
    expect(placarDoDuelo({ valor_desafiante: 6, valor_desafiado: 2 })).toEqual({ a: 6, b: 2, lider: 'desafiante', pctA: 75 });
    expect(placarDoDuelo({ valor_desafiante: 1, valor_desafiado: 3 })).toMatchObject({ lider: 'desafiado', pctA: 25 });
    expect(placarDoDuelo({ valor_desafiante: 2, valor_desafiado: 2 })).toMatchObject({ lider: 'empate', pctA: 50 });
  });
  it('sem ninguem pontuar a barra fica no meio e valores nulos viram zero', () => {
    expect(placarDoDuelo({ valor_desafiante: null, valor_desafiado: null })).toEqual({ a: 0, b: 0, lider: 'empate', pctA: 50 });
  });
});

describe('tempoRestanteDoDuelo', () => {
  const agora = new Date('2026-11-04T12:00:00Z');
  it('dias, amanha, hoje e terminando', () => {
    expect(tempoRestanteDoDuelo('2026-11-09T12:00:00Z', agora)).toBe('termina em 5 dias');
    expect(tempoRestanteDoDuelo('2026-11-05T11:00:00Z', agora)).toBe('termina amanhã');
    expect(tempoRestanteDoDuelo('2026-11-04T20:00:00Z', agora)).toBe('termina hoje');
    expect(tempoRestanteDoDuelo('2026-11-04T11:00:00Z', agora)).toBe('terminando');
    expect(tempoRestanteDoDuelo(null, agora)).toBe('');
  });
});

describe('resultadoParaMim', () => {
  it('venci, perdi, empate e quem so assiste', () => {
    expect(resultadoParaMim({ vencedor_id: 'eu', sou_participante: true }, 'eu')).toBe('venci');
    expect(resultadoParaMim({ vencedor_id: 'outro', sou_participante: true }, 'eu')).toBe('perdi');
    expect(resultadoParaMim({ vencedor_id: null, sou_participante: true }, 'eu')).toBe('empate');
    expect(resultadoParaMim({ vencedor_id: 'outro', sou_participante: false }, 'eu')).toBe('terceiro');
  });
});

describe('textos', () => {
  it('traduz o erro do banco e esconde erro tecnico', () => {
    expect(mensagemDeErroDeDuelo({ message: 'duelo:colega_ocupado' })).toMatch(/já está em um duelo/);
    expect(mensagemDeErroDeDuelo({ message: 'permission denied' })).toBe('Não foi possível concluir. Tente de novo.');
  });
  it('rotula as categorias e cai em "Duelo" para o resto', () => {
    expect(rotuloDaCategoriaDeDuelo('constancia')).toBe('Mais dias ativos');
    expect(rotuloDaCategoriaDeDuelo('xyz')).toBe('Duelo');
  });
});
