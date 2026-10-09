import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarCheck, CalendarX2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SocialPostButton } from '@/components/social-media/SocialPostButton';
import { useCardCustomFields } from '@/hooks/useSocialMediaTemplates';
import { useSocialPostsByCard } from '@/hooks/useSocialPosts';
import { ApprovalBundle } from '@/hooks/useApprovals';

const ROTULO_POST: Record<string, string> = {
  draft: 'Rascunho criado',
  pending_approval: 'Aguardando aprovação',
  scheduled: 'Agendado',
  publishing: 'Publicando',
  published: 'Publicado',
  failed: 'Falhou ao publicar',
  error: 'Falhou ao publicar',
};

/** Texto da legenda aprovada: a etapa Legenda, ou o texto do pedido rapido. */
export function legendaAprovada(b: ApprovalBundle): string {
  const textos = b.items.filter(i => i.kind === 'text' && (b.request.mode === 'stages' ? i.stage === 'legenda' : true));
  return textos.map(i => i.body ?? '').filter(Boolean).join('\n\n').trim();
}

/**
 * Pedido aprovado pelo cliente: o post fica "pronto para agendar" e a equipe confirma o agendamento.
 * Nada e agendado sozinho. Quando ja existe uma postagem do card em andamento ou publicada, mostra o estado dela.
 */
export function ProntoParaAgendar({ cardId, clientId, bundle }: { cardId: string; clientId?: string | null; bundle: ApprovalBundle }) {
  const { data: posts } = useSocialPostsByCard(cardId);
  const { data: campos } = useCardCustomFields(cardId);

  const legenda = useMemo(() => legendaAprovada(bundle), [bundle]);
  const midias = bundle.items.filter(i => i.kind !== 'text').length;
  const dataDePostagem = campos?.find(c => c.field_key === 'post_date')?.field_value || null;
  const dataFormatada = useMemo(() => {
    if (!dataDePostagem || !/^\d{4}-\d{2}-\d{2}/.test(dataDePostagem)) return null;
    const [a, m, d] = dataDePostagem.slice(0, 10).split('-').map(Number);
    return format(new Date(a, m - 1, d), 'dd/MM/yyyy');
  }, [dataDePostagem]);

  // Postagem do card que ja saiu do rascunho: o pedido nao precisa mais chamar a equipe.
  const andamento = (posts ?? []).find(p => ['scheduled', 'publishing', 'published'].includes(p.status));
  if (andamento) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-violet-50 p-3 text-sm text-violet-900 dark:bg-violet-500/10 dark:text-violet-200">
        <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span><b>{ROTULO_POST[andamento.status] ?? andamento.status}.</b> Este conteúdo já tem postagem criada para as redes sociais.</span>
      </div>
    );
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(legenda);
      toast.success('Legenda copiada.');
    } catch {
      toast.error('Não consegui copiar. Selecione e copie manualmente.');
    }
  };
  const rascunho = (posts ?? []).find(p => p.status === 'draft');

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CalendarCheck className="h-4 w-4 text-primary" /> Pronto para agendar
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">O cliente aprovou. Confira e confirme o agendamento: nada é agendado sozinho.</p>

      <dl className="mt-3 space-y-1.5 text-xs">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 font-semibold text-muted-foreground">Legenda</dt>
          <dd className="min-w-0 flex-1 line-clamp-2 whitespace-pre-wrap">{legenda || 'Sem legenda no pedido aprovado.'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 font-semibold text-muted-foreground">Mídia</dt>
          <dd>{midias > 0 ? `${midias} ${midias === 1 ? 'arquivo aprovado' : 'arquivos aprovados'}` : 'Nenhuma mídia no pedido'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 font-semibold text-muted-foreground">Postagem</dt>
          <dd className={dataFormatada ? '' : 'inline-flex items-center gap-1 text-amber-700 dark:text-amber-400'}>
            {dataFormatada ?? <><CalendarX2 className="h-3 w-3" /> Sem data definida no card</>}
          </dd>
        </div>
      </dl>

      {rascunho && <p className="mt-3 text-xs text-muted-foreground">Já existe um rascunho deste conteúdo no menu Marketing.</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <SocialPostButton cardId={cardId} clientId={clientId} rotulo="Preparar postagem" legendaInicial={legenda} />
        {legenda && (
          <Button size="sm" variant="ghost" onClick={copiar}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar legenda
          </Button>
        )}
      </div>
    </div>
  );
}
