import { describe, expect, it } from 'vitest';
import { diasRestantesNaTemporada, mesDaTemporadaSP, pontosParaAlcancar, proximoMes, rotuloDeDiasRestantes, rotuloDoMes } from './temporada';

describe('mesDaTemporadaSP', () => {
  it('usa o mes de Sao Paulo, nao o do UTC, na virada', () => {
    expect(mesDaTemporadaSP(new Date('2026-10-30T15:00:00Z'))).toBe('2026-10-01');
    // 31/10 23:00 em Sao Paulo = 01/11 02:00 UTC: ainda e outubro
    expect(mesDaTemporadaSP(new Date('2026-11-01T02:00:00Z'))).toBe('2026-10-01');
    // 01/11 00:30 em Sao Paulo = 01/11 03:30 UTC: ja e novembro
    expect(mesDaTemporadaSP(new Date('2026-11-01T03:30:00Z'))).toBe('2026-11-01');
  });
});

describe('proximoMes e rotuloDoMes', () => {
  it('passa de dezembro para janeiro do ano seguinte', () => {
    expect(proximoMes('2026-12-01')).toBe('2027-01-01');
    expect(proximoMes('2026-10-01')).toBe('2026-11-01');
  });
  it('escreve o mes por extenso em portugues', () => {
    expect(rotuloDoMes('2026-11-01')).toBe('novembro de 2026');
    expect(rotuloDoMes('2027-03-01')).toBe('março de 2027');
  });
});

describe('diasRestantesNaTemporada', () => {
  it('conta os dias depois de hoje e zera no ultimo dia', () => {
    expect(diasRestantesNaTemporada(new Date('2026-11-10T15:00:00Z'))).toBe(20); // novembro tem 30 dias
    expect(diasRestantesNaTemporada(new Date('2026-11-30T15:00:00Z'))).toBe(0);
    expect(diasRestantesNaTemporada(new Date('2026-10-30T15:00:00Z'))).toBe(1); // outubro tem 31
    expect(diasRestantesNaTemporada(new Date('2028-02-20T15:00:00Z'))).toBe(9); // 2028 e bissexto: fevereiro tem 29
  });
  it('rotula no singular, plural e ultimo dia', () => {
    expect(rotuloDeDiasRestantes(0)).toBe('último dia');
    expect(rotuloDeDiasRestantes(1)).toBe('falta 1 dia');
    expect(rotuloDeDiasRestantes(12)).toBe('faltam 12 dias');
  });
});

describe('pontosParaAlcancar', () => {
  it('quanto falta para passar quem esta na frente; lider ou sem referencia = 0', () => {
    expect(pontosParaAlcancar(468, 526)).toBe(59);
    expect(pontosParaAlcancar(526, null)).toBe(0);
    expect(pontosParaAlcancar(530, 526)).toBe(0);
  });
});
