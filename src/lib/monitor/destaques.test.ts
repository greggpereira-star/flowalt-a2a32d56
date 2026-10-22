import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarDestaques } from './destaques';

describe('criarDestaques', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const registro = () => {
    const estados: string[][] = [];
    return { estados, aoMudar: (ids: ReadonlySet<string>) => estados.push([...ids].sort()) };
  };

  it('a marca some depois da duracao', () => {
    const { estados, aoMudar } = registro();
    const d = criarDestaques(10_000, aoMudar);
    d.marcar(['a']);
    expect(estados.at(-1)).toEqual(['a']);
    vi.advanceTimersByTime(9_999);
    expect(estados.at(-1)).toEqual(['a']);
    vi.advanceTimersByTime(1);
    expect(estados.at(-1)).toEqual([]);
  });

  it('uma segunda demanda NAO cancela o cronometro da primeira (o defeito medido na tela)', () => {
    const { estados, aoMudar } = registro();
    const d = criarDestaques(10_000, aoMudar);
    d.marcar(['a']);
    vi.advanceTimersByTime(4_000);
    d.marcar(['b']);
    expect(estados.at(-1)).toEqual(['a', 'b']);
    vi.advanceTimersByTime(6_000); // a completa 10 s
    expect(estados.at(-1)).toEqual(['b']);
    vi.advanceTimersByTime(4_000); // b completa 10 s
    expect(estados.at(-1)).toEqual([]);
  });

  it('marcar de novo a mesma demanda reinicia so o cronometro dela', () => {
    const { estados, aoMudar } = registro();
    const d = criarDestaques(10_000, aoMudar);
    d.marcar(['a']);
    vi.advanceTimersByTime(8_000);
    d.marcar(['a']);
    vi.advanceTimersByTime(8_000);
    expect(estados.at(-1)).toEqual(['a']); // 16 s depois da primeira, mas so 8 s da segunda
    vi.advanceTimersByTime(2_000);
    expect(estados.at(-1)).toEqual([]);
  });

  it('nao dispara nada quando nao ha demanda nova', () => {
    const { estados, aoMudar } = registro();
    criarDestaques(10_000, aoMudar).marcar([]);
    expect(estados).toEqual([]);
  });

  it('limpar cancela tudo e nao deixa evento para depois', () => {
    const { estados, aoMudar } = registro();
    const d = criarDestaques(10_000, aoMudar);
    d.marcar(['a', 'b']);
    d.limpar();
    const antes = estados.length;
    vi.advanceTimersByTime(60_000);
    expect(estados.length).toBe(antes);
  });
});
