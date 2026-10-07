import React, { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, Plus, Trash2, XCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { FEATURE_FLAGS, useFeatureFlags } from '@/hooks/useFeatureFlags';
import { usePermissions } from '@/hooks/usePermissions';
import { useSpaces } from '@/hooks/useSpaces';
import {
  useAlternarRegra,
  useCriarRegra,
  useExcluirRegra,
  useExecucoesDeRegras,
  useRegrasAutomaticas,
} from '@/hooks/useRegrasAutomaticas';
import {
  DESTINATARIOS,
  ETAPAS,
  EVENTOS,
  FORMULARIO_VAZIO,
  PRIORIDADES,
  conflitos,
  descreverRegra,
  montarRegra,
  rotuloEvento,
  validarFormulario,
  type FormularioRegra,
} from '@/lib/automacoes/regras';
import { cn } from '@/lib/utils';

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
      {children}
    </div>
  );
}

function NovaRegra({ aberto, onFechar, espacos }: { aberto: boolean; onFechar: () => void; espacos: { id: string; name: string }[] }) {
  const criar = useCriarRegra();
  const [f, setF] = useState<FormularioRegra>(FORMULARIO_VAZIO);
  const erro = validarFormulario(f);
  const set = (p: Partial<FormularioRegra>) => setF(x => ({ ...x, ...p }));

  const salvar = () => {
    if (erro) return;
    criar.mutate(montarRegra(f), {
      onSuccess: () => {
        setF(FORMULARIO_VAZIO);
        onFechar();
      },
    });
  };

  return (
    <Dialog open={aberto} onOpenChange={o => !o && onFechar()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Nova regra</DialogTitle>
          <DialogDescription>Escolha quando a regra vale e o que o sistema deve fazer. Ela nasce desligada.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Campo rotulo="Nome da regra">
            <Input value={f.nome} onChange={e => set({ nome: e.target.value })} placeholder="Ex.: Cliente aprovou, avisar o time" />
          </Campo>

          <Campo rotulo="Quando">
            <Select value={f.evento || undefined} onValueChange={v => set({ evento: v as FormularioRegra['evento'] })}>
              <SelectTrigger><SelectValue placeholder="Escolha o que dispara a regra" /></SelectTrigger>
              <SelectContent>
                {EVENTOS.map(e => <SelectItem key={e.valor} value={e.valor}>{e.rotulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>

          {f.evento === 'stage_entered' && (
            <Campo rotulo="Em qual etapa">
              <Select value={f.etapa || undefined} onValueChange={v => set({ etapa: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha a etapa" /></SelectTrigger>
                <SelectContent>{ETAPAS.map(e => <SelectItem key={e.slug} value={e.slug}>{e.rotulo}</SelectItem>)}</SelectContent>
              </Select>
            </Campo>
          )}

          <Campo rotulo="Onde vale">
            <Select value={f.spaceId || 'todos'} onValueChange={v => set({ spaceId: v === 'todos' ? '' : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Em todos os espaços</SelectItem>
                {espacos.map(s => <SelectItem key={s.id} value={s.id}>Só em {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>

          <Campo rotulo="Então o sistema deve">
            <Select value={f.acao || undefined} onValueChange={v => set({ acao: v as FormularioRegra['acao'] })}>
              <SelectTrigger><SelectValue placeholder="Escolha a ação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="notify">Avisar pessoas</SelectItem>
                <SelectItem value="move_to_stage">Mover o card para uma etapa</SelectItem>
                <SelectItem value="set_priority">Mudar a prioridade</SelectItem>
              </SelectContent>
            </Select>
          </Campo>

          {f.acao === 'notify' && (
            <>
              <Campo rotulo="Quem será avisado">
                <Select value={f.destinatario || undefined} onValueChange={v => set({ destinatario: v as FormularioRegra['destinatario'] })}>
                  <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>{DESTINATARIOS.map(d => <SelectItem key={d.valor} value={d.valor}>{d.rotulo}</SelectItem>)}</SelectContent>
                </Select>
              </Campo>
              <Campo rotulo="Mensagem (use {{card}} para o nome do card)">
                <Textarea value={f.mensagem} onChange={e => set({ mensagem: e.target.value })} rows={3} placeholder='Ex.: "{{card}}" foi aprovado pelo cliente.' />
              </Campo>
            </>
          )}

          {f.acao === 'move_to_stage' && (
            <Campo rotulo="Mover para">
              <Select value={f.etapaDestino || undefined} onValueChange={v => set({ etapaDestino: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha a etapa" /></SelectTrigger>
                <SelectContent>{ETAPAS.map(e => <SelectItem key={e.slug} value={e.slug}>{e.rotulo}</SelectItem>)}</SelectContent>
              </Select>
            </Campo>
          )}

          {f.acao === 'set_priority' && (
            <Campo rotulo="Nova prioridade">
              <Select value={f.prioridade || undefined} onValueChange={v => set({ prioridade: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p.valor} value={p.valor}>{p.rotulo}</SelectItem>)}</SelectContent>
              </Select>
            </Campo>
          )}

          {erro && f.nome.trim() && <p className="text-xs text-amber-700 dark:text-amber-400">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={!!erro || criar.isPending}>Criar regra</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RegrasAutomaticasPage() {
  const { isEnabled, isReady } = useFeatureFlags();
  const { canManageAutomations } = usePermissions();
  const { data: regras, isLoading } = useRegrasAutomaticas();
  const { data: execucoes } = useExecucoesDeRegras(20);
  const { data: espacos = [] } = useSpaces();
  const alternar = useAlternarRegra();
  const excluir = useExcluirRegra();
  const [novaAberta, setNovaAberta] = useState(false);

  const nomeDoEspaco = useMemo(() => new Map(espacos.map(s => [s.id, s.name])), [espacos]);
  const avisos = useMemo(() => conflitos(regras ?? []), [regras]);

  if (isReady && !isEnabled(FEATURE_FLAGS.AUTOMATION_RULES)) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-12 pt-8 sm:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Zap className="h-6 w-6 text-primary" /> Regras automáticas
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            O sistema faz sozinho o que você combinar aqui. Toda regra nasce desligada, uma regra nunca dispara outra, e cada execução fica registrada logo abaixo.
          </p>
        </div>
        {canManageAutomations && (
          <Button onClick={() => setNovaAberta(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova regra
          </Button>
        )}
      </header>

      {avisos.length > 0 && (
        <div className="mb-4 flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {avisos.map((a, i) => {
              const ra = regras!.find(r => r.id === a.a)!;
              const rb = regras!.find(r => r.id === a.b)!;
              return <p key={i}>As regras “{ra.name}” e “{rb.name}” {a.motivo}. A última a rodar vence.</p>;
            })}
          </div>
        </div>
      )}

      <section className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-28 w-full rounded-2xl" />
        ) : (regras ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma regra ainda. Clique em Nova regra para criar a primeira.</p>
        ) : (
          (regras ?? []).map(r => {
            const d = descreverRegra(r, r.space_id ? nomeDoEspaco.get(r.space_id) : null);
            return (
              <article key={r.id} className={cn('flex items-start gap-4 rounded-2xl border border-border/60 p-4', r.is_active && 'border-primary/40 bg-primary/[0.03]')}>
                <Switch
                  checked={r.is_active}
                  disabled={!canManageAutomations || alternar.isPending}
                  onCheckedChange={ativa => alternar.mutate({ id: r.id, ativa })}
                  aria-label={`${r.is_active ? 'Desligar' : 'Ligar'} a regra ${r.name}`}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-semibold">{r.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Quando</span> {d.quando}, <span className="font-medium text-foreground">então</span> {d.entao}.
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {d.onde} · {r.is_active ? 'ligada' : 'desligada'}
                    {r.action_type === 'notify' && r.action_config.message ? ` · mensagem: “${r.action_config.message}”` : ''}
                  </p>
                </div>
                {canManageAutomations && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir a regra ${r.name}`}
                    onClick={() => window.confirm(`Excluir a regra "${r.name}"? O histórico dela fica guardado.`) && excluir.mutate(r.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </article>
            );
          })
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold">Últimas execuções</h2>
        {(execucoes ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma regra rodou ainda. Quando rodar, cada execução aparece aqui, com o que foi feito.</p>
        ) : (
          <ul className="divide-y rounded-2xl border border-border/60">
            {(execucoes ?? []).map(e => (
              <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                {e.outcome === 'done' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{e.rule_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.card_title ?? 'card removido'} · {rotuloEvento(e.trigger_event)} · {e.outcome === 'done' ? e.detail : `erro: ${e.detail}`}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(new Date(e.ran_at), { addSuffix: true, locale: ptBR })}</time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NovaRegra aberto={novaAberta} onFechar={() => setNovaAberta(false)} espacos={espacos.map(s => ({ id: s.id, name: s.name }))} />
    </div>
  );
}
