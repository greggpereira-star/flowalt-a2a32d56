import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { varsDaMarca } from '@/lib/portal/marca';
import { format } from 'date-fns';
import { CheckCircle2, ExternalLink, FileText, Lock, MessageSquareWarning, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { EtapaDeAprovacao, rotuloDaEtapa } from '@/hooks/useApprovals';
import { EtapaPublica, EtapasDaAprovacao } from '@/components/approvals/EtapasDaAprovacao';
import { ConversaDaAprovacao } from '@/components/approvals/ConversaDaAprovacao';

interface Peca {
  id: string;
  kind: 'image' | 'video' | 'document' | 'text' | 'link';
  stage: EtapaDeAprovacao | null;
  caption: string | null;
  file_name: string | null;
  body: string | null;
  url: string | null;
}
interface Mensagem {
  id: string;
  author_kind: 'member' | 'client';
  author_name: string;
  body: string;
  created_at: string;
}
interface Aprovacao {
  mode?: 'quick' | 'stages';
  stages?: EtapaPublica[];
  status: 'pending' | 'approved' | 'changes_requested';
  round: number;
  title: string;
  message: string | null;
  client_name: string | null;
  expires_at: string;
  decided_at: string | null;
  decided_by_name: string | null;
  workspace_name: string | null;
  workspace_logo: string | null;
  brand_color?: string | null;
  items: Peca[];
  comments: Mensagem[];
}

async function chamar(token: string, action: string, extra: Record<string, unknown> = {}, pedidoDoPortal?: string) {
  // No portal, o token e o do portal e o pedido vai em request_id; fora dele, o token e o do proprio pedido.
  const corpo = pedidoDoPortal ? { portal_token: token, request_id: pedidoDoPortal, action, ...extra } : { token, action, ...extra };
  const { data, error } = await supabase.functions.invoke('public-approval', { body: corpo });
  // Em erro HTTP o supabase-js devolve o corpo em error.context; tentamos ler a mensagem real da funcao.
  if (error) {
    let msg = 'Não foi possível carregar agora. Tente novamente.';
    try {
      const corpo = await (error as any).context?.json?.();
      if (corpo?.error) msg = corpo.error;
    } catch {
      /* mantem a mensagem padrao */
    }
    const e: any = new Error(msg);
    e.status = (error as any).context?.status;
    throw e;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function PublicApprovalPage() {
  const { token = '', id: pedidoDoPortal } = useParams<{ token: string; id?: string }>();
  const [dados, setDados] = useState<Aprovacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [nome, setNome] = useState(() => {
    try { return localStorage.getItem('flowalt_approval_name') ?? ''; } catch { return ''; }
  });
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [dialogo, setDialogo] = useState<'aprovar' | 'ajustes' | null>(null);
  const [ajuste, setAjuste] = useState('');
  const [aceite, setAceite] = useState(false);
  const [etapaEscolhida, setEtapaEscolhida] = useState<EtapaDeAprovacao | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await chamar(token, 'get', {}, pedidoDoPortal);
      setDados(r.approval as Aprovacao);
      setErro(null);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Se a equipe editar o pedido, o cliente ve a versao nova ao voltar para a aba, sem precisar recarregar a pagina.
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') carregar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
    };
  }, [carregar]);

  const guardarNome = (n: string) => {
    setNome(n);
    try { localStorage.setItem('flowalt_approval_name', n); } catch { /* sem armazenamento */ }
  };

  const executar = async (action: string, extra: Record<string, unknown>, sucesso: string) => {
    setEnviando(true);
    try {
      await chamar(token, action, { name: nome.trim(), ...extra }, pedidoDoPortal);
      toast.success(sucesso);
      setDialogo(null);
      setMensagem('');
      setAjuste('');
      setAceite(false);
      await carregar();
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível enviar.');
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Link indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">{erro ?? 'Este link não está mais disponível. Peça um novo link a quem enviou.'}</p>
        </div>
      </div>
    );
  }

  const aberto = dados.status === 'pending';
  const porEtapas = dados.mode === 'stages' && (dados.stages?.length ?? 0) > 0;
  // Etapa em foco: a escolhida; senao a primeira ainda sem decisao; senao a primeira.
  const etapaAtiva: EtapaDeAprovacao | null = porEtapas
    ? (dados.stages!.find(e => e.stage === etapaEscolhida)?.stage ?? dados.stages!.find(e => e.status === 'pending')?.stage ?? dados.stages![0].stage)
    : null;

  return (
    <div className="min-h-screen bg-background" style={varsDaMarca(dados.brand_color ?? null)}>
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          {dados.workspace_logo && <img src={dados.workspace_logo} alt="" className="h-8 w-8 rounded-lg object-cover" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{dados.workspace_name ?? 'Aprovação'}</p>
            <p className="text-xs text-muted-foreground">Aprovação de conteúdo</p>
          </div>
          {pedidoDoPortal && (
            <Link to={`/portal/${token}`} className="ml-auto shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
              ← Portal
            </Link>
          )}
        </div>
      </header>

      <main className={cn('mx-auto space-y-6 px-4 py-6 pb-32', porEtapas ? 'max-w-5xl' : 'max-w-2xl')}>
        <section>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-muted px-2 py-1 text-[11px] font-bold tabular-nums">Rodada {dados.round}</span>
            {dados.status === 'approved' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Aprovado
              </span>
            )}
            {dados.status === 'changes_requested' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
                <MessageSquareWarning className="h-3 w-3" /> Ajustes enviados
              </span>
            )}
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{dados.title}</h1>
          {dados.client_name && <p className="mt-1 text-sm text-muted-foreground">Para {dados.client_name}</p>}
          {dados.message && <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-muted/50 p-4 text-sm">{dados.message}</p>}
        </section>

        {!aberto && (
          <div
            className={cn(
              'rounded-2xl p-4 text-sm',
              dados.status === 'approved'
                ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200'
                : 'bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-200',
            )}
          >
            {dados.status === 'approved' ? 'Aprovação registrada' : 'Pedido de ajustes registrado'}
            {dados.decided_by_name && <> por <b>{dados.decided_by_name}</b></>}
            {dados.decided_at && <> em {format(new Date(dados.decided_at), "dd/MM/yyyy 'às' HH:mm")}</>}. Obrigado!
            {dados.status === 'changes_requested' && ' A equipe vai preparar uma nova versão e enviar um novo link.'}
          </div>
        )}

        {porEtapas && etapaAtiva && (
          <EtapasDaAprovacao
            etapas={dados.stages!}
            pecas={dados.items}
            aberto={aberto}
            etapaAtiva={etapaAtiva}
            onEscolher={setEtapaEscolhida}
            onAprovar={() => setDialogo('aprovar')}
            onAjustes={() => setDialogo('ajustes')}
            cliente={dados.client_name ?? 'Seu perfil'}
            agencia={dados.workspace_name}
            logoUrl={null}
          />
        )}

        <section className="space-y-4">
          {(porEtapas ? [] : dados.items).map(p => (
            <figure key={p.id} className="overflow-hidden rounded-2xl border bg-card">
              {p.kind === 'image' && p.url && <img src={p.url} alt={p.file_name ?? ''} className="w-full" />}
              {p.kind === 'video' && p.url && <video src={p.url} controls playsInline className="w-full bg-black" />}
              {p.kind === 'document' && (
                <div className="flex items-center gap-3 p-4">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{p.file_name}</span>
                  {p.url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={p.url} target="_blank" rel="noreferrer">
                        Abrir <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              )}
              {p.kind === 'text' && <p className="whitespace-pre-wrap p-4 text-[15px] leading-relaxed">{p.body}</p>}
              {p.caption && <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">{p.caption}</figcaption>}
            </figure>
          ))}
        </section>

        <ConversaDaAprovacao
          mensagens={dados.comments}
          aberto={aberto}
          agencia={dados.workspace_name}
          nome={nome}
          onNome={guardarNome}
          mensagem={mensagem}
          onMensagem={setMensagem}
          enviando={enviando}
          onEnviar={() => executar('comment', { message: mensagem }, 'Mensagem enviada.')}
        />
      </main>

      {aberto && !porEtapas && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 p-3 backdrop-blur" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="mx-auto flex max-w-2xl gap-2">
            <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={() => setDialogo('ajustes')}>
              Pedir ajustes
            </Button>
            <Button className="h-12 flex-1 rounded-xl" onClick={() => setDialogo('aprovar')}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Aprovar
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogo === 'aprovar'} onOpenChange={o => !o && setDialogo(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{porEtapas ? `Aprovar ${rotuloDaEtapa(etapaAtiva!)}` : 'Aprovar esta entrega'}</DialogTitle>
            <DialogDescription>Fica registrado seu nome, a data e o horário da aprovação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ap-nome">Seu nome</Label>
              <Input id="ap-nome" value={nome} onChange={e => guardarNome(e.target.value)} autoComplete="name" />
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <Checkbox checked={aceite} onCheckedChange={v => setAceite(v === true)} className="mt-0.5" />
              <span>Confirmo que revisei o conteúdo acima e aprovo a publicação como está.</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogo(null)}>Voltar</Button>
            <Button disabled={enviando || nome.trim().length < 2 || !aceite} onClick={() => executar(porEtapas ? 'approve_stage' : 'approve', { consent: true, stage: etapaAtiva }, porEtapas ? `Etapa ${rotuloDaEtapa(etapaAtiva!)} aprovada. Obrigado!` : 'Aprovação registrada. Obrigado!')}>
              <ShieldCheck className="mr-1.5 h-4 w-4" /> {enviando ? 'Enviando…' : porEtapas ? `Confirmar aprovação de ${rotuloDaEtapa(etapaAtiva!)}` : 'Confirmar aprovação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogo === 'ajustes'} onOpenChange={o => !o && setDialogo(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{porEtapas ? `Pedir ajuste em ${rotuloDaEtapa(etapaAtiva!)}` : 'Pedir ajustes'}</DialogTitle>
            <DialogDescription>Descreva o que precisa mudar. A equipe recebe na hora e envia uma nova versão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="aj-nome">Seu nome</Label>
              <Input id="aj-nome" value={nome} onChange={e => guardarNome(e.target.value)} autoComplete="name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aj-texto">O que precisa mudar</Label>
              <Textarea id="aj-texto" rows={5} value={ajuste} onChange={e => setAjuste(e.target.value)} placeholder="Ex.: Trocar a cor do título e corrigir o preço na legenda." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogo(null)}>Voltar</Button>
            <Button disabled={enviando || nome.trim().length < 2 || ajuste.trim().length < 3} onClick={() => executar(porEtapas ? 'request_changes_stage' : 'request_changes', { message: ajuste, stage: etapaAtiva }, 'Pedido de ajustes enviado.')}>
              {enviando ? 'Enviando…' : 'Enviar pedido de ajustes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
