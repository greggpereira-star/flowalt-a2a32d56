/**
 * Registro do service worker e atualização automática de versão.
 *
 * Antes o SW só era registrado quando a pessoa ativava notificações push, e
 * nada verificava se havia versão nova. Quem tinha registrado semanas atrás
 * ficava com aquele SW ativo por tempo indeterminado — e junto com ele o
 * pacote de JavaScript antigo. Na prática o time via correções "não
 * funcionarem" e a única saída era Ctrl+Shift+R, o que ninguém adivinha.
 *
 * Aqui o SW é registrado no boot, a atualização é procurada em momentos que
 * indicam uso real (voltar para a aba, voltar a ter rede) e, quando a versão
 * nova assume, a página recarrega sozinha uma vez.
 */

/** De quanto em quanto tempo perguntar ao servidor se há versão nova. */
const INTERVALO_CHECAGEM_MS = 30 * 60 * 1000;

/**
 * Guarda contra laço de recarga.
 *
 * `controllerchange` também dispara no primeiro registro (quando não havia
 * controller antes). Recarregar nesse caso reiniciaria o app logo na abertura,
 * então o reload só acontece quando já existia um SW controlando a página —
 * isto é, quando de fato houve troca de versão.
 */
let recarregando = false;

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void iniciar();
  });
}

async function iniciar(): Promise<void> {
  try {
    const registro = await navigator.serviceWorker.register('/sw.js');

    const jaControlado = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!jaControlado || recarregando) return;
      recarregando = true;
      window.location.reload();
    });

    // Procura versão nova quando a pessoa volta para a aba: é o momento em que
    // ela vai usar o app, e recarregar aqui interrompe menos que no meio de
    // uma digitação.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registro.update();
    });

    window.addEventListener('online', () => void registro.update());

    setInterval(() => void registro.update(), INTERVALO_CHECAGEM_MS);
  } catch (erro) {
    // Falhar aqui não pode derrubar o app: sem SW ele funciona, só perde
    // offline e push. Registrar no console para não sumir sem rastro.
    console.warn('Não foi possível registrar o service worker:', erro);
  }
}
