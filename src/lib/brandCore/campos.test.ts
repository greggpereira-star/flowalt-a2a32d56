import { describe, expect, it } from 'vitest';
import { LIMITE_CAMPO, SECOES, completude, limparDados, ordenarEsteira, resumoDoItem, rotuloDaEtapa, tituloDoItem } from './campos';

describe('limparDados', () => {
  it('mantém só campos conhecidos, aparados', () => {
    const r = limparDados(SECOES.persona, { nome: '  Mariana ', resumo: 'x', intruso: 'não entra', dores: 42 });
    expect(r).toEqual({ nome: 'Mariana', resumo: 'x' });
  });

  it('limita o tamanho de cada campo', () => {
    const r = limparDados(SECOES.persona, { nome: 'a'.repeat(LIMITE_CAMPO + 500) });
    expect(r.nome).toHaveLength(LIMITE_CAMPO);
  });

  it('descarta valor de select fora das opções', () => {
    expect(limparDados(SECOES.offer, { nome: 'Curso', etapa: 'inventada' })).toEqual({ nome: 'Curso' });
    expect(limparDados(SECOES.offer, { nome: 'Curso', etapa: 'premium' })).toEqual({ nome: 'Curso', etapa: 'premium' });
  });

  it('aceita entrada inválida sem quebrar', () => {
    expect(limparDados(SECOES.persona, null)).toEqual({});
    expect(limparDados(SECOES.persona, 'texto')).toEqual({});
    expect(limparDados(SECOES.persona, [1, 2])).toEqual({});
  });
});

describe('completude', () => {
  it('conta só os campos essenciais e lista o que falta', () => {
    const r = completude(SECOES.persona, { nome: 'Mariana', resumo: '  ', dores: 'Falta de tempo', observacao: 'ignorada' });
    expect(r.total).toBe(4);
    expect(r.preenchidos).toBe(2);
    expect(r.faltando).toEqual(['Quem é', 'Desejos']);
  });

  it('item vazio tem tudo faltando', () => {
    const r = completude(SECOES.competitor, {});
    expect(r.preenchidos).toBe(0);
    expect(r.faltando.length).toBe(r.total);
  });
});

describe('título e resumo do cartão', () => {
  it('usa o campo de título e cai em "Sem nome"', () => {
    expect(tituloDoItem(SECOES.persona, { nome: 'Mariana' })).toBe('Mariana');
    expect(tituloDoItem(SECOES.persona, {})).toBe('Sem nome');
  });

  it('encurta resumos longos', () => {
    const r = resumoDoItem(SECOES.persona, { resumo: 'a'.repeat(300) });
    expect(r.length).toBe(140);
    expect(r.endsWith('…')).toBe(true);
  });

  it('mostra o preço da oferta e vazio quando não há', () => {
    expect(resumoDoItem(SECOES.offer, { preco: 'R$ 197' })).toBe('R$ 197');
    expect(resumoDoItem(SECOES.offer, {})).toBe('');
  });
});

describe('esteira', () => {
  it('ordena da isca ao recorrente, sem etapa por último, estável dentro da etapa', () => {
    const itens = [
      { id: 'a', data: { etapa: 'premium' } },
      { id: 'b', data: {} },
      { id: 'c', data: { etapa: 'isca' } },
      { id: 'd', data: { etapa: 'premium' } },
      { id: 'e', data: { etapa: 'recorrente' } },
    ];
    expect(ordenarEsteira(itens).map(i => i.id)).toEqual(['c', 'a', 'd', 'e', 'b']);
  });

  it('rotula a etapa', () => {
    expect(rotuloDaEtapa('entrada')).toBe('2. Entrada');
    expect(rotuloDaEtapa(undefined)).toBe('');
  });
});
