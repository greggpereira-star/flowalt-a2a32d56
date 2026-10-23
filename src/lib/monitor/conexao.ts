// Estado da conexao do monitor, em palavras que quem esta longe da tela entende. Funcao pura, testada.

export interface EntradaDeConexao {
  online: boolean;
  erro: boolean;
  /** Quando os dados foram atualizados pela ultima vez (ms); 0 = ainda nao carregou. */
  ultimaAtualizacaoMs: number;
  agoraMs: number;
  /** Depois de quanto tempo sem atualizar o painel deixa de se dizer "ao vivo". */
  limiteMs?: number;
}

export interface EstadoDeConexao {
  ok: boolean;
  rotulo: string;
  detalhe: string;
}

export const LIMITE_SEM_ATUALIZAR_MS = 3 * 60_000;

const horaDeSaoPaulo = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

export function estadoDaConexao(e: EntradaDeConexao): EstadoDeConexao {
  const limite = e.limiteMs ?? LIMITE_SEM_ATUALIZAR_MS;
  if (!e.online) {
    return { ok: false, rotulo: 'Sem internet', detalhe: 'O computador está sem internet: o que aparece na tela pode estar desatualizado.' };
  }
  if (e.ultimaAtualizacaoMs === 0) {
    return { ok: true, rotulo: 'Carregando', detalhe: 'Buscando as demandas.' };
  }
  const desde = horaDeSaoPaulo(e.ultimaAtualizacaoMs);
  if (e.erro) {
    return { ok: false, rotulo: `Erro desde ${desde}`, detalhe: 'Não foi possível atualizar. Tentando de novo a cada minuto.' };
  }
  if (e.agoraMs - e.ultimaAtualizacaoMs > limite) {
    return { ok: false, rotulo: `Sem atualizar desde ${desde}`, detalhe: 'Os dados não chegam há alguns minutos. Confira a internet ou recarregue a página.' };
  }
  return { ok: true, rotulo: 'Ao vivo', detalhe: 'Atualiza sozinho quando alguém cria ou move uma demanda.' };
}
