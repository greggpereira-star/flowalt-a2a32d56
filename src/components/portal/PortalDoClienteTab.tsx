import React, { useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy, Eye, Link2, MessageCircle, Palette, ShieldOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { SECOES } from '@/lib/brandCore/campos';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { AcessoDoPortal, useAcessoDoPortal, useGerarLinkDoPortal, useMarcaDaAgencia, useRevogarPortal, useSalvarSecoesDoPortal } from '@/hooks/usePortalDoCliente';

function LinkDialog({ link, onClose }: { link: string | null; onClose: () => void }) {
  const copiar = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copiado.');
    } catch {
      toast.error('Não consegui copiar. Selecione e copie manualmente.');
    }
  };
  const whats = link ? `https://wa.me/?text=${encodeURIComponent(`Olá! Este é o seu portal, onde você acompanha e aprova o que estamos produzindo: ${link}`)}` : '#';
  return (
    <Dialog open={!!link} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Link do portal</DialogTitle>
          <DialogDescription>
            Quem tem este link vê o portal do cliente, sem login. Guarde agora: por segurança ele não fica salvo. Se perder, gere um novo, e o anterior deixa de funcionar.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-xl border bg-muted/40 p-2">
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input readOnly value={link ?? ''} onFocus={e => e.currentTarget.select()} className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" asChild>
            <a href={whats} target="_blank" rel="noreferrer"><MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp</a>
          </Button>
          <Button onClick={copiar}><Copy className="mr-1.5 h-4 w-4" /> Copiar link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SECOES_DO_PORTAL = ['diagnosis', 'persona', 'competitor', 'offer'] as const;

/** Escolhe quais secoes do Brand Core o cliente ve no portal. Tudo desligado por padrao. */
function BrandCoreNoPortal({ clientId, acesso }: { clientId: string; acesso: AcessoDoPortal | null | undefined }) {
  const salvar = useSalvarSecoesDoPortal();
  const ativas = acesso?.brand_sections ?? [];
  const alternar = (tipo: string) => salvar.mutate({ clientId, tipo, ligar: !ativas.includes(tipo) });

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h3 className="text-[15px] font-bold">Brand Core no portal</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Escolha o que o cliente enxerga do material de marca dele. Ele vê todos os campos da seção liberada, em leitura. Seções desligadas não aparecem.
        Os arquivos seguem a regra de cada pasta (Brand Core → Arquivos → "Mostrar ao cliente").
      </p>
      {!acesso ? (
        <p className="mt-4 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">Gere o link do portal acima para liberar seções.</p>
      ) : (
        <ul className="mt-4 divide-y rounded-xl border">
          {SECOES_DO_PORTAL.map(t => (
            <li key={t} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{SECOES[t].titulo}</p>
                <p className="truncate text-xs text-muted-foreground">{SECOES[t].ajuda}</p>
              </div>
              <Switch checked={ativas.includes(t)} disabled={salvar.isPending} onCheckedChange={() => alternar(t)} aria-label={`Mostrar ${SECOES[t].titulo} ao cliente`} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CorDaMarca() {
  const { isAdmin, isOwner } = usePermissions();
  const { cor, carregando, salvar } = useMarcaDaAgencia();
  const [valor, setValor] = useState('#3947df');
  useEffect(() => {
    if (cor) setValor(cor);
  }, [cor]);
  const pode = isAdmin || isOwner;

  return (
    <section className="rounded-2xl border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
        <h3 className="text-[15px] font-bold">Cor da marca</h3>
      </header>
      <p className="mb-3 text-xs text-muted-foreground">A cor da agência aparece nos botões do portal e da página de aprovação que o cliente abre. Vale para todos os clientes.</p>
      {carregando ? (
        <Skeleton className="h-10 w-48" />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <input type="color" value={valor} onChange={e => setValor(e.target.value)} disabled={!pode} aria-label="Cor da marca" className="h-10 w-14 cursor-pointer rounded-md border bg-background p-1 disabled:cursor-not-allowed" />
          <code className="rounded bg-muted px-2 py-1 text-xs">{valor}</code>
          <button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: valor, color: '#fff' }} tabIndex={-1} aria-hidden>
            Aprovar
          </button>
          {pode ? (
            <>
              <Button size="sm" disabled={salvar.isPending || valor === (cor ?? '#3947df')} onClick={() => salvar.mutate(valor)}>Salvar</Button>
              {cor && <Button size="sm" variant="ghost" disabled={salvar.isPending} onClick={() => salvar.mutate(null)}>Voltar ao padrão</Button>}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Só owner e admin mudam a cor.</span>
          )}
        </div>
      )}
    </section>
  );
}

/** Aba "Portal" do cliente: gera, renova e revoga o link magico do portal, e define a cor da marca. */
export function PortalDoClienteTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { data: acesso, isLoading } = useAcessoDoPortal(clientId);
  const gerar = useGerarLinkDoPortal();
  const revogar = useRevogarPortal();
  const [link, setLink] = useState<string | null>(null);

  const ativo = !!acesso && !acesso.revoked_at;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-5">
        <h3 className="text-[15px] font-bold">Portal de {clientName}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Uma página, sem login, onde o cliente vê o que está aguardando a resposta dele, aprova ou pede ajustes, e acompanha o calendário e o resumo do mês.
          Ele só vê peças que você já enviou para aprovação ou que já foram publicadas.
        </p>

        {isLoading ? (
          <Skeleton className="mt-4 h-16 w-full rounded-xl" />
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={ativo ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground'}>
                {ativo ? 'Link ativo' : acesso ? 'Link revogado' : 'Ainda sem link'}
              </span>
              {ativo && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" />
                  {acesso!.view_count > 0 && acesso!.last_seen_at
                    ? `Aberto ${acesso!.view_count} ${acesso!.view_count === 1 ? 'vez' : 'vezes'}, a última ${formatDistanceToNow(new Date(acesso!.last_seen_at), { addSuffix: true, locale: ptBR })}`
                    : 'Ainda não foi aberto'}
                </span>
              )}
              {acesso && <span className="text-xs text-muted-foreground">· criado em {format(new Date(acesso.created_at), 'dd/MM/yyyy')}</span>}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                disabled={gerar.isPending}
                onClick={() =>
                  (!acesso || !ativo || window.confirm('Gerar um novo link? O link atual deixa de funcionar e o cliente precisa receber o novo.')) &&
                  gerar.mutate({ clientId, jaExiste: !!acesso }, { onSuccess: r => setLink(r.link) })
                }
              >
                <Link2 className="mr-1.5 h-4 w-4" /> {!acesso ? 'Gerar link do portal' : ativo ? 'Gerar novo link' : 'Reativar com novo link'}
              </Button>
              {ativo && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={revogar.isPending}
                  onClick={() => window.confirm('Revogar o link? O cliente deixa de abrir o portal na hora.') && revogar.mutate({ clientId })}
                >
                  <ShieldOff className="mr-1.5 h-4 w-4" /> Revogar
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      <BrandCoreNoPortal clientId={clientId} acesso={acesso} />
      <CorDaMarca />
      <LinkDialog link={link} onClose={() => setLink(null)} />
    </div>
  );
}
