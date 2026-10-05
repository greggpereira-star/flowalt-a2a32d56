import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Opções de visual em teste ("beta"), ligadas por pessoa.
 *
 * Só quem está em EMAILS_BETA enxerga e consegue ligar estas opções; para todos os
 * outros o hook devolve sempre "desligado", mesmo que exista algo guardado no navegador.
 * Assim o menu e o Kanban continuam exatamente como eram para o resto da equipe.
 *
 * O estado fica no navegador (localStorage): liga e desliga na hora, sem piscar, e não
 * exige mudança no banco. Vale por navegador, não é sincronizado entre aparelhos.
 */
export const EMAILS_BETA = ['gregg.pereira@gmail.com'];

export interface EstadoBeta {
  menu: boolean;
  respiro: boolean;
  inicio: boolean;
  meutrabalho: boolean;
  agenda: boolean;
  clientes: boolean;
  dashboard: boolean;
  gestao: boolean;
  tempo: boolean;
  ideias: boolean;
  config: boolean;
}

const PADRAO: EstadoBeta = { menu: false, respiro: false, inicio: false, meutrabalho: false, agenda: false, clientes: false, dashboard: false, gestao: false, tempo: false, ideias: false, config: false };
const EVENTO = 'flowalt:ui-beta';
const chave = (userId?: string) => `flowalt_ui_beta_${userId ?? 'anon'}`;

function lerBruto(userId?: string): string {
  try {
    return window.localStorage.getItem(chave(userId)) ?? '';
  } catch {
    return '';
  }
}

function assinar(aviso: () => void) {
  window.addEventListener('storage', aviso);
  window.addEventListener(EVENTO, aviso);
  return () => {
    window.removeEventListener('storage', aviso);
    window.removeEventListener(EVENTO, aviso);
  };
}

export function useNewUiBeta() {
  const { user } = useAuth();
  const podeUsar = !!user?.email && EMAILS_BETA.includes(user.email.toLowerCase());

  const bruto = useSyncExternalStore(
    assinar,
    () => lerBruto(user?.id),
    () => ''
  );

  const estado = useMemo<EstadoBeta>(() => {
    if (!podeUsar || !bruto) return PADRAO;
    try {
      const lido = JSON.parse(bruto) as Partial<EstadoBeta>;
      // Telas que ganharam interruptor próprio depois (Meu trabalho, Agenda, Clientes) herdam o
      // valor da Início enquanto a pessoa não escolher; assim nada some de quem já tinha ligado.
      const heranca = !!lido.inicio;
      return {
        menu: !!lido.menu,
        respiro: !!lido.respiro,
        inicio: !!lido.inicio,
        meutrabalho: lido.meutrabalho ?? heranca,
        agenda: lido.agenda ?? heranca,
        clientes: lido.clientes ?? heranca,
        dashboard: lido.dashboard ?? heranca,
        gestao: lido.gestao ?? heranca,
        tempo: lido.tempo ?? heranca,
        ideias: lido.ideias ?? heranca,
        config: lido.config ?? heranca,
      };
    } catch {
      return PADRAO;
    }
  }, [podeUsar, bruto]);

  const definir = useCallback(
    (parcial: Partial<EstadoBeta>) => {
      if (!podeUsar) return;
      const proximo = { ...estado, ...parcial };
      try {
        window.localStorage.setItem(chave(user?.id), JSON.stringify(proximo));
      } catch {
        /* navegador sem armazenamento: a opção só vale até recarregar */
      }
      window.dispatchEvent(new Event(EVENTO));
    },
    [podeUsar, estado, user?.id]
  );

  return {
    podeUsar,
    menu: estado.menu,
    respiro: estado.respiro,
    inicio: estado.inicio,
    meutrabalho: estado.meutrabalho,
    agenda: estado.agenda,
    clientes: estado.clientes,
    dashboard: estado.dashboard,
    gestao: estado.gestao,
    tempo: estado.tempo,
    ideias: estado.ideias,
    config: estado.config,
    definir,
  };
}
