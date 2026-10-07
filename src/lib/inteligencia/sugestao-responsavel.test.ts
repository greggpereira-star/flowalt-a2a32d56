import { describe, it, expect } from 'vitest';
import { sugerirResponsaveis, type Candidato } from './sugestao-responsavel';

const cands: Candidato[] = [
  { user_id: 'a', nome: 'Ana' },
  { user_id: 'b', nome: 'Bruno' },
  { user_id: 'c', nome: 'Caio' },
];
const entregas = (id: string, n: number) => Array.from({ length: n }, () => ({ members: [id] }));

describe('sugerirResponsaveis', () => {
  it('prefere quem mais entregou no space', () => {
    const r = sugerirResponsaveis(cands, [...entregas('a', 10), ...entregas('b', 30)], new Map());
    expect(r.map(s => s.user_id)).toEqual(['b', 'a']);
    expect(r[0].motivo).toBe('30 cards entregues neste space em 180 dias · 0 abertos agora');
  });
  it('a carga desconta a experiência', () => {
    const r = sugerirResponsaveis(cands, [...entregas('a', 20), ...entregas('b', 30)], new Map([['b', 7]]));
    expect(r[0].user_id).toBe('a'); // 20/1 > 30/8
  });
  it('exclui quem passou do limite de carga e quem já está no card', () => {
    const r = sugerirResponsaveis(cands, [...entregas('a', 10), ...entregas('b', 30), ...entregas('c', 5)], new Map([['b', 9]]), ['a']);
    expect(r.map(s => s.user_id)).toEqual(['c']);
  });
  it('ignora quem tem menos de 3 entregas e cai na menor carga, avisando que não há histórico', () => {
    const r = sugerirResponsaveis(cands, entregas('a', 2), new Map([['a', 4], ['b', 1]]));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ user_id: 'c', semHistorico: true });
    expect(r[0].motivo).toContain('sem histórico');
  });
  it('conta o card uma vez por pessoa mesmo com vínculo duplicado', () => {
    const r = sugerirResponsaveis(cands, [{ members: ['a', 'a'] }, { members: ['a'] }, { members: ['a'] }], new Map());
    expect(r[0].entregas).toBe(3);
  });
  it('sem candidatos devolve vazio', () => {
    expect(sugerirResponsaveis([], [], new Map())).toEqual([]);
  });
});
