import { describe, expect, it } from 'vitest';
import { gerarLeituraDoDia, type EntradaDaLeitura } from './leituraDoDia';

const base: EntradaDaLeitura = {
  atrasados: 0, foraDoSla: 0, maisAntigoAtrasado: null, noPrazo: 0, comPrazo: 0, noPrazoPct: null, noPrazoAnteriorPct: null,
  entregas30: 0, entregas30Anterior: 0, cargaAcimaDoLimite: [], limiteDeCarga: 8, parados14d: 0, aprovacoesNaoVistas: 0,
};
const com = (p: Partial<EntradaDaLeitura>): EntradaDaLeitura => ({ ...base, ...p });

describe('gerarLeituraDoDia', () => {
  it('sem nada a dizer, devolve so a mensagem positiva', () => {
    const l = gerarLeituraDoDia(base);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ chave: 'ok', severidade: 'positivo' });
  });

  it('atrasados: aponta o mais antigo com acao de abrir o card e concorda no singular', () => {
    const l = gerarLeituraDoDia(com({ atrasados: 9, maisAntigoAtrasado: { id: 'c1', titulo: 'Reels', dias: 3 } }));
    expect(l[0]).toMatchObject({ chave: 'atrasados', severidade: 'critico', acao: { rotulo: 'Abrir', cardId: 'c1' } });
    expect(l[0].texto).toContain('9 cards estão atrasados');
    expect(l[0].texto).toContain('“Reels” (3 dias)');
    expect(gerarLeituraDoDia(com({ atrasados: 1 }))[0].texto).toBe('1 card está atrasado.');
  });

  it('no prazo baixo so conta com amostra minima, e cita o periodo anterior', () => {
    expect(gerarLeituraDoDia(com({ noPrazoPct: 4, noPrazo: 2, comPrazo: 5 })).some(x => x.chave === 'no-prazo')).toBe(false);
    const l = gerarLeituraDoDia(com({ noPrazoPct: 4, noPrazo: 2, comPrazo: 57, noPrazoAnteriorPct: 10 }));
    expect(l.find(x => x.chave === 'no-prazo')).toMatchObject({ severidade: 'atencao' });
    expect(l.find(x => x.chave === 'no-prazo')!.texto).toBe('Só 4% das entregas saíram no prazo (2 de 57). No período anterior eram 10%.');
  });

  it('melhora relevante no prazo vira leitura positiva', () => {
    const l = gerarLeituraDoDia(com({ noPrazoPct: 62, noPrazo: 31, comPrazo: 50, noPrazoAnteriorPct: 50 }));
    expect(l.find(x => x.chave === 'no-prazo')).toMatchObject({ severidade: 'positivo' });
    expect(gerarLeituraDoDia(com({ noPrazoPct: 62, noPrazo: 31, comPrazo: 50, noPrazoAnteriorPct: 60 })).some(x => x.chave === 'no-prazo')).toBe(false);
  });

  it('carga: lista ate 3 pessoas e resume o resto, com link para a coordenacao', () => {
    const l = gerarLeituraDoDia(com({ cargaAcimaDoLimite: [{ nome: 'Rhunner', abertos: 9 }, { nome: 'Ana', abertos: 9 }, { nome: 'Matheus', abertos: 14 }, { nome: 'Lucas', abertos: 10 }] }));
    const carga = l.find(x => x.chave === 'carga')!;
    expect(carga.texto).toContain('Rhunner (9), Ana (9), Matheus (14) e mais 1 estão acima do limite de 8');
    expect(carga.acao).toEqual({ rotulo: 'Ver carga', to: '/coordination' });
  });

  it('parados so aparece a partir de 3 cards', () => {
    expect(gerarLeituraDoDia(com({ parados14d: 2 })).some(x => x.chave === 'parados')).toBe(false);
    expect(gerarLeituraDoDia(com({ parados14d: 3 })).some(x => x.chave === 'parados')).toBe(true);
  });

  it('volume: crescimento de 20% ou mais, com a porcentagem arredondada', () => {
    const l = gerarLeituraDoDia(com({ entregas30: 57, entregas30Anterior: 38 }));
    expect(l.find(x => x.chave === 'volume')!.texto).toBe('Bom ritmo: 57 entregas em 30 dias, 50% a mais que no período anterior.');
    expect(gerarLeituraDoDia(com({ entregas30: 40, entregas30Anterior: 38 })).some(x => x.chave === 'volume')).toBe(false);
  });

  it('ordena do mais grave ao mais leve e limita a 4', () => {
    const l = gerarLeituraDoDia(
      com({ atrasados: 2, foraDoSla: 1, aprovacoesNaoVistas: 2, parados14d: 5, entregas30: 60, entregas30Anterior: 30, noPrazoPct: 10, noPrazo: 1, comPrazo: 10, cargaAcimaDoLimite: [{ nome: 'A', abertos: 9 }] }),
    );
    expect(l).toHaveLength(4);
    expect(l[0].severidade).toBe('critico');
    const ordem = l.map(x => ({ critico: 0, atencao: 1, info: 2, positivo: 3 })[x.severidade]);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
  });
});
