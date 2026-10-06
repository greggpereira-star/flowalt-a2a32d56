import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BookOpen, Check, CircleDot, Pencil, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/hooks/usePermissions';
import { FEATURE_FLAGS, useFeatureFlags } from '@/hooks/useFeatureFlags';
import { usePessoas } from '@/hooks/useChat';
import {
  TarefaDoCliente,
  useAdicionarTarefa,
  useAtualizarTarefa,
  useEncerrarOnboarding,
  useModeloDeOnboarding,
  useOnboarding,
  useSalvarPlaybook,
} from '@/hooks/useOnboardingClientes';
import { diaDoOnboarding, etapaAtual, hojeSP, marcos, progresso, resumoPorEtapa, tarefaAtrasada } from '@/lib/onboarding/esteira';
import { cn } from '@/lib/utils';

const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const iniciais = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';

function LinhaDaTarefa({ t, hoje, pessoas }: { t: TarefaDoCliente; hoje: string; pessoas: ReturnType<typeof usePessoas> }) {
  const atualizar = useAtualizarTarefa();
  const feita = !!t.completed_at;
  const atrasada = tarefaAtrasada(t, hoje);
  const quem = t.completed_by ? pessoas.get(t.completed_by)?.nome : null;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-3.5 py-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={feita}
        aria-label={feita ? `Desfazer: ${t.title}` : `Concluir: ${t.title}`}
        disabled={atualizar.isPending}
        onClick={() => atualizar.mutate({ id: t.id, patch: { completed_at: feita ? null : new Date().toISOString() } })}
        className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors', feita ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/40 hover:border-primary')}
      >
        {feita && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1 basis-56">
        <p className={cn('text-sm font-medium', feita && 'text-muted-foreground line-through')}>{t.title}</p>
        {feita && t.completed_at && (
          <p className="text-[11px] text-muted-foreground">Feita em {dataCurta(t.completed_at.slice(0, 10))}{quem ? ` por ${quem}` : ''}</p>
        )}
      </div>

      <label className="flex items-center gap-1.5 text-xs">
        <span className="sr-only">Prazo</span>
        <input
          type="date"
          value={t.due_date ?? ''}
          disabled={feita || atualizar.isPending}
          onChange={e => atualizar.mutate({ id: t.id, patch: { due_date: e.target.value || null } })}
          className={cn('h-8 rounded-md border bg-background px-1.5 text-xs', atrasada && 'border-red-300 font-semibold text-red-700')}
        />
        {atrasada && <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-label="Atrasada" />}
      </label>

      <label className="text-xs">
        <span className="sr-only">Responsável</span>
        <select
          value={t.assignee_id ?? ''}
          disabled={atualizar.isPending}
          onChange={e => atualizar.mutate({ id: t.id, patch: { assignee_id: e.target.value || null } })}
          className="h-8 max-w-[150px] rounded-md border bg-background px-1.5 text-xs"
        >
          <option value="">Sem responsável</option>
          {[...pessoas.values()].map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>
    </li>
  );
}

function NovaTarefa({ onboardingId, stageKey, proximaOrdem }: { onboardingId: string; stageKey: string; proximaOrdem: number }) {
  const adicionar = useAdicionarTarefa();
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState('');
  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="flex items-center gap-1.5 px-1 py-1 text-xs font-semibold text-primary hover:underline">
        <Plus className="h-3.5 w-3.5" /> Adicionar tarefa
      </button>
    );
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={e => {
        e.preventDefault();
        if (!titulo.trim()) return;
        adicionar.mutate({ onboardingId, stageKey, title: titulo, dueDate: null, sortOrder: proximaOrdem }, { onSuccess: () => { setTitulo(''); setAberto(false); } });
      }}
    >
      <Input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="O que precisa ser feito?" maxLength={300} className="h-9" />
      <Button type="submit" size="sm" disabled={!titulo.trim() || adicionar.isPending}>Adicionar</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
    </form>
  );
}

export default function OnboardingClientePage() {
  const { id } = useParams<{ id: string }>();
  const { isEnabled, isReady } = useFeatureFlags();
  const ligada = isEnabled(FEATURE_FLAGS.ONBOARDING_ESTEIRA);
  const { data: modelo } = useModeloDeOnboarding();
  const { onboarding, carregando } = useOnboarding(id);
  const pessoas = usePessoas();
  const { isAdmin, isOwner } = usePermissions();
  const podeEditarPlaybook = isAdmin || isOwner;
  const encerrar = useEncerrarOnboarding();
  const salvarPlaybook = useSalvarPlaybook();
  const hoje = hojeSP();

  const etapas = modelo?.etapas ?? [];
  const tarefas = onboarding?.tarefas ?? [];
  const atual = useMemo(() => etapaAtual(etapas, tarefas), [etapas, tarefas]);
  const resumo = useMemo(() => resumoPorEtapa(etapas, tarefas, hoje), [etapas, tarefas, hoje]);

  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const mostrada = escolhida ?? atual ?? etapas[0]?.key ?? null;
  const etapaMostrada = etapas.find(e => e.key === mostrada) ?? null;

  useEffect(() => {
    setEditando(false);
    setTexto(etapaMostrada?.playbook ?? '');
  }, [etapaMostrada?.key, etapaMostrada?.playbook]);

  if (!isReady) return <div className="p-6"><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  if (!ligada) return <Navigate to="/" replace />;

  if (carregando || !modelo) {
    return <div className="mx-auto max-w-[1200px] p-6"><Skeleton className="h-72 w-full rounded-2xl" /></div>;
  }
  if (!onboarding) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-sm font-semibold">Onboarding não encontrado</p>
        <Link to="/onboarding" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">Voltar ao quadro</Link>
      </div>
    );
  }

  const p = progresso(tarefas);
  const dia = Math.max(1, diaDoOnboarding(onboarding.start_date, hoje));
  const m = marcos(onboarding.start_date, hoje);
  const ativo = onboarding.status === 'active';
  const tudoFeito = tarefas.length > 0 && p.feitas === p.total;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-24 pt-6 sm:px-8">
      <Link to="/onboarding" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Onboarding de clientes
      </Link>

      <header className="mb-6 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="h-14 w-14">
            {onboarding.cliente?.logo_url && <AvatarImage src={onboarding.cliente.logo_url} alt="" />}
            <AvatarFallback className="font-semibold">{iniciais(onboarding.cliente?.name ?? '?')}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold tracking-tight">{onboarding.cliente?.name ?? 'Cliente'}</h1>
            <p className="text-sm text-muted-foreground">
              {ativo ? `Dia ${dia} de 30` : onboarding.status === 'done' ? 'Onboarding concluído' : 'Onboarding cancelado'} · início em {dataCurta(onboarding.start_date)}
            </p>
          </div>
          {ativo && (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!tudoFeito || encerrar.isPending}
                title={tudoFeito ? undefined : 'Conclua todas as tarefas para encerrar'}
                onClick={() => encerrar.mutate({ id: onboarding.id, status: 'done' })}
              >
                Concluir onboarding
              </Button>
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={encerrar.isPending}
                onClick={() => window.confirm('Cancelar este onboarding? As tarefas deixam de aparecer no quadro.') && encerrar.mutate({ id: onboarding.id, status: 'canceled' })}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do onboarding">
          <div className="h-full rounded-full bg-primary" style={{ width: `${p.pct}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{p.feitas} de {p.total} tarefas ({p.pct}%)</span>
          {ativo && (
            <span>
              Marco de 15 dias: <b>{dataCurta(m.dia15.data)}</b>{m.dia15.passou ? ' (passou)' : m.dia15.faltam === 0 ? ' (hoje)' : ` (em ${m.dia15.faltam} d)`} · Marco de 30 dias: <b>{dataCurta(m.dia30.data)}</b>{m.dia30.passou ? ' (passou)' : m.dia30.faltam === 0 ? ' (hoje)' : ` (em ${m.dia30.faltam} d)`}
            </span>
          )}
        </div>

        <ol className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Etapas">
          {resumo.map((e, i) => {
            const eAtual = e.key === atual;
            return (
              <li key={e.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setEscolhida(e.key)}
                  aria-current={eAtual ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    e.key === mostrada ? 'border-primary bg-primary/10 text-primary' : 'bg-card hover:bg-muted',
                  )}
                >
                  <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px]', e.concluida ? 'bg-emerald-500 text-white' : eAtual ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                    {e.concluida ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                  </span>
                  {e.name}
                  {e.atrasadas > 0 && <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-label="Tem tarefa atrasada" />}
                  <span className="font-normal text-muted-foreground">{e.feitas}/{e.total}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {etapas.map(e => {
            const dela = tarefas.filter(t => t.stage_key === e.key);
            const r = resumo.find(x => x.key === e.key);
            return (
              <section key={e.key} aria-label={e.name} className={cn(e.key === mostrada ? '' : 'opacity-80')}>
                <header className="mb-2 flex items-center gap-2">
                  <h2 className="text-[15px] font-bold">{e.name}</h2>
                  {e.key === atual && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"><CircleDot className="h-3 w-3" /> Etapa atual</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{r?.feitas ?? 0}/{r?.total ?? 0}</span>
                </header>
                <ul className="space-y-2">
                  {dela.map(t => <LinhaDaTarefa key={t.id} t={t} hoje={hoje} pessoas={pessoas} />)}
                  {dela.length === 0 && <li className="rounded-xl border border-dashed px-3.5 py-3 text-xs text-muted-foreground">Nenhuma tarefa nesta etapa.</li>}
                </ul>
                {ativo && <div className="mt-2"><NovaTarefa onboardingId={onboarding.id} stageKey={e.key} proximaOrdem={(dela[dela.length - 1]?.sort_order ?? 0) + 1} /></div>}
              </section>
            );
          })}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-label="Playbook da etapa">
            <header className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h2 className="text-[15px] font-bold">Playbook: {etapaMostrada?.name ?? 'Etapa'}</h2>
              {podeEditarPlaybook && !editando && etapaMostrada && (
                <button type="button" onClick={() => setEditando(true)} aria-label="Editar playbook" className="ml-auto rounded p-1.5 text-muted-foreground hover:bg-muted">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </header>
            {editando && etapaMostrada ? (
              <div className="space-y-2">
                <Textarea rows={12} value={texto} onChange={e => setTexto(e.target.value)} className="text-sm" />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditando(false); setTexto(etapaMostrada.playbook ?? ''); }}>Cancelar</Button>
                  <Button size="sm" disabled={salvarPlaybook.isPending} onClick={() => salvarPlaybook.mutate({ stageId: etapaMostrada.id, playbook: texto }, { onSuccess: () => setEditando(false) })}>Salvar</Button>
                </div>
                <p className="text-xs text-muted-foreground">O playbook vale para todos os clientes que passam por esta etapa.</p>
              </div>
            ) : etapaMostrada?.playbook ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{etapaMostrada.playbook}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Esta etapa ainda não tem playbook.{podeEditarPlaybook ? ' Clique no lápis para escrever o "como fazemos".' : ''}</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
