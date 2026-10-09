import { describe, expect, it } from 'vitest';
import { LIMITE_ARQUIVO_BYTES, caminhoDoArquivo, formatarTamanho, nomeSeguro, tipoDoArquivo, validarArquivo } from './arquivos';

describe('nomeSeguro', () => {
  it('tira acentos, espaços e símbolos, mantendo a extensão', () => {
    expect(nomeSeguro('Manual da Marca – versão final (2).PDF')).toBe('Manual-da-Marca-versao-final-2.pdf');
  });

  it('não deixa passar ../ nem barras', () => {
    const n = nomeSeguro('../../etc/passwd');
    expect(n).not.toContain('/');
    expect(n).not.toContain('..');
  });

  it('cai em "arquivo" quando não sobra nada', () => {
    expect(nomeSeguro('###')).toBe('arquivo');
    expect(nomeSeguro('.png')).toBe('png');
  });

  it('limita o tamanho do nome', () => {
    const n = nomeSeguro(`${'a'.repeat(300)}.png`);
    expect(n.length).toBeLessThanOrEqual(91);
    expect(n.endsWith('.png')).toBe(true);
  });
});

describe('caminhoDoArquivo', () => {
  it('segue o padrão workspace/cliente/pasta/uuid-nome', () => {
    expect(caminhoDoArquivo('w', 'c', 'f', 'Logo Azul.png', 'u1')).toBe('w/c/f/u1-Logo-Azul.png');
  });
});

describe('validarArquivo', () => {
  it('aceita arquivo normal', () => {
    expect(validarArquivo({ name: 'logo.png', size: 1000 })).toBeNull();
  });
  it('recusa vazio, grande e executável', () => {
    expect(validarArquivo({ name: 'a.png', size: 0 })).toMatch(/vazio/);
    expect(validarArquivo({ name: 'a.png', size: LIMITE_ARQUIVO_BYTES + 1 })).toMatch(/50 MB/);
    expect(validarArquivo({ name: 'instalador.EXE', size: 10 })).toMatch(/não pode ser enviado/);
    expect(validarArquivo({ name: 'script.js', size: 10 })).toMatch(/não pode ser enviado/);
  });
  it('aceita exatamente 50 MB', () => {
    expect(validarArquivo({ name: 'a.mp4', size: LIMITE_ARQUIVO_BYTES })).toBeNull();
  });
});

describe('formatarTamanho', () => {
  it('formata em B, KB e MB', () => {
    expect(formatarTamanho(900)).toBe('900 B');
    expect(formatarTamanho(2048)).toBe('2 KB');
    expect(formatarTamanho(5 * 1024 * 1024)).toBe('5,0 MB');
    expect(formatarTamanho(25 * 1024 * 1024)).toBe('25 MB');
  });
});

describe('tipoDoArquivo', () => {
  it('reconhece pelo mime ou pela extensão', () => {
    expect(tipoDoArquivo('image/png', 'x')).toBe('imagem');
    expect(tipoDoArquivo(null, 'clip.MOV')).toBe('video');
    expect(tipoDoArquivo(null, 'manual.pdf')).toBe('pdf');
    expect(tipoDoArquivo(null, 'preços.xlsx')).toBe('planilha');
    expect(tipoDoArquivo(null, 'briefing.docx')).toBe('documento');
    expect(tipoDoArquivo(null, 'coisa.xyz')).toBe('arquivo');
  });
});
