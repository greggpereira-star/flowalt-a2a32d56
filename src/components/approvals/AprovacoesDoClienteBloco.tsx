import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Eye, EyeOff, MessageSquareWarning } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CardDetailSheet } from '@/components/cards/CardDetailSheet';
import { Bloco } from '@/components/dashboard/pecas';
import { useApprovalsOverview } from '@/hooks/useApprovals';
import { FEATURE_FLAGS, useFeatureFlags } from '@/hooks/useFeatureFlags';
import { cn } from '@/lib/utils';

const quando = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });

function Numero({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: 'alerta' | 'bom' }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2.5">
      <p className="text-[11px] font-medium text-muted-foreground">{rotulo}</p>
      <p className={cn('mt-0.5 text-xl font-bold tabular-nums', tom === 'alerta' && valor > 0 && 'text-amber-600', tom === 'bom' && valor > 0 && 'text-emerald-600')}>
        {valor}
      </p>
    </div>
  );
}

/**
 * Coordenação: o que está parado esperando o cliente ou esperando a equipe preparar a próxima rodada.
 * Só aparece com a chave client_approval ligada e quando há pedidos nos últimos 60 dias.
 */
export function AprovacoesDoClienteBloco() {
  const { isEnabled } = useFeatureFlags();
  const ligada = isEnabled(FEATURE_FLAGS.CLIENT_APPROVAL);
  const { data, isLoading } = useApprovalsOverview(ligada);
  const [cardAberto, setCardAberto] = useState<string | null>(null);

  if (!ligada) return null;
  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (!data || (data.aguardando.length === 0 && data.ajustes.length === 0 && data.aprovados7d === 0)) return null;

  return (
    <>
      <Bloco titulo="Aprovações do cliente" subtitulo="Peças que dependem de uma resposta do cliente ou de uma nova rodada da equipe">
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Numero rotulo="Aguardando o cliente" valor={data.aguardando.length} />
          <Numero rotulo="Sem resposta há 2+ dias" valor={data.semRespostaHa2Dias} tom="alerta" />
          <Numero rotulo="Ajustes a preparar" valor={data.ajustes.length} tom="alerta" />
          <Numero rotulo="Aprovados em 7 dias" valor={data.aprovados7d} tom="bom" />
        </div>

        <ul className="divide-y divide-border/60">
          {data.ajustes.map(a => (
            <li key={a.id}>
              <button type="button" onClick={() => setCardAberto(a.card_id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                <MessageSquareWarning className="h-4 w-4 shrink-0 text-rose-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{a.cards?.title ?? a.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {a.client_name ? `${a.client_name} · ` : ''}Rodada {a.round} · ajustes pedidos {a.decided_at ? quando(a.decided_at) : ''}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
                  Preparar nova rodada
                </span>
              </button>
            </li>
          ))}
          {data.aguardando.map(a => (
            <li key={a.id}>
              <button type="button" onClick={() => setCardAberto(a.card_id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                {a.view_count > 0 ? <Eye className="h-4 w-4 shrink-0 text-amber-500" /> : <EyeOff className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{a.cards?.title ?? a.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {a.client_name ? `${a.client_name} · ` : ''}Rodada {a.round} · enviado {quando(a.created_at)}
                    {a.reminder_count > 0 ? ` · ${a.reminder_count} ${a.reminder_count === 1 ? 'lembrete' : 'lembretes'}` : ''}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                    a.view_count > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {a.view_count > 0 ? 'Visto, sem resposta' : 'Não visto'}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {data.aguardando.length === 0 && data.ajustes.length === 0 && (
          <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Nada parado: nenhuma peça aguarda o cliente.
          </p>
        )}
      </Bloco>

      <CardDetailSheet cardId={cardAberto || undefined} open={!!cardAberto} onOpenChange={aberto => !aberto && setCardAberto(null)} />
    </>
  );
}
