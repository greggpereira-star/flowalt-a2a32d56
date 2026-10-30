import { describe, expect, it } from 'vitest';
import { liderDaTrilha, nomeDoNivel, progressoDaTrilha, resumoDoTime, type LinhaDeConquista } from './conquistas';

const lim = [10, 50, 150];

describe('progressoDaTrilha', () => {
  it('sem nivel: avanco ate o bronze', () => {
    expect(progressoDaTrilha(0, lim)).toEqual({ nivel: 0, proximoAlvo: 10, falta: 10, pct: 0 });
    expect(progressoDaTrilha(6, lim)).toEqual({ nivel: 0, proximoAlvo: 10, falta: 4, pct: 60 });
  });
  it('cruzar o limite sobe de nivel e o avanco recomeca no degrau', () => {
    expect(progressoDaTrilha(10, lim)).toEqual({ nivel: 1, proximoAlvo: 50, falta: 40, pct: 0 });
    expect(progressoDaTrilha(30, lim)).toEqual({ nivel: 1, proximoAlvo: 50, falta: 20, pct: 50 });
    expect(progressoDaTrilha(127, lim).nivel).toBe(2);
  });
  it('no ouro nao ha proximo alvo e a barra fica cheia', () => {
    expect(progressoDaTrilha(150, lim)).toEqual({ nivel: 3, proximoAlvo: null, falta: 0, pct: 100 });
    expect(progressoDaTrilha(999, lim).nivel).toBe(3);
  });
  it('limites de 1 (dia completo, campeao): bronze com o primeiro', () => {
    expect(progressoDaTrilha(0, [1, 10, 30])).toMatchObject({ nivel: 0, proximoAlvo: 1, falta: 1, pct: 0 });
    expect(progressoDaTrilha(1, [1, 10, 30]).nivel).toBe(1);
  });
});

describe('nomeDoNivel', () => {
  it('nomeia os tres niveis e o zero', () => {
    expect([0, 1, 2, 3].map(nomeDoNivel)).toEqual(['Sem nível', 'Bronze', 'Prata', 'Ouro']);
  });
});

const l = (user_id: string, trilha: LinhaDeConquista['trilha'], valor: number, nivel: number): LinhaDeConquista => ({ user_id, trilha, valor, nivel, limites: lim, conquistado_em: null });

describe('resumoDoTime e liderDaTrilha', () => {
  const linhas = [l('a', 'entregador', 127, 2), l('b', 'entregador', 47, 1), l('c', 'entregador', 0, 0), l('a', 'voz', 151, 3), l('b', 'voz', 66, 2)];
  it('conta o melhor nivel de cada pessoa em cada trilha', () => {
    expect(resumoDoTime(linhas)).toEqual({ bronze: 1, prata: 2, ouro: 1 });
  });
  it('acha o lider e ignora quem tem zero', () => {
    expect(liderDaTrilha(linhas, 'entregador')).toEqual({ user_id: 'a', valor: 127 });
    expect(liderDaTrilha(linhas, 'campeao')).toBeNull();
    expect(liderDaTrilha([l('c', 'pontual', 0, 0)], 'pontual')).toBeNull();
  });
});
