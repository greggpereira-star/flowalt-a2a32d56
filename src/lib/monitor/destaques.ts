// Destaque "Nova": cada demanda tem o SEU cronometro. Antes havia um unico cronometro dentro de um efeito do React, e qualquer
// recalculo do painel (outra demanda entrando, uma nova busca, o relogio de 30 s) o cancelava; com duas demandas entrando
// com poucos segundos de diferenca a marca ficava na tela por minutos.

export interface Destaques {
  /** Marca as demandas; marcar de novo uma que ja esta marcada reinicia so o cronometro dela. */
  marcar(ids: string[]): void;
  /** Cancela todos os cronometros (ao sair da tela ou trocar o filtro). */
  limpar(): void;
}

export function criarDestaques(duracaoMs: number, aoMudar: (ids: ReadonlySet<string>) => void): Destaques {
  const ativos = new Map<string, ReturnType<typeof setTimeout>>();
  const emitir = () => aoMudar(new Set(ativos.keys()));

  return {
    marcar(ids) {
      if (ids.length === 0) return;
      for (const id of ids) {
        const anterior = ativos.get(id);
        if (anterior) clearTimeout(anterior);
        ativos.set(
          id,
          setTimeout(() => {
            ativos.delete(id);
            emitir();
          }, duracaoMs),
        );
      }
      emitir();
    },
    limpar() {
      ativos.forEach(clearTimeout);
      ativos.clear();
    },
  };
}
