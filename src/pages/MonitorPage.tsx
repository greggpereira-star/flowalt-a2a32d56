import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronsDown, Loader2, Maximize, Minimize, Rows3, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CardDetailSheet } from '@/components/cards/CardDetailSheet';
import { ColunaDoMonitor } from '@/components/monitor/ColunaDoMonitor';
import { useAuth } from '@/contexts/AuthContext';
import { useCards, type Card } from '@/hooks/useCards';
import { useCardStatusTransition } from '@/hooks/useCardStatusTransition';
import { useCardMemberAssignments } from '@/hooks/useCardMemberAssignments';
import { useClientCards } from '@/hooks/useClientCards';
import { useRealtimeCards } from '@/hooks/useRealtimeCards';
import { useSpace } from '@/hooks/useSpaces';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { criarDestaques, type Destaques } from '@/lib/monitor/destaques';
import { montarPainelDoDia, prazoDe, proximaAcao, responsaveisDoCard, type CardDoMonitor } from '@/lib/monitor/demandasDoDia';
import { cn } from '@/lib/utils';

const BUSCA_DE_SEGURANCA_MS = 60_000;
// Colunas: >= 1280 px dividem a tela; abaixo disso cada uma ocupa quase toda a largura e a seguinte aparece de relance.
const LARGURA_DA_COLUNA = 'w-[82vw] min-w-[300px] max-w-[460px] shrink-0 xl:w-auto xl:min-w-0 xl:max-w-none xl:flex-1';
const SEM_ATUALIZAR_MS = 3 * 60_000;
const DESTAQUE_DA_NOVA_MS = 10_000;
const CONFIRMACAO_MS = 4_000;

const URGENCIA: Record<string, { rotulo: string; classe: string }> = {
  critical: { rotulo: 'Crítica', classe: 'bg-red-500/20 text-red-300 ring-red-500/40' },
  high: { rotulo: 'Alta', classe: 'bg-orange-500/20 text-orange-300 ring-orange-500/40' },
  medium: { rotulo: 'Média', classe: 'bg-sky-500/15 text-sky-300 ring-sky-500/30' },
  low: { rotulo: 'Baixa', classe: 'bg-slate-500/20 text-slate-300 ring-slate-500/30' },
};

const guardado = (chave: string, padrao: boolean): boolean => {
  try {
    const v = localStorage.getItem(chave);
    return v === null ? padrao : v === '1';
  } catch {
    return padrao;
  }
};
const guardar = (chave: string, valor: boolean) => {
  try {
    localStorage.setItem(chave, valor ? '1' : '0');
  } catch {
    /* sem armazenamento: a escolha vale so ate fechar a tela */
  }
};

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const diaMes = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

/** Dois toques curtos, sem arquivo de audio. Navegadores so liberam som depois de um clique na pagina. */
function tocarAviso() {
  try {
    const Contexto = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Contexto();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const inicio = ctx.currentTime + i * 0.18;
      ganho.gain.setValueAtTime(0.0001, inicio);
      ganho.gain.exponentialRampToValueAtTime(0.25, inicio + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.16);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.18);
    });
    setTimeout(() => ctx.close().catch(() => undefined), 800);
  } catch {
    /* sem audio disponivel */
  }
}

interface Responsavel {
  nome: string;
  avatar: string | null;
}

export default function MonitorPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: space } = useSpace(spaceId);
  const cardsQuery = useCards(spaceId);
  const { data: membros } = useWorkspaceMembers();
  const { data: clientes } = useClientCards();
  // includeInactive: sem isso o hook esconde os vinculos de cards entregues e a conta de "feitas hoje" perde os responsaveis.
  const { data: vinculosBrutos } = useCardMemberAssignments({ includeInactive: true });

  // Esta tela fica fora do layout do app (que e quem normalmente abre os canais), entao abre o canal das demandas aqui.
  useRealtimeCards();

  const [agora, setAgora] = useState(() => new Date());
  const [apenasMinhas, setApenasMinhas] = useState(() => guardado('monitor-minhas', false));
  const [somLigado, setSomLigado] = useState(() => guardado('monitor-som', false));
  const [telaCheia, setTelaCheia] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [cardAberto, setCardAberto] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [movendo, setMovendo] = useState<string | null>(null);
  const [novas, setNovas] = useState<ReadonlySet<string>>(new Set());
  const [compacto, setCompacto] = useState(() => guardado('monitor-compacto', false));
  const [rotacao, setRotacao] = useState(() => guardado('monitor-rolagem', true));

  const { tentarTransicao, aviso } = useCardStatusTransition({ aoAbrirCard: (c: Card) => setCardAberto(c.id) });

  // Relogio e virada do dia: recalcula o painel a cada 30 s, entao a meia-noite o quadro troca sozinho.
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const ligar = () => setOnline(true);
    const desligar = () => setOnline(false);
    window.addEventListener('online', ligar);
    window.addEventListener('offline', desligar);
    return () => {
      window.removeEventListener('online', ligar);
      window.removeEventListener('offline', desligar);
    };
  }, []);

  // Rede de seguranca alem do tempo real: um monitor fica ligado por horas e nao pode depender de uma conexao so.
  useEffect(() => {
    if (!spaceId) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') queryClient.invalidateQueries({ queryKey: ['cards', 'space', spaceId] });
    }, BUSCA_DE_SEGURANCA_MS);
    return () => clearInterval(t);
  }, [queryClient, spaceId]);

  // Tela cheia e tela sempre acesa
  useEffect(() => {
    const aoMudar = () => setTelaCheia(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', aoMudar);
    return () => document.removeEventListener('fullscreenchange', aoMudar);
  }, []);

  useEffect(() => {
    let trava: { release?: () => Promise<void> } | null = null;
    const pedir = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') trava = await (navigator as any).wakeLock.request('screen');
      } catch {
        /* sem permissao: o monitor ainda funciona, so pode apagar a tela */
      }
    };
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void pedir();
    };
    void pedir();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      void trava?.release?.().catch(() => undefined);
    };
  }, []);

  const alternarTelaCheia = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast.error('O navegador não liberou a tela cheia. Use F11.');
    }
  }, []);

  const vinculos = useMemo(() => {
    const mapa = new Map<string, string[]>();
    (vinculosBrutos ?? []).forEach(({ card_id, user_id }) => {
      if (!mapa.has(card_id)) mapa.set(card_id, []);
      mapa.get(card_id)!.push(user_id);
    });
    return mapa;
  }, [vinculosBrutos]);

  const cards = (cardsQuery.data ?? []) as Card[];
  const painel = useMemo(
    () => montarPainelDoDia<Card & CardDoMonitor>(cards as (Card & CardDoMonitor)[], agora, apenasMinhas && user?.id ? { usuario: user.id, vinculos } : null),
    [cards, agora, apenasMinhas, user?.id, vinculos],
  );

  // Demanda que entra no painel enquanto a tela esta aberta ganha destaque por 10 s (e som, se ligado). A primeira carga nao conta.
  // Cada demanda tem o seu proprio cronometro (criarDestaques): um cronometro unico preso a um efeito era cancelado a cada
  // recalculo do painel, e a marca "Nova" ficava na tela por minutos quando entravam duas demandas seguidas.
  const destaquesRef = useRef<Destaques | null>(null);
  if (!destaquesRef.current) destaquesRef.current = criarDestaques(DESTAQUE_DA_NOVA_MS, setNovas);
  useEffect(() => () => destaquesRef.current?.limpar(), []);
  const somLigadoRef = useRef(somLigado);
  somLigadoRef.current = somLigado;

  const vistas = useRef<Set<string> | null>(null);
  useEffect(() => {
    vistas.current = null;
    destaquesRef.current?.limpar();
    setNovas(new Set());
  }, [apenasMinhas, spaceId]);
  useEffect(() => {
    if (!cardsQuery.isSuccess) return;
    const ids = painel.colunas.flatMap(c => c.itens.map(i => i.id));
    if (vistas.current === null) {
      vistas.current = new Set(ids);
      return;
    }
    const chegaram = ids.filter(id => !vistas.current!.has(id));
    ids.forEach(id => vistas.current!.add(id));
    if (chegaram.length === 0) return;
    destaquesRef.current!.marcar(chegaram);
    if (somLigadoRef.current) tocarAviso();
  }, [painel, cardsQuery.isSuccess]);

  const responsavelPorId = useMemo(() => {
    const mapa = new Map<string, Responsavel>();
    (membros ?? []).forEach(m => mapa.set(m.user_id, { nome: m.profile?.full_name || m.profile?.email || 'Sem nome', avatar: m.profile?.avatar_url ?? null }));
    return mapa;
  }, [membros]);

  const clientePorId = useMemo(() => {
    const mapa = new Map<string, string>();
    (clientes ?? []).forEach(c => mapa.set(c.id, c.name));
    return mapa;
  }, [clientes]);

  // Avanca UMA etapa, com as mesmas regras do quadro (o fluxo bloqueia pular etapas). Dois toques: o primeiro pede confirmacao,
  // para um toque sem querer num monitor nao mover a demanda. Se o fluxo exigir algo, o aviso de bloqueio abre por cima.
  const avancar = async (card: Card) => {
    const acao = proximaAcao(card.status);
    if (!acao || movendo) return;
    if (confirmando !== card.id) {
      setConfirmando(card.id);
      setTimeout(() => setConfirmando(atual => (atual === card.id ? null : atual)), CONFIRMACAO_MS);
      return;
    }
    setConfirmando(null);
    setMovendo(card.id);
    try {
      await tentarTransicao(card, acao.para as Card['status']);
    } catch {
      toast.error('Não foi possível mover a demanda. Tente de novo.');
    } finally {
      setMovendo(null);
    }
  };

  const semAtualizar = Date.now() - cardsQuery.dataUpdatedAt > SEM_ATUALIZAR_MS;
  const ao_vivo = online && !semAtualizar && !cardsQuery.isError;
  const dataPorExtenso = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="dark flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-50">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-white/10 px-6 py-4">
        <Link
          to={spaceId ? `/space/${spaceId}` : '/'}
          className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Voltar ao quadro do espaço"
        >
          <ArrowLeft className="h-4 w-4" /> Quadro
        </Link>

        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">Demandas do dia{space?.name ? ` · ${space.name}` : ''}</h1>
          <p className="text-sm text-slate-400 first-letter:uppercase">
            {dataPorExtenso}
            <span className="xl:hidden"> · deslize para o lado para ver todas as etapas</span>
          </p>
        </div>

        <dl className="ml-auto flex items-center gap-6 text-center" aria-label="Resumo do dia">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Pendentes</dt>
            <dd className="text-3xl font-bold tabular-nums">{painel.contagem.pendentes}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Atrasadas</dt>
            <dd className={cn('text-3xl font-bold tabular-nums', painel.contagem.atrasadas > 0 ? 'text-red-400' : 'text-slate-200')}>{painel.contagem.atrasadas}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Feitas hoje</dt>
            <dd className="text-3xl font-bold tabular-nums text-emerald-400">{painel.contagem.feitasHoje}</dd>
          </div>
          <div className="border-l border-white/10 pl-6">
            <dt className="sr-only">Hora</dt>
            <dd className="text-4xl font-bold tabular-nums">{agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}</dd>
          </div>
        </dl>

        <div className="flex items-center gap-2">
          <span
            className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold', ao_vivo ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300')}
            role="status"
          >
            {ao_vivo ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {ao_vivo ? 'Ao vivo' : online ? 'Sem atualizar' : 'Sem conexão'}
          </span>
          <button
            type="button"
            onClick={() => {
              setApenasMinhas(v => {
                guardar('monitor-minhas', !v);
                return !v;
              });
            }}
            aria-pressed={apenasMinhas}
            className={cn('rounded-lg px-3 py-2 text-sm font-medium ring-1 transition-colors', apenasMinhas ? 'bg-white text-slate-900 ring-white' : 'text-slate-300 ring-white/20 hover:bg-white/10')}
          >
            Só as minhas
          </button>
          <button
            type="button"
            onClick={() => {
              setCompacto(v => {
                guardar('monitor-compacto', !v);
                return !v;
              });
            }}
            aria-pressed={compacto}
            aria-label="Cartões compactos"
            title="Cartões compactos: cabem mais demandas na tela"
            className={cn('rounded-lg p-2.5 ring-1 transition-colors', compacto ? 'bg-white text-slate-900 ring-white' : 'text-slate-300 ring-white/20 hover:bg-white/10')}
          >
            <Rows3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setRotacao(v => {
                guardar('monitor-rolagem', !v);
                return !v;
              });
            }}
            aria-pressed={rotacao}
            aria-label="Rolagem automática das colunas"
            title={rotacao ? 'Rolagem automática ligada: as colunas passam de página sozinhas' : 'Rolagem automática desligada'}
            className={cn('rounded-lg p-2.5 ring-1 transition-colors', rotacao ? 'bg-white text-slate-900 ring-white' : 'text-slate-300 ring-white/20 hover:bg-white/10')}
          >
            <ChevronsDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSomLigado(v => {
                guardar('monitor-som', !v);
                if (!v) tocarAviso();
                return !v;
              });
            }}
            aria-pressed={somLigado}
            aria-label={somLigado ? 'Desligar o aviso sonoro' : 'Ligar o aviso sonoro'}
            title={somLigado ? 'Aviso sonoro ligado' : 'Aviso sonoro desligado'}
            className="rounded-lg p-2.5 text-slate-300 ring-1 ring-white/20 hover:bg-white/10"
          >
            {somLigado ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={alternarTelaCheia}
            aria-label={telaCheia ? 'Sair da tela cheia' : 'Entrar em tela cheia'}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {telaCheia ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            {telaCheia ? 'Sair' : 'Tela cheia'}
          </button>
        </div>
      </header>

      {/* Largura >= 1280 px: as quatro colunas dividem a tela. Abaixo disso: trilho horizontal com encaixe (cada coluna ocupa
          quase toda a largura e a seguinte aparece de relance), em vez de empilhar e jogar as etapas finais para baixo da dobra. */}
      <main className="flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden p-4 [scrollbar-color:theme(colors.slate.600)_transparent] [scrollbar-width:thin] xl:snap-none xl:overflow-x-hidden">
        {cardsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={cn('min-h-[16rem] rounded-2xl bg-white/5', LARGURA_DA_COLUNA)} />
          ))
        ) : cardsQuery.isError ? (
          <p className="m-auto text-lg text-amber-300">Não foi possível carregar as demandas. Tentando de novo em instantes.</p>
        ) : painel.contagem.pendentes === 0 ? (
          <div className="m-auto text-center">
            <p className="text-3xl font-bold">Tudo em dia</p>
            <p className="mt-2 text-lg text-slate-400">Nenhuma demanda pendente para hoje{apenasMinhas ? ' com você como responsável' : ''}.</p>
          </div>
        ) : (
          painel.colunas.map(col => (
            <ColunaDoMonitor key={col.chave} rotulo={col.rotulo} total={col.itens.length} rotacaoAtiva={rotacao && !cardAberto} className={cn('snap-start', LARGURA_DA_COLUNA)}>
              {col.itens.length === 0 && <li className="px-1 py-6 text-center text-sm text-slate-400">Nada aqui</li>}
              {col.itens.map(card => {
                const prazo = prazoDe(card, agora);
                const responsaveis = responsaveisDoCard(card, vinculos)
                  .map(id => responsavelPorId.get(id))
                  .filter((r): r is Responsavel => !!r);
                const cliente = card.client_id ? clientePorId.get(card.client_id) : undefined;
                const urg = URGENCIA[card.urgency ?? ''];
                const confirmar = confirmando === card.id;
                const acao = proximaAcao(card.status);
                const nova = novas.has(card.id);
                return (
                  <li
                    key={card.id}
                    data-demanda
                    className={cn(
                      'shrink-0 rounded-xl border-l-4 bg-slate-900 shadow-lg ring-1 ring-white/10',
                      compacto ? 'p-3' : 'p-4',
                      prazo === 'atrasada' ? 'border-l-red-500' : prazo === 'hoje' ? 'border-l-amber-400' : 'border-l-slate-600',
                      nova && 'ring-2 ring-emerald-400',
                    )}
                  >
                    {nova && <p className="mb-1 text-xs font-bold uppercase tracking-wide text-emerald-300 motion-safe:animate-pulse">Nova</p>}
                    <button type="button" onClick={() => setCardAberto(card.id)} className="block w-full text-left">
                      <span className={cn('font-semibold leading-snug', compacto ? 'line-clamp-2 text-base' : 'line-clamp-3 text-xl')}>{card.title}</span>
                    </button>
                    {cliente && <p className={cn('truncate text-slate-400', compacto ? 'text-xs' : 'mt-1 text-sm')}>{cliente}</p>}

                    <div className={cn('flex flex-wrap items-center gap-2 text-sm', compacto ? 'mt-2' : 'mt-3')}>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold',
                          prazo === 'atrasada' ? 'bg-red-500/20 text-red-300' : prazo === 'hoje' ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-slate-300',
                        )}
                      >
                        {prazo === 'atrasada' && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
                        {prazo === 'atrasada' && card.due_date
                          ? `Atrasada há ${formatDistanceToNowStrict(new Date(card.due_date), { locale: ptBR })}`
                          : prazo === 'hoje' && card.due_date
                            ? `Hoje às ${hora(card.due_date)}`
                            : prazo === 'futuro' && card.due_date
                              ? `Prazo ${diaMes(card.due_date)}`
                              : 'Sem prazo'}
                      </span>
                      {urg && <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold ring-1', urg.classe)}>{urg.rotulo}</span>}
                    </div>

                    <div className={cn('flex items-center justify-between gap-2', compacto ? 'mt-2' : 'mt-3')}>
                      <div className="flex min-w-0 items-center gap-2">
                        {responsaveis.length > 0 ? (
                          <>
                            <div className="flex -space-x-2">
                              {responsaveis.slice(0, 3).map((r, idx) => (
                                <Avatar key={idx} className={cn('ring-2 ring-slate-900', compacto ? 'h-6 w-6' : 'h-7 w-7')}>
                                  {r.avatar && <AvatarImage src={r.avatar} alt="" />}
                                  <AvatarFallback className="bg-slate-700 text-xs">{r.nome.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                              ))}
                            </div>
                            <span className="truncate text-sm text-slate-300">
                              {responsaveis.slice(0, 2).map(r => r.nome.split(' ')[0]).join(', ')}
                              {responsaveis.length > 2 ? ` +${responsaveis.length - 2}` : ''}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-slate-400">Sem responsável</span>
                        )}
                      </div>
                      {acao && (
                        <button
                          type="button"
                          onClick={() => avancar(card)}
                          disabled={!!movendo}
                          aria-label={confirmar ? `Confirmar: ${acao.rotulo} — ${card.title}` : `${acao.rotulo}: ${card.title}`}
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60',
                            confirmar ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400' : 'bg-white/10 text-slate-100 hover:bg-white/20',
                          )}
                        >
                          {movendo === card.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : acao.para === 'delivered' ? (
                            <Check className="h-4 w-4" aria-hidden />
                          ) : (
                            <ArrowRight className="h-4 w-4" aria-hidden />
                          )}
                          {movendo === card.id ? 'Movendo…' : confirmar ? 'Confirmar?' : acao.rotulo}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ColunaDoMonitor>
          ))
        )}
      </main>

      {aviso}
      <CardDetailSheet cardId={cardAberto || undefined} open={!!cardAberto} onOpenChange={aberto => !aberto && setCardAberto(null)} />
    </div>
  );
}
