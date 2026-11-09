import { describe, expect, it } from 'vitest';
import { descreverEvento, juntarNomes, type EventoDaLinha } from './linhaDoTempo';

const base: EventoDaLinha = { tipo: 'entrega', quando: '2026-11-02T12:00:00Z', titulo: 'Carrossel O Par', nomes: ['Ana'], alvo: null, detalhe: 'no_prazo', pontos: null };

describe('juntarNomes', () => {
  it('um, dois, tres e nenhum', () => {
    expect(juntarNomes(['Ana'])).toBe('Ana');
    expect(juntarNomes(['Ana', 'Rhunner'])).toBe('Ana e Rhunner');
    expect(juntarNomes(['Ana', 'Rhunner', 'Lucas'])).toBe('Ana, Rhunner e Lucas');
    expect(juntarNomes([])).toBe('Alguém');
  });
});

describe('descreverEvento', () => {
  it('entrega: concorda no plural e so marca "no prazo", nunca o atraso', () => {
    expect(descreverEvento(base)).toEqual({ quem: 'Ana', acao: 'entregou', complemento: '“Carrossel O Par”', selo: 'no prazo' });
    const atrasada = descreverEvento({ ...base, nomes: ['Ana', 'Rhunner'], detalhe: 'atrasada' });
    expect(atrasada.acao).toBe('entregaram');
    expect(atrasada.selo).toBeNull();
  });
  it('missao: atraso ou aprovacao, com os pontos no selo', () => {
    expect(descreverEvento({ ...base, tipo: 'missao', detalhe: 'atraso', pontos: 6 })).toMatchObject({ acao: 'resolveu o atraso de', selo: '+6 pts' });
    expect(descreverEvento({ ...base, tipo: 'missao', detalhe: 'aprovacao', pontos: 10, nomes: ['A', 'B'] })).toMatchObject({ acao: 'destravaram', selo: '+10 pts' });
  });
  it('conquista: nivel e trilha por extenso, com fallback seguro', () => {
    expect(descreverEvento({ ...base, tipo: 'conquista', titulo: null, detalhe: 'constante', pontos: 3 })).toMatchObject({ acao: 'chegou ao', complemento: 'Ouro em Constante' });
    expect(descreverEvento({ ...base, tipo: 'conquista', titulo: null, detalhe: 'xyz', pontos: 9 }).complemento).toBe('um novo nível em uma trilha');
  });
  it('kudos: quem deu, para quem e a categoria; sem o motivo', () => {
    expect(descreverEvento({ ...base, tipo: 'kudos', titulo: null, nomes: ['Gregg'], alvo: 'Ana', detalhe: 'ajuda' })).toEqual({ quem: 'Gregg', acao: 'deu kudos a', complemento: 'Ana', selo: 'Ajudou' });
  });
  it('titulo ausente vira "um card"', () => {
    expect(descreverEvento({ ...base, titulo: null }).complemento).toBe('um card');
  });
});
