import { describe, expect, it } from 'vitest';
import { mensagemDeErroDeKudos, MOTIVO_MAX, MOTIVO_MIN, rotuloDaCategoria, rotuloDeRestantes, validarMotivo } from './kudos';

describe('validarMotivo', () => {
  it('exige o minimo e o maximo, ignorando espacos nas pontas', () => {
    expect(validarMotivo('curto')).toMatch(/pelo menos 10/);
    expect(validarMotivo('   ' + 'a'.repeat(MOTIVO_MIN - 1) + '   ')).not.toBeNull();
    expect(validarMotivo('a'.repeat(MOTIVO_MIN))).toBeNull();
    expect(validarMotivo('a'.repeat(MOTIVO_MAX))).toBeNull();
    expect(validarMotivo('a'.repeat(MOTIVO_MAX + 1))).toMatch(/passou de 280/);
  });
});

describe('rotuloDeRestantes', () => {
  it('singular, plural e sem palmas', () => {
    expect(rotuloDeRestantes(3)).toBe('Você tem 3 palmas esta semana.');
    expect(rotuloDeRestantes(1)).toBe('Você tem 1 palma esta semana.');
    expect(rotuloDeRestantes(0)).toMatch(/acabaram/);
  });
});

describe('mensagemDeErroDeKudos', () => {
  it('traduz os erros do banco', () => {
    expect(mensagemDeErroDeKudos({ message: 'kudos:limite_semanal' })).toMatch(/acabaram/);
    expect(mensagemDeErroDeKudos({ message: 'kudos:colega_repetido' })).toMatch(/já deu kudos/);
    expect(mensagemDeErroDeKudos(new Error('kudos:si_mesmo'))).toMatch(/não para você/);
  });
  it('erro desconhecido vira mensagem generica, sem vazar texto tecnico', () => {
    const msg = mensagemDeErroDeKudos({ message: 'permission denied for table kudos' });
    expect(msg).toBe('Não foi possível enviar o kudos. Tente de novo.');
    expect(mensagemDeErroDeKudos(undefined)).toBe(msg);
  });
});

describe('rotuloDaCategoria', () => {
  it('rotula as conhecidas e cai em "Kudos" para o resto', () => {
    expect(rotuloDaCategoria('prazo')).toBe('Salvou o prazo');
    expect(rotuloDaCategoria('xyz')).toBe('Kudos');
  });
});
