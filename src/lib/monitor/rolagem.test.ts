import { describe, expect, it } from 'vitest';
import { contarEscondidos, proximaPagina } from './rolagem';

describe('proximaPagina', () => {
  it('nao rola quando tudo cabe', () => {
    expect(proximaPagina(0, 600, 600)).toBeNull();
    expect(proximaPagina(0, 600, 601)).toBeNull(); // folga de 1 px nao conta
  });

  it('avanca uma pagina menos a sobreposicao', () => {
    expect(proximaPagina(0, 600, 1500, 56)).toBe(544);
  });

  it('nao passa do fim: a ultima pagina encosta no final', () => {
    expect(proximaPagina(100, 600, 1000, 56)).toBe(400); // passo de 544, mas o maximo e 400
  });

  it('no fim volta ao inicio', () => {
    expect(proximaPagina(400, 600, 1000)).toBe(0);
    expect(proximaPagina(399, 600, 1000)).toBe(0); // dentro da tolerancia de 2 px
  });

  it('com altura pequena nunca avanca menos que metade da tela', () => {
    expect(proximaPagina(0, 80, 400, 56)).toBe(40);
  });

  it('percorre a lista inteira e fecha o ciclo', () => {
    const posicoes: number[] = [];
    let atual = 0;
    for (let i = 0; i < 10; i++) {
      const prox = proximaPagina(atual, 300, 1000);
      if (prox === null) break;
      posicoes.push(prox);
      atual = prox;
      if (prox === 0) break;
    }
    expect(posicoes[posicoes.length - 1]).toBe(0);
    expect(posicoes).toContain(700); // chegou ao fim (1000 - 300) antes de voltar
  });
});

describe('contarEscondidos', () => {
  const faixas = [
    { top: 0, bottom: 140 },
    { top: 152, bottom: 292 },
    { top: 304, bottom: 444 },
    { top: 456, bottom: 596 },
    { top: 608, bottom: 748 },
  ];

  it('no topo, conta as que nao estao inteiras la embaixo', () => {
    expect(contarEscondidos(faixas, 0, 450)).toEqual({ acima: 0, abaixo: 2 }); // a 4a (596) e a 5a (748) passam de 450
  });

  it('uma demanda cortada ao meio conta como escondida', () => {
    expect(contarEscondidos(faixas, 0, 300)).toEqual({ acima: 0, abaixo: 3 });
  });

  it('rolada para o meio, conta acima e abaixo', () => {
    expect(contarEscondidos(faixas, 300, 740)).toEqual({ acima: 2, abaixo: 1 });
  });

  it('no fim da lista nao ha nada abaixo', () => {
    expect(contarEscondidos(faixas, 400, 748)).toEqual({ acima: 3, abaixo: 0 });
  });

  it('lista que cabe inteira nao esconde nada', () => {
    expect(contarEscondidos(faixas, 0, 760)).toEqual({ acima: 0, abaixo: 0 });
  });

  it('respeita a tolerancia de arredondamento', () => {
    expect(contarEscondidos([{ top: 0, bottom: 302 }], 0, 300, 4)).toEqual({ acima: 0, abaixo: 0 });
  });
});
