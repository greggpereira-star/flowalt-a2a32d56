import { describe, expect, it } from 'vitest';
import { estadoDaConexao, LIMITE_SEM_ATUALIZAR_MS } from './conexao';

const ULTIMA = Date.UTC(2026, 9, 22, 23, 16); // 20:16 em Sao Paulo
const base = { online: true, erro: false, ultimaAtualizacaoMs: ULTIMA, agoraMs: ULTIMA + 60_000 };

describe('estadoDaConexao', () => {
  it('ao vivo quando atualizou ha pouco', () => {
    expect(estadoDaConexao(base)).toMatchObject({ ok: true, rotulo: 'Ao vivo' });
  });

  it('diz DESDE QUANDO esta sem atualizar, em vez de so "sem atualizar"', () => {
    const e = estadoDaConexao({ ...base, agoraMs: ULTIMA + LIMITE_SEM_ATUALIZAR_MS + 1 });
    expect(e.ok).toBe(false);
    expect(e.rotulo).toBe('Sem atualizar desde 20:16');
  });

  it('no limite exato ainda esta ao vivo', () => {
    expect(estadoDaConexao({ ...base, agoraMs: ULTIMA + LIMITE_SEM_ATUALIZAR_MS }).ok).toBe(true);
  });

  it('sem internet vence qualquer outro estado', () => {
    expect(estadoDaConexao({ ...base, online: false, erro: true }).rotulo).toBe('Sem internet');
  });

  it('erro de busca mostra a hora do ultimo dado bom', () => {
    expect(estadoDaConexao({ ...base, erro: true }).rotulo).toBe('Erro desde 20:16');
  });

  it('antes da primeira carga nao acusa falha', () => {
    expect(estadoDaConexao({ ...base, ultimaAtualizacaoMs: 0 })).toMatchObject({ ok: true, rotulo: 'Carregando' });
  });
});
