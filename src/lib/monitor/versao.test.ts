import { describe, expect, it } from 'vitest';
import { arquivoPrincipalCarregado, arquivoPrincipalDeHtml, temVersaoNova } from './versao';

const HTML = '<html><head><script type="module" crossorigin src="/assets/index-BzXHcT-g.js"></script></head></html>';

describe('arquivoPrincipalDeHtml', () => {
  it('le o arquivo principal do index.html', () => {
    expect(arquivoPrincipalDeHtml(HTML)).toBe('/assets/index-BzXHcT-g.js');
  });
  it('devolve null quando nao ha arquivo principal (ex.: pagina de erro)', () => {
    expect(arquivoPrincipalDeHtml('<html>502 Bad Gateway</html>')).toBeNull();
  });
  it('ignora os chunks de outras rotas', () => {
    expect(arquivoPrincipalDeHtml('<script src="/assets/MonitorPage-aB3.js"></script>')).toBeNull();
  });
});

describe('arquivoPrincipalCarregado', () => {
  const doc = (src: string | null) => ({ querySelector: () => (src === null ? null : ({ src } as HTMLScriptElement)) }) as unknown as Pick<Document, 'querySelector'>;
  it('le o caminho do script em execucao, mesmo com a origem completa', () => {
    expect(arquivoPrincipalCarregado(doc('https://flowalt.com.br/assets/index-BzXHcT-g.js'))).toBe('/assets/index-BzXHcT-g.js');
  });
  it('sem script, devolve null', () => {
    expect(arquivoPrincipalCarregado(doc(null))).toBeNull();
  });
});

describe('temVersaoNova', () => {
  it('hash diferente = versao nova', () => {
    expect(temVersaoNova('/assets/index-AAA.js', '/assets/index-BBB.js')).toBe(true);
  });
  it('mesmo hash = nada a fazer', () => {
    expect(temVersaoNova('/assets/index-AAA.js', '/assets/index-AAA.js')).toBe(false);
  });
  it('na duvida (um lado desconhecido) nao recarrega', () => {
    expect(temVersaoNova(null, '/assets/index-BBB.js')).toBe(false);
    expect(temVersaoNova('/assets/index-AAA.js', null)).toBe(false);
  });
});
