import { describe, expect, it } from 'vitest';
import { intervaloDeIds, resumoDoLote, separarArquivaveis, statusDaCopia } from './bulk';

const cards = [
  { id: 'a', created_by: 'u1' },
  { id: 'b', created_by: 'u2' },
  { id: 'c', created_by: null },
];

describe('separarArquivaveis', () => {
  it('admin arquiva tudo', () => {
    const r = separarArquivaveis(cards, { podeArquivarTudo: true, userId: 'u9' });
    expect(r.permitidos).toHaveLength(3);
    expect(r.ignorados).toHaveLength(0);
  });
  it('membro só arquiva o que criou', () => {
    const r = separarArquivaveis(cards, { podeArquivarTudo: false, userId: 'u1' });
    expect(r.permitidos.map(c => c.id)).toEqual(['a']);
    expect(r.ignorados.map(c => c.id)).toEqual(['b', 'c']);
  });
  it('o responsável do card também pode arquivar', () => {
    const r = separarArquivaveis([{ id: 'x', created_by: 'u2', owner_id: 'u1' }, ...cards], { podeArquivarTudo: false, userId: 'u1' });
    expect(r.permitidos.map(c => c.id)).toEqual(['x', 'a']);
  });
  it('sem usuário nada é permitido, nem card sem autor', () => {
    const r = separarArquivaveis(cards, { podeArquivarTudo: false, userId: null });
    expect(r.permitidos).toHaveLength(0);
  });
});

describe('intervaloDeIds', () => {
  const ordem = ['a', 'b', 'c', 'd', 'e'];
  it('inclui as pontas', () => expect(intervaloDeIds(ordem, 'b', 'd')).toEqual(['b', 'c', 'd']));
  it('funciona de trás para frente', () => expect(intervaloDeIds(ordem, 'd', 'b')).toEqual(['b', 'c', 'd']));
  it('âncora fora da lista seleciona só o destino', () => expect(intervaloDeIds(ordem, 'x', 'c')).toEqual(['c']));
  it('destino fora da lista não seleciona nada', () => expect(intervaloDeIds(ordem, 'a', 'x')).toEqual([]));
});

describe('resumoDoLote', () => {
  it('tudo certo', () => expect(resumoDoLote('duplicar', { ok: 5, falhas: 0, ignorados: 0 })).toBe('5 duplicados'));
  it('singular', () => expect(resumoDoLote('arquivar', { ok: 1, falhas: 0, ignorados: 0 })).toBe('1 arquivado'));
  it('com falha e ignorados', () =>
    expect(resumoDoLote('arquivar', { ok: 8, falhas: 1, ignorados: 2 })).toBe('8 arquivados, 1 falhou, 2 ignorados (sem permissão)'));
  it('só ignorados', () => expect(resumoDoLote('arquivar', { ok: 0, falhas: 0, ignorados: 3 })).toBe('3 ignorados (sem permissão)'));
  it('só falhas', () => expect(resumoDoLote('copiar', { ok: 0, falhas: 2, ignorados: 0 })).toBe('2 falharam'));
});

describe('statusDaCopia', () => {
  it('mantém a coluna de trabalho', () => expect(statusDaCopia('in_progress')).toBe('in_progress'));
  it('entregue e arquivado voltam ao backlog', () => {
    expect(statusDaCopia('delivered')).toBe('backlog');
    expect(statusDaCopia('archived')).toBe('backlog');
  });
});
