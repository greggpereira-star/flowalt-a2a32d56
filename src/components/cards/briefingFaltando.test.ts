import { describe, expect, it } from 'vitest';
import { rotulosDosCamposFaltando } from './briefingDataUtils';

describe('rotulosDosCamposFaltando', () => {
  it('sem nada preenchido faltam contexto e entregaveis', () => {
    expect(rotulosDosCamposFaltando({})).toEqual(['Contexto', 'Entregáveis']);
    expect(rotulosDosCamposFaltando(null)).toEqual(['Contexto', 'Entregáveis']);
  });

  it('so com contexto faltam os entregaveis', () => {
    expect(rotulosDosCamposFaltando({ context: 'a'.repeat(30) })).toEqual(['Entregáveis']);
  });

  it('texto curto demais (abaixo do minimo) ainda conta como faltando', () => {
    expect(rotulosDosCamposFaltando({ context: 'oi', deliverables: 'a'.repeat(30) })).toEqual(['Contexto']);
  });

  it('com os dois obrigatorios nao falta nada', () => {
    expect(rotulosDosCamposFaltando({ context: 'a'.repeat(30), deliverables: 'a'.repeat(30) })).toEqual([]);
  });
});
