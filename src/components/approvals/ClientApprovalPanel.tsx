import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Link2,
  Mail,
  MessageCircle,
  MessageSquareWarning,
  Pencil,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAttachments } from '@/hooks/useAttachments';
import {
  ApprovalBundle,
  ApprovalStatus,
  ETAPAS_DE_APROVACAO,
  EtapaDeAprovacao,
  rotuloDaEtapa,
  useCancelApproval,
  useCardApprovals,
  useCreateApproval,
  useRenewApprovalLink,
  useReplyApproval,
  useSendApprovalEmail,
} from '@/hooks/useApprovals';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EditarPedidoDialog } from '@/components/approvals/EditarPedidoDialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const ROTULO: Record<ApprovalStatus, { texto: string; classe: string }> = {
  pending: { texto: 'Aguardando o cliente', classe: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  approved: { texto: 'Aprovado', classe: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' },
  changes_requested: { texto: 'Ajustes pedidos', classe: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300' },
  expired: { texto: 'Expirado', classe: 'bg-muted text-muted-foreground' },
  canceled: { texto: 'Cancelado', classe: 'bg-muted text-muted-foreground' },
};

const quando = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });

export interface InfoLink {
  link: string;
  token: string;
  requestId: string;
  /** E-mail do cliente, quando ja conhecido (preenche o campo). */
  email?: string | null;
  /** Preenchido quando o e-mail ja foi enviado ao criar o pedido. */
  enviadoPara?: string | null;
}

function LinkDialog({ info, onClose }: { info: InfoLink | null; onClose: () => void }) {
  const enviar = useSendApprovalEmail();
  const [email, setEmail] = useState('');
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);

  React.useEffect(() => {
    setEmail(info?.email ?? '');
    setEnviadoPara(info?.enviadoPara ?? null);
  }, [info]);

  const link = info?.link ?? null;
  const copiar = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copiado.');
    } catch {
      toast.error('Não consegui copiar. Selecione e copie manualmente.');
    }
  };
  const whats = link ? `https://wa.me/?text=${encodeURIComponent(`Olá! Segue o link para você ver e aprovar: ${link}`)}` : '#';
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  const mandarEmail = () => {
    if (!info) return;
    enviar.mutate(
      { requestId: info.requestId, token: info.token, to: email.trim() },
      {
        onSuccess: r => {
          setEnviadoPara(r.to);
          toast.success(`E-mail enviado para ${r.to}.`);
        },
        onError: (e: any) => toast.error(e?.message || 'Não foi possível enviar o e-mail.'),
      },
    );
  };

  return (
    <Dialog open={!!info} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Link para o cliente</DialogTitle>
          <DialogDescription>
            O cliente abre sem login. Guarde este link agora: por segurança ele não fica salvo e, se perder, é só gerar um novo (o anterior deixa de valer).
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-xl border bg-muted/40 p-2">
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input readOnly value={link ?? ''} onFocus={e => e.currentTarget.select()} className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ap-email">Enviar por e-mail</Label>
          <div className="flex gap-2">
            <Input id="ap-email" type="email" inputMode="email" placeholder="cliente@empresa.com" value={email} onChange={e => setEmail(e.target.value)} />
            <Button variant="outline" disabled={!emailValido || enviar.isPending} onClick={mandarEmail}>
              <Mail className="mr-1.5 h-4 w-4" /> {enviar.isPending ? 'Enviando…' : enviadoPara ? 'Reenviar' : 'Enviar'}
            </Button>
          </div>
          {enviadoPara && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> E-mail enviado para {enviadoPara}. As respostas dele vão para o seu e-mail.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" asChild>
            <a href={whats} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
            </a>
          </Button>
          <Button onClick={copiar}>
            <Copy className="mr-1.5 h-4 w-4" /> Copiar link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovoPedidoDialog({
  cardId,
  open,
  onOpenChange,
  onCreated,
}: {
  cardId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (info: InfoLink) => void;
}) {
  const { currentWorkspace } = useWorkspace();
  const enviarEmail = useSendApprovalEmail();
  const { data: anexos } = useAttachments(cardId);
  const criar = useCreateApproval();

  const { data: card } = useQuery({
    queryKey: ['approval-card-info', cardId],
    enabled: open,
    queryFn: async () => {
      const { data } = await (supabase as any).from('cards').select('title, client_id, client_cards(name)').eq('id', cardId).maybeSingle();
      // Reaproveita o e-mail usado no ultimo pedido deste cliente.
      let ultimoEmail: string | null = null;
      if (data?.client_id) {
        const { data: ult } = await (supabase as any)
          .from('approval_requests').select('client_email').eq('client_id', data.client_id).not('client_email', 'is', null)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        ultimoEmail = ult?.client_email ?? null;
      }
      return { ...(data as { title: string; client_id: string | null; client_cards: { name: string } | null }), ultimoEmail };
    },
  });

  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [cliente, setCliente] = useState('');
  const [emailCliente, setEmailCliente] = useState('');
  const [texto, setTexto] = useState('');
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [dias, setDias] = useState(14);
  const [modo, setModo] = useState<'quick' | 'stages'>('quick');
  const [etapasAtivas, setEtapasAtivas] = useState<Set<EtapaDeAprovacao>>(new Set(['conteudo', 'midia', 'legenda']));
  const [textosDasEtapas, setTextosDasEtapas] = useState<Record<string, string>>({});
  const [midiasDaEtapa, setMidiasDaEtapa] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (open && card) {
      setTitulo(t => t || card.title);
      setCliente(c => c || card.client_cards?.name || '');
      setEmailCliente(e => e || card.ultimoEmail || '');
    }
  }, [open, card]);

  const alternar = (id: string) =>
    setEscolhidos(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const alternarEtapa = (e: EtapaDeAprovacao) =>
    setEtapasAtivas(prev => {
      const n = new Set(prev);
      n.has(e) ? n.delete(e) : n.add(e);
      return n;
    });
  const alternarMidia = (id: string) =>
    setMidiasDaEtapa(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const enviar = () => {
    if (!currentWorkspace?.id) return;
    const lista = (anexos ?? []).filter(a => escolhidos.has(a.id));
    const porEtapas = modo === 'stages';
    const etapas = ETAPAS_DE_APROVACAO.filter(e => etapasAtivas.has(e.chave)).map(e => ({
      stage: e.chave,
      texto: e.chave === 'midia' ? undefined : textosDasEtapas[e.chave],
      anexos: e.chave === 'midia'
        ? (anexos ?? []).filter(a => midiasDaEtapa.has(a.id)).map(a => ({ file_url: a.file_url, file_name: a.file_name, file_type: a.file_type }))
        : undefined,
    }));
    criar.mutate(
      {
        ...(porEtapas ? { etapas } : {}),
        cardId,
        workspaceId: currentWorkspace.id,
        clientId: card?.client_id ?? null,
        title: titulo || card?.title || 'Aprovação',
        message: mensagem,
        clientName: cliente,
        clientEmail: emailCliente,
        anexos: lista.map(a => ({ file_url: a.file_url, file_name: a.file_name, file_type: a.file_type })),
        texto,
        expiraEmDias: dias,
      },
      {
        onSuccess: async r => {
          onOpenChange(false);
          setEscolhidos(new Set());
          setTexto('');
          setMensagem('');
          setTextosDasEtapas({});
          setMidiasDaEtapa(new Set());
          const base: InfoLink = { link: r.link, token: r.token, requestId: r.requestId, email: emailCliente.trim() || null };
          // Se o e-mail do cliente foi informado, ja envia; se falhar, o link continua valendo e o dialogo avisa.
          if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailCliente.trim())) {
            try {
              const env = await enviarEmail.mutateAsync({ requestId: r.requestId, token: r.token, to: emailCliente.trim() });
              onCreated({ ...base, enviadoPara: env.to });
              toast.success(`E-mail enviado para ${env.to}.`);
              return;
            } catch (e: any) {
              toast.error(e?.message || 'O e-mail não foi enviado. Use o link abaixo.');
            }
          }
          onCreated(base);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Enviar ao cliente para aprovação</DialogTitle>
          <DialogDescription>O cliente vê só o que você marcar aqui. Comentários internos do card nunca aparecem para ele.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ap-titulo">Título</Label>
            <Input id="ap-titulo" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Post de lançamento" />
          </div>

          <div className="space-y-1.5">
            <Label>Como o cliente aprova</Label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modo de aprovação">
              {([
                { v: 'quick', titulo: 'Rápida', desc: 'Uma decisão só: mídia e legenda juntas.' },
                { v: 'stages', titulo: 'Em etapas', desc: 'Tema, Conteúdo, Mídia e Legenda, cada uma aprovada separada.' },
              ] as const).map(o => (
                <button
                  key={o.v}
                  type="button"
                  role="radio"
                  aria-checked={modo === o.v}
                  onClick={() => setModo(o.v)}
                  className={cn('rounded-xl border p-3 text-left transition-colors', modo === o.v ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'hover:bg-muted/50')}
                >
                  <span className="block text-sm font-semibold">{o.titulo}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{o.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {modo === 'stages' && (
            <div className="space-y-2.5">
              <Label>Etapas a enviar</Label>
              {ETAPAS_DE_APROVACAO.map(e => {
                const ativa = etapasAtivas.has(e.chave);
                return (
                  <div key={e.chave} className={cn('rounded-xl border p-3', ativa ? 'bg-card' : 'bg-muted/30')}>
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{e.rotulo}</p>
                        <p className="text-xs text-muted-foreground">{e.dica}</p>
                      </div>
                      <Switch checked={ativa} onCheckedChange={() => alternarEtapa(e.chave)} aria-label={`Enviar ${e.rotulo}`} />
                    </div>
                    {ativa && e.chave !== 'midia' && (
                      <Textarea
                        rows={e.chave === 'conteudo' || e.chave === 'legenda' ? 4 : 2}
                        className="mt-2.5"
                        value={textosDasEtapas[e.chave] ?? ''}
                        onChange={ev => setTextosDasEtapas(t => ({ ...t, [e.chave]: ev.target.value }))}
                        placeholder={`Escreva ${e.chave === 'legenda' ? 'a legenda' : e.chave === 'tema' ? 'o tema' : 'o conteúdo'} que o cliente vai aprovar.`}
                      />
                    )}
                    {ativa && e.chave === 'midia' && (
                      (anexos ?? []).length === 0 ? (
                        <p className="mt-2.5 rounded-lg border border-dashed p-2.5 text-xs text-muted-foreground">
                          Este card ainda não tem arquivos. Anexe a arte ou o vídeo em "Arquivos & Anexos".
                        </p>
                      ) : (
                        <ul className="mt-2.5 max-h-36 space-y-1 overflow-y-auto rounded-lg border p-1.5">
                          {(anexos ?? []).map(a => (
                            <li key={a.id}>
                              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/60">
                                <Checkbox checked={midiasDaEtapa.has(a.id)} onCheckedChange={() => alternarMidia(a.id)} />
                                <span className="min-w-0 flex-1 truncate text-sm">{a.file_name}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className={cn('space-y-1.5', modo === 'stages' && 'hidden')}>
            <Label>Peças do card</Label>
            {(anexos ?? []).length === 0 ? (
              <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                Este card ainda não tem arquivos. Anexe a arte ou o vídeo em "Arquivos & Anexos" ou envie só o texto abaixo.
              </p>
            ) : (
              <ul className="max-h-44 space-y-1 overflow-y-auto rounded-xl border p-1.5">
                {(anexos ?? []).map(a => (
                  <li key={a.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/60">
                      <Checkbox checked={escolhidos.has(a.id)} onCheckedChange={() => alternar(a.id)} />
                      <span className="min-w-0 flex-1 truncate text-sm">{a.file_name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={cn('space-y-1.5', modo === 'stages' && 'hidden')}>
            <Label htmlFor="ap-texto">Texto / legenda a aprovar (opcional)</Label>
            <Textarea id="ap-texto" rows={4} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Cole aqui a legenda ou o texto do post." />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ap-msg">Mensagem para o cliente (opcional)</Label>
            <Textarea id="ap-msg" rows={2} value={mensagem} onChange={e => setMensagem(e.target.value)} placeholder="Ex.: Oi! Segue o post da semana para você aprovar." />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ap-email-cli">E-mail do cliente (opcional)</Label>
            <Input id="ap-email-cli" type="email" inputMode="email" value={emailCliente} onChange={e => setEmailCliente(e.target.value)} placeholder="Se preencher, enviamos o link por e-mail" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ap-cliente">Nome do cliente</Label>
              <Input id="ap-cliente" value={cliente} onChange={e => setCliente(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-dias">O link vale por</Label>
              <select
                id="ap-dias"
                value={dias}
                onChange={e => setDias(Number(e.target.value))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value={7}>7 dias</option>
                <option value={14}>14 dias</option>
                <option value={30}>30 dias</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={criar.isPending}>
            <Send className="mr-1.5 h-4 w-4" /> {criar.isPending ? 'Criando…' : emailCliente.trim() ? 'Gerar link e enviar' : 'Gerar link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PedidoCard({ b, aberto, onNovoLink, onEditar }: { b: ApprovalBundle; aberto: boolean; onNovoLink: (info: InfoLink) => void; onEditar: (b: ApprovalBundle) => void }) {
  const { user } = useAuth();
  const renovar = useRenewApprovalLink();
  const cancelar = useCancelApproval();
  const responder = useReplyApproval();
  const [resposta, setResposta] = useState('');
  const [mostrar, setMostrar] = useState(aberto);
  const r = b.request;
  const rot = ROTULO[r.status];
  const nomeAutor = (user?.user_metadata?.full_name as string) || user?.email?.split('@')[0] || 'Equipe';

  const visto = r.view_count > 0;

  return (
    <div className="rounded-2xl border bg-card p-4">
      <button type="button" onClick={() => setMostrar(m => !m)} className="flex w-full items-start gap-3 text-left">
        <span className="mt-0.5 rounded-lg bg-muted px-2 py-1 text-[11px] font-bold tabular-nums">Rodada {r.round}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{r.title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Enviado {quando(r.created_at)}
            {r.status === 'pending' && ` · expira ${quando(r.expires_at)}`}
          </span>
        </span>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold', rot.classe)}>{rot.texto}</span>
      </button>

      {mostrar && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              {visto ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {visto ? `Visto ${r.view_count}x, última ${r.last_viewed_at ? quando(r.last_viewed_at) : ''}` : 'Ainda não visto pelo cliente'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {b.items.length} {b.items.length === 1 ? 'peça' : 'peças'}
            </span>
            {r.client_name && <span>Para: {r.client_name}</span>}
            {b.events.filter(e => e.type === 'reminder').length > 0 && (
              <span>{b.events.filter(e => e.type === 'reminder').length} {b.events.filter(e => e.type === 'reminder').length === 1 ? 'lembrete' : 'lembretes'} enviados</span>
            )}
          </div>

          {b.stages.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Etapas do pedido">
              {b.stages.map(e => (
                <li
                  key={e.id}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                    e.status === 'approved' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
                    e.status === 'changes_requested' && 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
                    e.status === 'pending' && 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
                  )}
                >
                  {rotuloDaEtapa(e.stage)}
                  <span className="font-normal opacity-80">
                    {e.status === 'approved' ? 'aprovado' : e.status === 'changes_requested' ? 'ajuste pedido' : 'pendente'}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {r.status === 'approved' && (
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Aprovado por <b>{r.decided_by_name}</b>
                {r.decided_at && ` em ${format(new Date(r.decided_at), "dd/MM/yyyy 'às' HH:mm")}`}.
                {r.certificate_hash && <span className="mt-0.5 block break-all text-[11px] opacity-70">Certificado: {r.certificate_hash.slice(0, 24)}…</span>}
              </span>
            </div>
          )}
          {r.status === 'changes_requested' && (
            <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-500/10 dark:text-rose-200">
              <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <b>{r.decided_by_name}</b> pediu ajustes{r.decided_at && ` em ${format(new Date(r.decided_at), "dd/MM/yyyy 'às' HH:mm")}`}. Veja o pedido abaixo e envie a próxima rodada quando estiver pronto.
              </span>
            </div>
          )}

          {b.items.length > 0 && (
            <ul className="space-y-1 text-sm">
              {b.items.map(i => (
                <li key={i.id} className="truncate text-muted-foreground">
                  • {i.stage ? `${rotuloDaEtapa(i.stage)}: ` : ''}{i.kind === 'text' ? `${i.stage ? '' : 'Texto: '}${(i.body ?? '').slice(0, 80)}${(i.body ?? '').length > 80 ? '…' : ''}` : i.file_name}
                </li>
              ))}
            </ul>
          )}

          {b.comments.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Conversa com o cliente</p>
              <ul className="space-y-2">
                {b.comments.map(c => (
                  <li
                    key={c.id}
                    className={cn(
                      'max-w-[92%] rounded-2xl px-3 py-2 text-sm',
                      c.author_kind === 'client' ? 'bg-amber-50 dark:bg-amber-500/10' : 'ml-auto bg-primary/10',
                    )}
                  >
                    <span className="block text-[11px] font-semibold text-muted-foreground">
                      {c.author_name} · {c.author_kind === 'client' ? 'cliente' : 'equipe'} · {quando(c.created_at)}
                    </span>
                    <span className="whitespace-pre-wrap">{c.body}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {r.status === 'pending' && (
            <>
              <div className="flex items-end gap-2">
                <Textarea
                  rows={2}
                  value={resposta}
                  onChange={e => setResposta(e.target.value)}
                  placeholder="Responder ao cliente (ele vê na página do link)"
                  className="min-h-[44px] flex-1"
                />
                <Button
                  size="sm"
                  disabled={!resposta.trim() || responder.isPending}
                  onClick={() => responder.mutate({ request: r, body: resposta, authorName: nomeAutor }, { onSuccess: () => setResposta('') })}
                >
                  Enviar
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onEditar(b)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar pedido
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={renovar.isPending}
                  onClick={() => renovar.mutate({ request: r }, { onSuccess: x => onNovoLink({ link: x.link, token: x.token, requestId: x.requestId, email: r.client_email }) })}
                >
                  <Link2 className="mr-1.5 h-3.5 w-3.5" /> Gerar novo link
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={cancelar.isPending}
                  onClick={() => window.confirm('Cancelar este pedido? O link deixa de funcionar.') && cancelar.mutate({ request: r })}
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" /> Cancelar pedido
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Painel "Aprovação do cliente" do card: envia a peça por link, acompanha a visualização, a conversa e a decisão. */
export function ClientApprovalPanel({ cardId }: { cardId: string }) {
  const { data, isLoading } = useCardApprovals(cardId);
  const [novo, setNovo] = useState(false);
  const [info, setInfo] = useState<InfoLink | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const editando = (data ?? []).find(b => b.request.id === editandoId) ?? null;

  const temAberto = useMemo(() => (data ?? []).some(b => b.request.status === 'pending'), [data]);

  if (isLoading) return <Skeleton className="h-24 w-full rounded-2xl" />;

  return (
    <div className="space-y-3">
      {(data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed p-4 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">Aprovação do cliente por link</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Envie a arte, o vídeo ou o texto. O cliente abre sem login, aprova ou pede ajustes, e você acompanha tudo aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((b, i) => (
            <PedidoCard key={b.request.id} b={b} aberto={i === 0} onNovoLink={setInfo} onEditar={x => setEditandoId(x.request.id)} />
          ))}
        </div>
      )}

      <Button size="sm" onClick={() => setNovo(true)} disabled={temAberto} title={temAberto ? 'Já existe um pedido em aberto neste card' : undefined}>
        <Send className="mr-1.5 h-4 w-4" /> {(data ?? []).length === 0 ? 'Enviar ao cliente' : 'Nova rodada'}
      </Button>

      <NovoPedidoDialog cardId={cardId} open={novo} onOpenChange={setNovo} onCreated={setInfo} />
      {editando && editando.request.status === 'pending' && (
        <EditarPedidoDialog bundle={editando} open onOpenChange={o => !o && setEditandoId(null)} />
      )}
      <LinkDialog info={info} onClose={() => setInfo(null)} />
    </div>
  );
}
