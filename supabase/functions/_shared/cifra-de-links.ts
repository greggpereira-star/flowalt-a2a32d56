// Cifra dos links guardados no banco (approval_requests.token_enc e client_portal_access.token_enc).
//
// Por que existe: o link de aprovacao e o do portal so existem em claro no navegador de quem os gerou; no banco ha apenas o hash.
// Para reenviar o MESMO link por e-mail (lembretes e aviso do portal), uma copia fica cifrada (AES-GCM). Antes, a chave era derivada
// da chave de servico do Supabase, o que amarrava as duas coisas: rotacionar a chave de servico deixaria todos os links guardados
// ilegiveis (e derrubaria os links de portal que os clientes ja receberam). Agora a chave vem de um segredo PROPRIO do app
// (APP_TOKEN_SECRET); a chave de servico fica so como "legado", para ler o que foi gravado antes e que ainda nao foi recifrado.
//
// Formato inalterado (compativel com o que ja esta no banco): base64( iv de 12 bytes + AES-GCM ), chave = HKDF-SHA-256 do segredo
// com o rotulo "flowalt-approval-token-v1".
//
// Modulo puro (so WebCrypto, sem Deno nem Supabase): quem chama passa os segredos. Testado em src/lib/links.

const ROTULO = new TextEncoder().encode('flowalt-approval-token-v1');

async function chaveDoSegredo(segredo: string, uso: KeyUsage): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: ROTULO },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    [uso],
  );
}

export interface Segredos {
  /** Segredo proprio do app (APP_TOKEN_SECRET). Se existir, e ele que cifra. */
  atual?: string | null;
  /** Chave de servico antiga: so para LER links gravados antes da separacao. */
  legado?: string | null;
}

export interface CifraDeLinks {
  /** Devolve o link cifrado, ou null se nao ha segredo ou algo falhou. */
  cifrar(token: string): Promise<string | null>;
  /** Devolve o link em claro, ou null se o valor e invalido ou nenhum segredo o abre. */
  decifrar(valor: string): Promise<string | null>;
}

export function criarCifra({ atual, legado }: Segredos): CifraDeLinks {
  const paraCifrar = atual || legado || null;
  const paraLer = [atual, legado].filter((s): s is string => !!s);

  return {
    async cifrar(token) {
      if (!paraCifrar) return null;
      try {
        const chave = await chaveDoSegredo(paraCifrar, 'encrypt');
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(token)));
        const junto = new Uint8Array(iv.length + cifrado.length);
        junto.set(iv);
        junto.set(cifrado, iv.length);
        let bin = '';
        junto.forEach(b => (bin += String.fromCharCode(b)));
        return btoa(bin);
      } catch (e) {
        console.error('cifrar falhou', e);
        return null;
      }
    },

    async decifrar(valor) {
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(valor), c => c.charCodeAt(0));
      } catch {
        return null;
      }
      if (bytes.length <= 12) return null;
      for (const segredo of paraLer) {
        try {
          const chave = await chaveDoSegredo(segredo, 'decrypt');
          const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, chave, bytes.slice(12));
          return new TextDecoder().decode(plano);
        } catch {
          /* este segredo nao abre: tenta o proximo */
        }
      }
      return null;
    },
  };
}
