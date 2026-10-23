import { describe, expect, it } from 'vitest';
import { criarCifra } from '../../../supabase/functions/_shared/cifra-de-links';

const LEGADO = 'chave-de-servico-antiga-de-teste';
const NOVO = 'segredo-proprio-do-app-de-teste';
const TOKEN = 'f-DxZCqlvkwWFUNTLMWnPFf4Z9DZeBAGSyEHNMSABTk';

// Copia fiel da cifra ANTIGA (derivada so da chave de servico), para provar compatibilidade com o que ja esta no banco.
async function cifrarComoAntes(token: string, chaveDeServico: string): Promise<string> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(chaveDeServico), 'HKDF', false, ['deriveKey']);
  const chave = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode('flowalt-approval-token-v1') },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(token)));
  const junto = new Uint8Array(iv.length + cifrado.length);
  junto.set(iv); junto.set(cifrado, iv.length);
  let bin = '';
  junto.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

describe('cifra dos links', () => {
  it('cifra e decifra com o segredo proprio', async () => {
    const c = criarCifra({ atual: NOVO, legado: LEGADO });
    const enc = await c.cifrar(TOKEN);
    expect(enc).toBeTruthy();
    expect(enc).not.toContain(TOKEN);
    expect(await c.decifrar(enc!)).toBe(TOKEN);
  });

  it('LE o que foi gravado antes da separacao (cifra antiga, derivada da chave de servico)', async () => {
    const antigo = await cifrarComoAntes(TOKEN, LEGADO);
    expect(await criarCifra({ atual: NOVO, legado: LEGADO }).decifrar(antigo)).toBe(TOKEN);
  });

  it('o que e cifrado agora usa o segredo proprio: trocar a chave de servico NAO o torna ilegivel', async () => {
    const enc = await criarCifra({ atual: NOVO, legado: LEGADO }).cifrar(TOKEN);
    const depoisDaRotacao = criarCifra({ atual: NOVO, legado: 'chave-de-servico-NOVA-depois-da-rotacao' });
    expect(await depoisDaRotacao.decifrar(enc!)).toBe(TOKEN);
  });

  it('o oposto documenta o risco que a separacao evita: link antigo + chave trocada = ilegivel', async () => {
    const antigo = await cifrarComoAntes(TOKEN, LEGADO);
    const depoisDaRotacao = criarCifra({ atual: NOVO, legado: 'chave-de-servico-NOVA-depois-da-rotacao' });
    expect(await depoisDaRotacao.decifrar(antigo)).toBeNull();
  });

  it('sem segredo proprio, cifra com o legado (nao quebra a funcao se a variavel faltar)', async () => {
    const so = criarCifra({ legado: LEGADO });
    const enc = await so.cifrar(TOKEN);
    expect(await so.decifrar(enc!)).toBe(TOKEN);
  });

  it('sem nenhum segredo, nao cifra nem decifra', async () => {
    const nada = criarCifra({});
    expect(await nada.cifrar(TOKEN)).toBeNull();
    expect(await nada.decifrar('qualquer')).toBeNull();
  });

  it('valor adulterado, truncado ou que nao e base64 devolve null, sem lancar erro', async () => {
    const c = criarCifra({ atual: NOVO, legado: LEGADO });
    const enc = (await c.cifrar(TOKEN))!;
    const bytes = Uint8Array.from(atob(enc), x => x.charCodeAt(0));
    bytes[bytes.length - 1] ^= 1;
    let adulterado = '';
    bytes.forEach(b => (adulterado += String.fromCharCode(b)));
    expect(await c.decifrar(btoa(adulterado))).toBeNull();
    expect(await c.decifrar(enc.slice(0, 10))).toBeNull();
    expect(await c.decifrar('%%%nao-e-base64%%%')).toBeNull();
  });

  it('duas cifras do mesmo link sao diferentes (IV aleatorio) e ambas abrem', async () => {
    const c = criarCifra({ atual: NOVO });
    const a = await c.cifrar(TOKEN);
    const b = await c.cifrar(TOKEN);
    expect(a).not.toBe(b);
    expect(await c.decifrar(a!)).toBe(TOKEN);
    expect(await c.decifrar(b!)).toBe(TOKEN);
  });
});
