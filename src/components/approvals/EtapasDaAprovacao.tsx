import React from 'react';
import { format } from 'date-fns';
import { CheckCircle2, ExternalLink, FileText, MessageSquareWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ETAPAS_DE_APROVACAO, EtapaDeAprovacao } from '@/hooks/useApprovals';
import { MidiaDaPrevia, PreviaInstagram } from './PreviaInstagram';

export interface PecaPublica {
  id: string;
  kind: 'image' | 'video' | 'document' | 'text' | 'link';
  stage: EtapaDeAprovacao | null;
  caption: string | null;
  file_name: string | null;
  body: string | null;
  url: string | null;
}
export interface EtapaPublica {
  stage: EtapaDeAprovacao;
  status: 'pending' | 'approved' | 'changes_requested';
  decided_at: string | null;
  decided_by_name: string | null;
}

const SELO: Record<EtapaPublica['status'], { rotulo: string; classe: string }> = {
  pending: { rotulo: 'Pendente', classe: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  approved: { rotulo: 'Aprovado', classe: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' },
  changes_requested: { rotulo: 'Ajuste pedido', classe: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300' },
};

interface Props {
  etapas: EtapaPublica[];
  pecas: PecaPublica[];
  /** O pedido inteiro ainda aceita decisoes. */
  aberto: boolean;
  etapaAtiva: EtapaDeAprovacao;
  onEscolher: (e: EtapaDeAprovacao) => void;
  onAprovar: () => void;
  onAjustes: () => void;
  cliente: string;
  agencia: string | null;
  logoUrl: string | null;
}

/** Visao do cliente no pedido por etapas: previa do post de um lado, as etapas e a decisao de cada uma do outro. */
export function EtapasDaAprovacao({ etapas, pecas, aberto, etapaAtiva, onEscolher, onAprovar, onAjustes, cliente, agencia, logoUrl }: Props) {
  const rotulo = (e: EtapaDeAprovacao) => ETAPAS_DE_APROVACAO.find(x => x.chave === e)?.rotulo ?? e;
  const ativa = etapas.find(e => e.stage === etapaAtiva) ?? etapas[0];
  const pecasDaAtiva = pecas.filter(p => p.stage === ativa?.stage);
  const respondidas = etapas.filter(e => e.status !== 'pending').length;

  // A previa junta o que o cliente ja recebeu: midias de qualquer etapa e a legenda (etapa Legenda, ou o texto do pedido).
  const midias: MidiaDaPrevia[] = pecas
    .filter((p): p is PecaPublica & { kind: 'image' | 'video'; url: string } => (p.kind === 'image' || p.kind === 'video') && !!p.url)
    .map(p => ({ kind: p.kind, url: p.url }));
  const legenda = pecas.find(p => p.stage === 'legenda' && p.kind === 'text')?.body ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-6">
        <PreviaInstagram nome={cliente} subtitulo={agencia} logoUrl={logoUrl} midias={midias} legenda={legenda} />
      </div>

      <div className="space-y-4">
        <ul className={cn('grid gap-2.5', etapas.length >= 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2')} role="tablist" aria-label="Etapas do conteúdo">
          {etapas.map(e => {
            const selo = SELO[e.status];
            const sel = e.stage === ativa?.stage;
            return (
              <li key={e.stage}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={sel}
                  onClick={() => onEscolher(e.stage)}
                  className={cn(
                    'flex h-full w-full flex-col items-center gap-1.5 rounded-2xl border bg-card px-3 py-3.5 text-center transition-shadow',
                    sel ? 'border-primary ring-2 ring-primary/25' : 'hover:shadow-sm',
                  )}
                >
                  <span className="text-sm font-semibold">{rotulo(e.stage)}</span>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', selo.classe)}>{selo.rotulo}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {ativa && (
          <section className="rounded-2xl border bg-card p-4 sm:p-5" aria-label={`Etapa ${rotulo(ativa.stage)}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold">{rotulo(ativa.stage)}</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {respondidas} de {etapas.length} {etapas.length === 1 ? 'etapa respondida' : 'etapas respondidas'}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {pecasDaAtiva.length === 0 && <p className="text-sm text-muted-foreground">Nada nesta etapa.</p>}
              {pecasDaAtiva.map(p => (
                <figure key={p.id} className="overflow-hidden rounded-xl border bg-background">
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
            </div>

            {ativa.status !== 'pending' && (
              <p
                className={cn(
                  'mt-4 flex items-start gap-2 rounded-xl p-3 text-sm',
                  ativa.status === 'approved'
                    ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200'
                    : 'bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-200',
                )}
              >
                {ativa.status === 'approved' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>
                  {ativa.status === 'approved' ? 'Etapa aprovada' : 'Ajuste pedido nesta etapa'}
                  {ativa.decided_by_name && <> por <b>{ativa.decided_by_name}</b></>}
                  {ativa.decided_at && <> em {format(new Date(ativa.decided_at), "dd/MM 'às' HH:mm")}</>}.
                </span>
              </p>
            )}

            {aberto && ativa.status === 'pending' && (
              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={onAjustes}>
                  Pedir ajuste
                </Button>
                <Button className="h-11 flex-1 rounded-xl" onClick={onAprovar}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Aprovar {rotulo(ativa.stage).toLowerCase()}
                </Button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
