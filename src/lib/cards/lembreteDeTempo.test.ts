import { beforeEach, describe, expect, it, vi } from 'vitest';

const info = vi.fn();
let resposta: { count: number | null; error: unknown } = { count: 0, error: null };

vi.mock('sonner', () => ({ toast: { info: (...a: unknown[]) => info(...a) } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => Promise.resolve(resposta) }) }),
  },
}));

import { lembrarDeTempo } from './lembreteDeTempo';

describe('lembrete de tempo ao entregar', () => {
  beforeEach(() => {
    info.mockClear();
    localStorage.clear();
    resposta = { count: 0, error: null };
  });

  it('avisa quando o card foi entregue sem nenhum tempo registrado', async () => {
    expect(await lembrarDeTempo('c1')).toBe(true);
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('não avisa quando já existe tempo registrado', async () => {
    resposta = { count: 3, error: null };
    expect(await lembrarDeTempo('c1')).toBe(false);
    expect(info).not.toHaveBeenCalled();
  });

  it('avisa no máximo uma vez por dia, mesmo entregando vários cards', async () => {
    await Promise.all([lembrarDeTempo('a'), lembrarDeTempo('b'), lembrarDeTempo('c')]);
    expect(info).toHaveBeenCalledTimes(1);
    expect(await lembrarDeTempo('d')).toBe(false);
  });

  it('não incomoda nem quebra quando a consulta falha', async () => {
    resposta = { count: null, error: new Error('rede') };
    expect(await lembrarDeTempo('c1')).toBe(false);
    expect(info).not.toHaveBeenCalled();
  });
});
