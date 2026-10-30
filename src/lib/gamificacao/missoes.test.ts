import { describe, expect, it } from 'vitest';
import { pontosEmJogo, separarMissoes, situacaoDaMissao, tempoRestanteDaMissao, type Missao } from './missoes';

const base: Missao = {
  id: '1', card_id: 'c', space_id: 's', titulo: 'Card', tipo: 'atraso', status: 'aberta', dias: 3,
  criada_em: '2026-11-02T12:00:00Z', expira_em: '2026-11-09T12:00:00Z', encerrada_em: null,
  pontos_cobranca: 3, pontos_resolucao: 6, cobrada_por: null, resolvida_por: null,
};

describe('situacaoDaMissao', () => {
  it('descreve atraso e aprovacao parada, com singular e plural', () => {
    expect(situacaoDaMissao({ tipo: 'atraso', dias: 3 })).toBe('Vencido há 3 dias');
    expect(situacaoDaMissao({ tipo: 'atraso', dias: 1 })).toBe('Vencido há 1 dia');
    expect(situacaoDaMissao({ tipo: 'aprovacao', dias: 4 })).toBe('Parado em aprovação há 4 dias');
  });
  it('nunca escreve "há 0 dias"', () => {
    expect(situacaoDaMissao({ tipo: 'atraso', dias: 0 })).toBe('Vencido há 1 dia');
  });
});

describe('tempoRestanteDaMissao', () => {
  const agora = new Date('2026-11-04T12:00:00Z');
  it('conta dias, mostra "hoje" no ultimo dia e "expirou" depois', () => {
    expect(tempoRestanteDaMissao('2026-11-09T12:00:00Z', agora)).toBe('expira em 5 dias');
    expect(tempoRestanteDaMissao('2026-11-05T06:00:00Z', agora)).toBe('expira hoje');
    expect(tempoRestanteDaMissao('2026-11-04T11:00:00Z', agora)).toBe('expirou');
  });
  it('arredonda para cima: 1 dia e meio sao 2 dias', () => {
    expect(tempoRestanteDaMissao('2026-11-06T00:00:00Z', agora)).toBe('expira em 2 dias');
  });
});

describe('separarMissoes e pontosEmJogo', () => {
  const lista: Missao[] = [
    base,
    { ...base, id: '2', tipo: 'aprovacao', pontos_resolucao: 10, cobrada_por: 'Ana' },
    { ...base, id: '3', status: 'cumprida', resolvida_por: 'Rhunner' },
    { ...base, id: '4', status: 'expirada' },
  ];
  it('separa abertas de encerradas', () => {
    const { abertas, encerradas } = separarMissoes(lista);
    expect(abertas.map(m => m.id)).toEqual(['1', '2']);
    expect(encerradas.map(m => m.id)).toEqual(['3', '4']);
  });
  it('soma so o que ainda da pontos: cobranca ja feita nao conta de novo', () => {
    expect(pontosEmJogo(separarMissoes(lista).abertas)).toBe(3 + 6 + 10);
    expect(pontosEmJogo([])).toBe(0);
  });
});
