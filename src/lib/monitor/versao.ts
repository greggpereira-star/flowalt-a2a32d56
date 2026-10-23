// Versao da aplicacao em uso x versao publicada. Um monitor fica aberto por dias; sem isso ele nunca recebe uma correcao.
// O build do Vite nomeia o arquivo principal com um hash (assets/index-<hash>.js): se o hash do index.html publicado mudou,
// ha versao nova. Funcoes puras, testadas.

const PADRAO = /\/assets\/index-[A-Za-z0-9_-]+\.js/;

/** Arquivo principal citado num index.html (ex.: "/assets/index-BzXHcT-g.js"), ou null. */
export function arquivoPrincipalDeHtml(html: string): string | null {
  return html.match(PADRAO)?.[0] ?? null;
}

/** Arquivo principal da pagina que esta rodando, lido do proprio <script type="module">. */
export function arquivoPrincipalCarregado(doc: Pick<Document, 'querySelector'>): string | null {
  const script = doc.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  if (!script?.src) return null;
  try {
    const caminho = new URL(script.src, 'https://exemplo.invalido').pathname;
    return PADRAO.test(caminho) ? caminho : null;
  } catch {
    return null;
  }
}

/** So ha versao nova quando os dois lados sao conhecidos e diferentes (na duvida, nao recarrega). */
export function temVersaoNova(atual: string | null, publicada: string | null): boolean {
  return !!atual && !!publicada && atual !== publicada;
}
