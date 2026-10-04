import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays, format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Building2, Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useClientCardsByStatus, type ClientCard, type ClientStatus } from '@/hooks/useClientCards';
import { useClientsHealth, type ClientHealth } from '@/hooks/useClientsHealth';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { ehAberto } from '@/lib/coordination/coordMetrics';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Tela Clientes com visual novo (opção beta). Mesmos dados da tela antiga:
 * lista por status (useClientCardsByStatus) e saúde calculada ao vivo (useClientsHealth).
 * A novidade é a carteira em si: por cliente, quantos cards estão abertos, quantos estão
 * atrasados e qual é a próxima entrega, para o gestor saber de quem cuidar primeiro.
 */

interface CardDoCliente {
  id: string;
  client_id: string;
  title: string;
  status: string;
  due_date: string | null;
}

interface Carteira {
  abertos: number;
  atrasados: number;
  proxima: { titulo: string; prazo: Date } | null;
}

type Filtro = 'todos' | 'atraso' | 'atencao' | 'saudavel';
type Ordem = 'atencao' | 'nome' | 'score';

const STATUS: { chave: ClientStatus; rotulo: string }[] = [
  { chave: 'active', rotulo: 'Ativos' },
  { chave: 'paused', rotulo: 'Pausados' },
  { chave: 'closed', rotulo: 'Encerrados' },
];

const ESTADO: Record<string, { rotulo: string; classe: string }> = {
  healthy: { rotulo: 'Saudável', classe: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  attention: { rotulo: 'Atenção', classe: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  critical: { rotulo: 'Crítico', classe: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  loss: { rotulo: 'Prejuízo', classe: 'bg-red-500/15 text-red-700 dark:text-red-400' },
};

const SEM_CARTEIRA: Carteira = { abertos: 0, atrasados: 0, proxima: null };

const corDoScore = (s?: number) =>
  s === undefined ? 'hsl(var(--muted-foreground))' : s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : s >= 40 ? '#f97316' : '#ef4444';

function useCarteira() {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ['clientes-carteira', currentWorkspace?.id],
    enabled: !!currentWorkspace?.id,
    queryFn: async (): Promise<Map<string, Carteira>> => {
      const { data, error } = await supabase
        .from('cards')
        .select('id, client_id, title, status, due_date')
        .eq('workspace_id', currentWorkspace!.id)
        .not('client_id', 'is', null);
      if (error) throw error;

      const mapa = new Map<string, Carteira>();
      for (const c of (data ?? []) as CardDoCliente[]) {
        if (!ehAberto(c)) continue;
        const item = mapa.get(c.client_id) ?? { abertos: 0, atrasados: 0, proxima: null };
        item.abertos += 1;
        if (c.due_date) {
          const prazo = new Date(c.due_date);
          if (isPast(prazo) && !isToday(prazo)) item.atrasados += 1;
          else if (!item.proxima || prazo < item.proxima.prazo) item.proxima = { titulo: c.title, prazo };
        }
        mapa.set(c.client_id, item);
      }
      return mapa;
    },
  });
}

function Saude({ score, estado }: { score?: number; estado: string | null }) {
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold tabular-nums text-muted-foreground"
      title={score === undefined ? 'Saúde ainda não calculada' : `Saúde do cliente: ${score}${estado ? ` · ${estado}` : ''}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: corDoScore(score) }} />
      {score ?? '—'}
    </div>
  );
}

function rotuloPrazo(prazo: Date) {
  const dias = differenceInCalendarDays(prazo, new Date());
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return format(prazo, "dd 'de' MMM", { locale: ptBR });
}

function CartaoCliente({
  cliente,
  carteira,
  saude,
  responsavel,
  onAbrir,
}: {
  cliente: ClientCard;
  carteira: Carteira;
  saude?: ClientHealth;
  responsavel?: { nome: string; foto?: string | null };
  onAbrir: () => void;
}) {
  const estado = saude ? ESTADO[saude.financialState]?.rotulo ?? null : null;
  const atrasado = carteira.atrasados > 0;

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="group flex min-h-[148px] flex-col rounded-2xl border border-border/60 bg-card p-5 text-left transition-colors hover:border-foreground/20 hover:bg-muted/20"
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[14px] font-bold text-white"
          style={{ backgroundColor: cliente.color || '#6366f1' }}
        >
          {cliente.logo_url ? (
            <img src={cliente.logo_url} alt={cliente.name} className="h-full w-full object-cover" />
          ) : (
            cliente.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14.5px] font-semibold tracking-tight">{cliente.name}</h3>
          <p className="truncate text-[12px] text-muted-foreground">{cliente.segment || 'Sem segmento'}</p>
        </div>
        <Saude score={saude?.healthScore} estado={estado} />
      </div>

      <p className="mt-5 text-[13px] text-muted-foreground">
        <span className="font-semibold text-foreground">{carteira.abertos}</span> {carteira.abertos === 1 ? 'card aberto' : 'cards abertos'}
        {atrasado && (
          <>
            <span className="mx-1.5 opacity-40">·</span>
            <span className="font-semibold text-red-600 dark:text-red-400">
              {carteira.atrasados} {carteira.atrasados === 1 ? 'atrasado' : 'atrasados'}
            </span>
          </>
        )}
      </p>

      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        <p className="min-w-0 truncate text-[12px] text-muted-foreground/80">
          {carteira.proxima ? (
            <>
              Próxima: {carteira.proxima.titulo} · {rotuloPrazo(carteira.proxima.prazo)}
            </>
          ) : (
            'Sem entrega marcada'
          )}
        </p>
        {responsavel && (
          <Avatar className="h-5 w-5 shrink-0" title={`Responsável: ${responsavel.nome}`}>
            {responsavel.foto && <AvatarImage src={responsavel.foto} />}
            <AvatarFallback className="bg-muted text-[9px] font-semibold">{responsavel.nome.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </button>
  );
}

export function ClientesNovo({ onAbrir, onNovo }: { onAbrir: (id: string) => void; onNovo: () => void }) {
  const [status, setStatus] = useState<ClientStatus>('active');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [ordem, setOrdem] = useState<Ordem>('atencao');

  const ativos = useClientCardsByStatus('active');
  const pausados = useClientCardsByStatus('paused');
  const encerrados = useClientCardsByStatus('closed');
  const { data: saude } = useClientsHealth();
  const { data: carteira, isLoading: carregandoCarteira } = useCarteira();
  const { data: membros } = useWorkspaceMembers();

  const porStatus = { active: ativos, paused: pausados, closed: encerrados };
  const lista = porStatus[status].data ?? [];
  const carregando = porStatus[status].isLoading || carregandoCarteira;

  const responsavelDe = (id: string | null) => {
    if (!id) return undefined;
    const m = membros?.find((x) => x.user_id === id);
    if (!m) return undefined;
    return { nome: m.profile?.full_name || m.profile?.email || 'Membro', foto: (m.profile as { avatar_url?: string | null } | undefined)?.avatar_url };
  };

  const cart = (id: string) => carteira?.get(id) ?? SEM_CARTEIRA;

  const buscados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista.filter((c) => !q || c.name.toLowerCase().includes(q) || c.segment?.toLowerCase().includes(q));
  }, [lista, busca]);

  const comAtraso = (c: ClientCard) => cart(c.id).atrasados > 0;
  const emAtencao = (c: ClientCard) => {
    const e = saude?.get(c.id)?.financialState;
    return e === 'attention' || e === 'critical' || e === 'loss';
  };
  const saudavel = (c: ClientCard) => saude?.get(c.id)?.financialState === 'healthy';

  const contagem = {
    todos: buscados.length,
    atraso: buscados.filter(comAtraso).length,
    atencao: buscados.filter(emAtencao).length,
    saudavel: buscados.filter(saudavel).length,
  };

  const visiveis = useMemo(() => {
    const base = buscados.filter((c) =>
      filtro === 'atraso' ? comAtraso(c) : filtro === 'atencao' ? emAtencao(c) : filtro === 'saudavel' ? saudavel(c) : true
    );
    const scoreDe = (c: ClientCard) => saude?.get(c.id)?.healthScore ?? 101;
    return [...base].sort((a, b) => {
      if (ordem === 'nome') return a.name.localeCompare(b.name, 'pt-BR');
      if (ordem === 'score') return scoreDe(a) - scoreDe(b);
      // Atenção primeiro: mais atrasados no topo; empate pela saúde mais baixa.
      return cart(b.id).atrasados - cart(a.id).atrasados || scoreDe(a) - scoreDe(b) || a.name.localeCompare(b.name, 'pt-BR');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscados, filtro, ordem, saude, carteira]);

  const totalAbertos = lista.reduce((n, c) => n + cart(c.id).abertos, 0);
  const totalAtrasados = lista.reduce((n, c) => n + cart(c.id).atrasados, 0);
  const clientesComAtraso = lista.filter(comAtraso).length;
  const scores = lista.map((c) => saude?.get(c.id)?.healthScore).filter((s): s is number => s !== undefined);
  const scoreMedio = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : undefined;

  const kpis = [
    { rotulo: status === 'active' ? 'Clientes ativos' : status === 'paused' ? 'Clientes pausados' : 'Clientes encerrados', valor: lista.length, sub: 'na carteira', alerta: false },
    { rotulo: 'Cards abertos', valor: totalAbertos, sub: 'somando todos os clientes', alerta: false },
    { rotulo: 'Cards atrasados', valor: totalAtrasados, sub: clientesComAtraso ? `em ${clientesComAtraso} cliente${clientesComAtraso > 1 ? 's' : ''}` : 'nenhum atraso', alerta: totalAtrasados > 0 },
    { rotulo: 'Saúde média', valor: scoreMedio ?? '—', sub: scores.length ? `${scores.length} cliente${scores.length > 1 ? 's' : ''} medido${scores.length > 1 ? 's' : ''}` : 'sem medição', alerta: false },
  ];

  const pilulas: { chave: Filtro; rotulo: string }[] = [
    { chave: 'todos', rotulo: 'Todos' },
    { chave: 'atraso', rotulo: 'Com atraso' },
    { chave: 'atencao', rotulo: 'Precisam de atenção' },
    { chave: 'saudavel', rotulo: 'Saudáveis' },
  ];

  return (
    <div className="mx-auto max-w-[1180px] space-y-6 px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Quem precisa de você agora, com prazo e saúde de cada conta.</p>
        </div>
        <Button onClick={onNovo} className="h-10 w-full rounded-xl px-4 font-bold shadow-sm sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Novo cliente
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.rotulo} className={cn('rounded-2xl border bg-card p-5 shadow-sm', k.alerta ? 'border-red-500/30' : 'border-border/60')}>
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
              {k.alerta && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
              {k.rotulo}
            </p>
            <p className={cn('mt-2.5 text-[32px] font-extrabold leading-none tracking-tight', k.alerta && 'text-red-600 dark:text-red-400')}>{k.valor}</p>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-b border-border/60 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-6">
          {STATUS.map((s) => (
            <button
              key={s.chave}
              type="button"
              onClick={() => setStatus(s.chave)}
              className={cn(
                '-mb-px shrink-0 border-b-2 pb-3 text-[14px] font-semibold transition-colors',
                status === s.chave ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {s.rotulo}
              <span className="ml-1.5 text-[12.5px] font-medium text-muted-foreground">{(porStatus[s.chave].data ?? []).length}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar"
              aria-label="Buscar cliente"
              className="h-8 w-32 rounded-lg bg-transparent pl-8 pr-2 text-[13px] outline-none transition-all placeholder:text-muted-foreground hover:bg-muted/60 focus:w-52 focus:bg-muted/60"
            />
          </div>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as Filtro)}
            aria-label="Filtrar clientes"
            className={cn(
              'h-8 cursor-pointer rounded-lg bg-transparent px-2 text-[13px] font-medium outline-none hover:bg-muted/60 focus-visible:bg-muted/60',
              filtro === 'todos' ? 'text-muted-foreground' : 'text-foreground'
            )}
          >
            {pilulas.map((p) => (
              <option key={p.chave} value={p.chave}>
                {p.chave === 'todos' ? 'Todos os clientes' : `${p.rotulo} (${contagem[p.chave]})`}
              </option>
            ))}
          </select>
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as Ordem)}
            aria-label="Ordenar clientes"
            className="h-8 cursor-pointer rounded-lg bg-transparent px-2 text-[13px] font-medium text-muted-foreground outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
          >
            <option value="atencao">Atenção primeiro</option>
            <option value="score">Menor saúde</option>
            <option value="nome">Nome (A–Z)</option>
          </select>
        </div>
      </div>

      {carregando ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-[148px] rounded-2xl" />
          ))}
        </div>
      ) : visiveis.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-border/60 bg-card py-14 text-center shadow-sm">
          <Building2 className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <h3 className="font-semibold">Nenhum cliente encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {busca || filtro !== 'todos' ? 'Tente outra busca ou outro filtro.' : 'Adicione o primeiro cliente.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((c) => (
            <CartaoCliente
              key={c.id}
              cliente={c}
              carteira={cart(c.id)}
              saude={saude?.get(c.id)}
              responsavel={responsavelDe(c.responsible_user_id)}
              onAbrir={() => onAbrir(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
