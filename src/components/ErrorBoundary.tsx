import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

const CHUNK_ERROR_PATTERN = /dynamically imported module|Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i;

// Uma nova versão publicada no servidor troca os arquivos JS com hash novo;
// uma aba que já estava aberta ainda referencia os hashes antigos. Sem isto,
// a primeira navegação para uma rota ainda não visitada nessa aba (carregada
// via import() dinâmico) falha com um erro não tratado e a tela quebra em
// branco — sem nenhuma mensagem, sem forma de continuar sem fechar a aba.
const isChunkLoadError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return CHUNK_ERROR_PATTERN.test(message);
};

const RELOAD_GUARD_KEY = 'flowalt-chunk-reload-attempted';

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error)) {
      // Só tenta recarregar automaticamente uma vez por sessão de aba: se a
      // versão nova falhar de novo depois do reload, é um bug de verdade —
      // não um deploy — e não faz sentido entrar em loop de reload.
      const alreadyTried = sessionStorage.getItem(RELOAD_GUARD_KEY);
      if (!alreadyTried) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <p className="text-lg font-semibold">Algo deu errado ao carregar esta página</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Isso costuma acontecer logo após uma atualização do sistema. Recarregar a página resolve na maioria dos casos.
          </p>
          <button
            onClick={this.handleReload}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Recarregar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
