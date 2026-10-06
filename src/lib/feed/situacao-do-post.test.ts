import { describe, expect, it } from 'vitest';
import { chaveMes, dataDoPost, situacaoDoPost } from './situacao-do-post';

describe('situação do post no feed editorial', () => {
  it('link do post preenchido significa publicado, acima de qualquer outro estado', () => {
    expect(situacaoDoPost('delivered', 'concluido', 'https://instagram.com/p/x', 'aprovado')).toBe('publicado');
    expect(situacaoDoPost('backlog', 'backlog', 'https://instagram.com/p/x', null)).toBe('publicado');
  });

  it('link só com espaços não conta como publicado', () => {
    expect(situacaoDoPost('backlog', 'backlog', '   ', null)).toBe('planejado');
  });

  it('aprovação do cliente decide quando existe', () => {
    expect(situacaoDoPost('review', 'revisao', null, 'aprovado')).toBe('aprovado');
    expect(situacaoDoPost('in_progress', 'em_producao', null, 'pendente')).toBe('em_aprovacao');
  });

  it('ajustes pedidos pelo cliente voltam para produção, mesmo com o card marcado como aprovado', () => {
    expect(situacaoDoPost('approved', 'aprovacao', null, 'ajustes')).toBe('em_producao');
  });

  it('sem aprovação, vale a etapa do card', () => {
    expect(situacaoDoPost('approved', 'aprovacao', null, null)).toBe('aprovado');
    expect(situacaoDoPost('in_progress', 'em_producao', null, null)).toBe('em_producao');
    expect(situacaoDoPost('review', 'revisao', null, null)).toBe('em_producao');
    expect(situacaoDoPost('backlog', 'backlog', null, null)).toBe('planejado');
    expect(situacaoDoPost('todo', 'planejamento', null, null)).toBe('planejado');
  });

  it('etapa Aprovação sem pedido ao cliente ainda é em aprovação interna', () => {
    expect(situacaoDoPost('review', 'aprovacao', null, null)).toBe('em_aprovacao');
  });
});

describe('mês e data do post', () => {
  it('chave do mês usa mês 0 a 11 e zero à esquerda', () => {
    expect(chaveMes(2026, 0)).toBe('2026-01');
    expect(chaveMes(2026, 9)).toBe('2026-10');
    expect(chaveMes(2026, 11)).toBe('2026-12');
  });

  it('data válida volta como veio, sem mexer em fuso', () => {
    expect(dataDoPost('2026-10-06')).toBe('2026-10-06');
    expect(dataDoPost('2026-10-06T23:30:00-03:00')).toBe('2026-10-06');
  });

  it('data inválida ou vazia vira nulo', () => {
    expect(dataDoPost('')).toBeNull();
    expect(dataDoPost(null)).toBeNull();
    expect(dataDoPost('06/10/2026')).toBeNull();
    expect(dataDoPost('2026-13-40')).toBeNull();
  });
});
