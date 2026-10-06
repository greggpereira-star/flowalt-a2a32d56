import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, Plus, Rocket } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { FEATURE_FLAGS, useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Onboarding, useClientesParaOnboarding, useIniciarOnboarding, useModeloDeOnboarding, useOnboardings } from '@/hooks/useOnboardingClientes';
import { diaDoOnboarding, etapaAtual, hojeSP, progresso, proximaTarefa, situacaoDoOnboarding, tarefaAtrasada } from '@/lib/onboarding/esteira';
import { cn } from '@/lib/utils';

const iniciais = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function CartaoDoCliente({ o, hoje }: { o: Onboarding; hoje: string }) {
  const p = progresso(o.tarefas);
  const sit = situacaoDoOnboarding(o.tarefas, hoje);
  const prox = proximaTarefa(o.tarefas);
  const atrasadas = o.tarefas.filter(t => tarefaAtrasada(t, hoje)).length;
  return (
    <Link
      to={`/onboarding/${o.id}`}
      className="block rounded-xl border bg-card p-3.5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-center gap-2.5">
        <Avatar className="h-9 w-9">
          {o.cliente?.logo_url && <AvatarImage src={o.cliente.logo_url} alt="" />}
          <AvatarFallback className="text-xs font-semibold">{iniciais(o.cliente?.name ?? '?')}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{o.cliente?.name ?? 'Cliente'}</p>
          <p className="text-xs text-muted-foreground">Dia {Math.max(1, diaDoOnboarding(o.start_date, hoje))} · início {dataCurta(o.start_date)}</p>
        </div>
        {sit === 'atrasado' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800 dark:bg-red-500/15 dark:text-red-300">
            <AlertTriangle className="h-3 w-3" /> {atrasadas}
          </span>
        )}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tarefas concluídas">
        <div className="h-full rounded-full bg-primary" style={{ width: `${p.pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{p.feitas} de {p.total} tarefas</p>
      {prox && (
        <p className="mt-2 line-clamp-2 text-xs">
          <span className="text-muted-foreground">Próxima: </span>
          <span className="font-medium">{prox.title}</span>
          {prox.due_date && <span className={cn('ml-1 font-semibold', tarefaAtrasada(prox, hoje) ? 'text-red-600' : 'text-muted-foreground')}>({dataCurta(prox.due_date)})</span>}
        </p>
      )}
    </Link>
  );
}

function IniciarDialog({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const navigate = useNavigate();
  const { data: modelo } = useModeloDeOnboarding();
  const { data: clientes, isLoading } = useClientesParaOnboarding();
  const iniciar = useIniciarOnboarding();
  const [clienteId, setClienteId] = useState('');
  const [inicio, setInicio] = useState(hojeSP());

  const escolher = (id: string) => {
    setClienteId(id);
    const c = clientes?.find(x => x.id === id);
    if (c?.start_date) setInicio(c.start_date);
  };

  return (
    <Dialog open={aberto} onOpenChange={o => !o && onFechar()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Iniciar onboarding</DialogTitle>
          <DialogDescription>
            As tarefas do modelo "{modelo?.name ?? '...'}" são copiadas para o cliente, com prazo a partir da data de início.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="onb-cliente">Cliente</Label>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (clientes ?? []).length === 0 ? (
              <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Todos os clientes ativos já têm um onboarding em andamento.</p>
            ) : (
              <select id="onb-cliente" value={clienteId} onChange={e => escolher(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Escolha o cliente</option>
                {(clientes ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="onb-inicio">Data de início (dia 1)</Label>
            <Input id="onb-inicio" type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
            <p className="text-xs text-muted-foreground">Cliente que já começou? Use a data real: os prazos e os dias de onboarding acompanham.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button
            disabled={!clienteId || !inicio || !modelo || iniciar.isPending}
            onClick={() => iniciar.mutate({ clientId: clienteId, templateId: modelo!.id, inicio }, { onSuccess: id => { onFechar(); navigate(`/onboarding/${id}`); } })}
          >
            <Rocket className="mr-1.5 h-4 w-4" /> {iniciar.isPending ? 'Iniciando…' : 'Iniciar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OnboardingPage() {
  const { isEnabled, isReady } = useFeatureFlags();
  const ligada = isEnabled(FEATURE_FLAGS.ONBOARDING_ESTEIRA);
  const { data: modelo } = useModeloDeOnboarding();
  const { data: lista, isLoading, error } = useOnboardings();
  const [iniciando, setIniciando] = useState(false);
  const [verConcluidos, setVerConcluidos] = useState(false);
  const hoje = hojeSP();

  const { colunas, prontos, concluidos, atrasados } = useMemo(() => {
    const ativos = (lista ?? []).filter(o => o.status === 'active');
    const etapas = modelo?.etapas ?? [];
    const colunas = etapas.map(e => ({ etapa: e, itens: ativos.filter(o => etapaAtual(etapas, o.tarefas) === e.key) }));
    const prontos = ativos.filter(o => etapaAtual(etapas, o.tarefas) === null);
    return {
      colunas,
      prontos,
      concluidos: (lista ?? []).filter(o => o.status === 'done'),
      atrasados: ativos.filter(o => situacaoDoOnboarding(o.tarefas, hoje) === 'atrasado').length,
    };
  }, [lista, modelo, hoje]);

  if (!isReady) return <div className="p-6"><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  if (!ligada) return <Navigate to="/" replace />;

  const emAndamento = (lista ?? []).filter(o => o.status === 'active').length;

  return (
    <div className="w-full px-4 pb-24 pt-6 sm:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight sm:text-[30px]">Onboarding de clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Os primeiros 30 dias de cada cliente, etapa por etapa.</p>
        </div>
        <Button onClick={() => setIniciando(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Iniciar onboarding
        </Button>
      </header>

      <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { rotulo: 'Em andamento', valor: emAndamento, tom: '' },
          { rotulo: 'Com tarefas atrasadas', valor: atrasados, tom: atrasados > 0 ? 'text-red-600' : '' },
          { rotulo: 'Prontos para concluir', valor: prontos.length, tom: prontos.length > 0 ? 'text-emerald-600' : '' },
          { rotulo: 'Concluídos', valor: concluidos.length, tom: '' },
        ].map(k => (
          <li key={k.rotulo} className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{k.rotulo}</p>
            <p className={cn('mt-0.5 text-2xl font-bold tabular-nums', k.tom)}>{k.valor}</p>
          </li>
        ))}
      </ul>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto">{[0, 1, 2].map(i => <Skeleton key={i} className="h-64 w-72 shrink-0 rounded-2xl" />)}</div>
      ) : error ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Não foi possível carregar os onboardings agora. Tente novamente.</p>
      ) : emAndamento === 0 && concluidos.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <Rocket className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">Nenhum onboarding ainda</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">Inicie o de um cliente novo (ou de um que acabou de entrar) para acompanhar etapas, prazos e responsáveis.</p>
          <Button className="mt-4" onClick={() => setIniciando(true)}>Iniciar onboarding</Button>
        </div>
      ) : (
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
          {colunas.map(({ etapa, itens }) => (
            <section key={etapa.key} aria-label={etapa.name} className="w-[280px] shrink-0">
              <header className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-bold">{etapa.name}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">{itens.length}</span>
              </header>
              <div className="min-h-[96px] space-y-2.5 rounded-2xl bg-muted/40 p-2">
                {itens.length === 0 ? <p className="px-2 py-6 text-center text-xs text-muted-foreground">Ninguém nesta etapa.</p> : itens.map(o => <CartaoDoCliente key={o.id} o={o} hoje={hoje} />)}
              </div>
            </section>
          ))}
          <section aria-label="Prontos para concluir" className="w-[280px] shrink-0">
            <header className="mb-2 flex items-center justify-between px-1">
              <h2 className="flex items-center gap-1.5 text-sm font-bold"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Prontos para concluir</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">{prontos.length}</span>
            </header>
            <div className="min-h-[96px] space-y-2.5 rounded-2xl bg-emerald-50/60 p-2 dark:bg-emerald-500/5">
              {prontos.length === 0 ? <p className="px-2 py-6 text-center text-xs text-muted-foreground">Todas as tarefas feitas aparecem aqui.</p> : prontos.map(o => <CartaoDoCliente key={o.id} o={o} hoje={hoje} />)}
            </div>
          </section>
        </div>
      )}

      {concluidos.length > 0 && (
        <section className="mt-6">
          <button type="button" onClick={() => setVerConcluidos(v => !v)} className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ChevronDown className={cn('h-4 w-4 transition-transform', !verConcluidos && '-rotate-90')} /> Concluídos ({concluidos.length})
          </button>
          {verConcluidos && (
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {concluidos.map(o => <li key={o.id}><CartaoDoCliente o={o} hoje={hoje} /></li>)}
            </ul>
          )}
        </section>
      )}

      <IniciarDialog aberto={iniciando} onFechar={() => setIniciando(false)} />
    </div>
  );
}
