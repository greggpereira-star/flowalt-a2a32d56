import { describe, expect, it } from 'vitest';
import { varsDaMarca } from './marca';

describe('cor da marca', () => {
  it('cor inválida ou vazia usa o tema padrão', () => {
    expect(varsDaMarca(null)).toBeUndefined();
    expect(varsDaMarca('')).toBeUndefined();
    expect(varsDaMarca('azul')).toBeUndefined();
    expect(varsDaMarca('#12345')).toBeUndefined();
    expect(varsDaMarca('javascript:alert(1)')).toBeUndefined();
  });

  it('converte o hex para H S% L% do tema', () => {
    const v = varsDaMarca('#ff0000') as Record<string, string>;
    expect(v['--primary']).toBe('0 100% 50%');
    const azul = varsDaMarca('#3947df') as Record<string, string>;
    expect(azul['--primary']).toMatch(/^23\d \d+% \d+%$/);
  });

  it('texto sobre cor escura é branco e sobre cor clara é escuro', () => {
    expect((varsDaMarca('#14183a') as Record<string, string>)['--primary-foreground']).toBe('0 0% 100%');
    expect((varsDaMarca('#ffd400') as Record<string, string>)['--primary-foreground']).toBe('0 0% 8%');
  });
});
