import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { IdeaReference, useIdeaReferences } from '@/hooks/useIdeaReferences';
import { getTypeMeta } from './types';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink, Star, Trash2, MessageSquarePlus, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { STATUS_ANALISE, useMudarStatusAnalise, type StatusAnalise } from '@/hooks/useIdeaFeed';
import { AnalysisPanel } from './AnalysisPanel';
import { ResumoDaIdeia } from './ResumoDaIdeia';
import { incorporacaoDe, ROTULO_PLATAFORMA, type Plataforma } from '@/lib/ideas/embed';

interface Props {
  reference: IdeaReference | null;
  boardId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreateCard: (ref: IdeaReference) => void;
}

const COR_ETAPA: Record<StatusAnalise, string> = {
  para_analisar: 'bg-slate-400',
  analisado: 'bg-sky-500',
  usar: 'bg-emerald-500',
};

const Secao: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <section className="space-y-2.5">
    <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
    {children}
  </section>
);

export const ReferenceDetailSheet: React.FC<Props> = ({ reference, boardId, open, onOpenChange, onCreateCard }) => {
  const { remove, toggleFavorite } = useIdeaReferences(boardId);
  const mudarStatus = useMudarStatusAnalise();
  const [aba, setAba] = useState<'detalhes' | 'analise'>('detalhes');
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  useEffect(() => { setAba('detalhes'); }, [reference?.id]);
  const [statusLocal, setStatusLocal] = useState<StatusAnalise>((reference?.review_status as StatusAnalise) ?? 'para_analisar');
  useEffect(() => {
    setStatusLocal(((reference?.review_status as StatusAnalise) ?? 'para_analisar'));
  }, [reference?.id, reference?.review_status]);

  const { data: linkedCards } = useQuery({
    queryKey: ['idea-card-links', reference?.id],
    enabled: !!reference?.id && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('idea_card_links')
        .select('card_id, cards(id,title,status)')
        .eq('reference_id', reference!.id);
      if (error) throw error;
      return data || [];
    },
  });

  if (!reference) return null;
  const meta = getTypeMeta(reference.type);
  const Icon = meta.icon;
  const img = reference.media_url || reference.thumbnail_url;
  const emb = incorporacaoDe(reference);
  const plataforma = reference.platform ? ROTULO_PLATAFORMA[reference.platform as Plataforma] : null;
  const temMidia = !!emb || (!!img && !reference.platform);

  const midia = (
    <div className="space-y-2">
      {emb ? (
        <>
          <iframe
            src={emb.src}
            title={reference.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className={cn(
              'block w-full rounded-xl border-0 bg-muted/40',
              emb.formato === 'horizontal' && 'aspect-video'
            )}
            style={emb.formato === 'vertical' ? { height: 'min(56vh, 520px)' } : undefined}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Player oficial de {plataforma}. Se o criador apagar a publicação, o vídeo deixa de tocar; título e miniatura continuam salvos.
          </p>
        </>
      ) : img && reference.type === 'video' ? (
        <video src={img} controls preload="metadata" className="mx-auto block h-auto max-h-[min(56vh,520px)] w-auto max-w-full rounded-xl bg-black" />
      ) : img ? (
        <img src={img} alt={reference.title} className="mx-auto block h-auto max-h-[min(56vh,520px)] w-auto max-w-full rounded-xl" />
      ) : null}
    </div>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent size="xl" className="flex flex-col gap-0 overflow-hidden p-0 sm:p-0">
          {/* Cabeçalho */}
          <header className="shrink-0 px-6 pt-6 sm:px-8 sm:pt-7">
            <div className="flex items-center justify-between gap-3 pr-11">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="secondary" className="gap-1.5 font-medium"><Icon className="h-3.5 w-3.5" />{meta.label}</Badge>
                {plataforma && <span className="text-sm text-muted-foreground">{plataforma}</span>}
              </div>
              <Button
                size="icon" variant="ghost"
                onClick={() => toggleFavorite.mutate(reference)}
                aria-pressed={!!reference.is_favorite}
                aria-label={reference.is_favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                className={cn('h-9 w-9 rounded-full', reference.is_favorite ? 'text-amber-500' : 'text-muted-foreground')}
              >
                <Star className={cn('h-[18px] w-[18px]', reference.is_favorite && 'fill-current')} />
              </Button>
            </div>

            <SheetTitle className="mt-3 text-balance text-2xl font-semibold leading-tight tracking-tight">
              {reference.title}
            </SheetTitle>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {reference.author_name && (
                <>
                  Por{' '}
                  {reference.author_url ? (
                    <a href={reference.author_url} target="_blank" rel="noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">
                      {reference.author_name}
                    </a>
                  ) : (
                    <span className="font-medium text-foreground">{reference.author_name}</span>
                  )}
                  <span aria-hidden className="mx-2">·</span>
                </>
              )}
              Salva em {format(new Date(reference.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>

            <div className="mt-5 flex gap-6 border-b border-border/70" role="tablist" aria-label="Seções da referência">
              {([['detalhes', 'Detalhes'], ['analise', 'Análise e roteiros']] as const).map(([chave, rotulo]) => (
                <button
                  key={chave}
                  type="button"
                  role="tab"
                  aria-selected={aba === chave}
                  onClick={() => setAba(chave)}
                  className={cn(
                    '-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    aba === chave ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </header>

          {/* Conteúdo com rolagem própria */}
          <div key={aba} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 [will-change:scroll-position] sm:px-8 sm:py-8">
            {aba === 'analise' ? (
              <AnalysisPanel reference={reference} onCriarCard={onCreateCard} />
            ) : (
              <div className={cn('grid gap-8', temMidia && 'lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-10')}>
                {temMidia && <div className="lg:self-start">{midia}</div>}

                <div className="min-w-0 space-y-8">
                  <Secao titulo="Etapa no feed">
                    <p className="-mt-1 text-sm text-muted-foreground">Organiza esta ideia no feed e nos filtros do topo. A mudança vale na hora.</p>
                    <div
                      role="radiogroup"
                      aria-label="Etapa no feed"
                      className="grid grid-cols-1 gap-1 rounded-xl bg-muted/60 p-1 sm:grid-cols-3"
                    >
                      {STATUS_ANALISE.map(st => {
                        const ativo = statusLocal === st.value;
                        return (
                          <button
                            key={st.value}
                            type="button"
                            role="radio"
                            aria-checked={ativo}
                            onClick={() => {
                              setStatusLocal(st.value);
                              mudarStatus.mutate({ id: reference.id, status: st.value });
                            }}
                            className={cn(
                              'flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              ativo ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60' : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <span className={cn('h-2 w-2 rounded-full', COR_ETAPA[st.value], !ativo && 'opacity-50')} aria-hidden />
                            {st.label}
                          </button>
                        );
                      })}
                    </div>
                  </Secao>

                  <ResumoDaIdeia reference={reference} onAbrirAnalise={() => setAba('analise')} />

                  {reference.description && (
                    <Secao titulo="Descrição">
                      <p className="max-w-[68ch] whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{reference.description}</p>
                    </Secao>
                  )}

                  {reference.file_url && (
                    <a
                      href={reference.file_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-border/70 p-3.5 transition-colors hover:bg-muted/40"
                    >
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm">{reference.file_name || 'Abrir arquivo'}</span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  )}

                  {reference.tags?.length > 0 && (
                    <Secao titulo="Tags">
                      <div className="flex flex-wrap gap-1.5">
                        {reference.tags.map(t => <Badge key={t} variant="outline" className="font-normal">{t}</Badge>)}
                      </div>
                    </Secao>
                  )}

                  {(reference.ai_summary || reference.ai_tags?.length) ? (
                    <section className="space-y-2 rounded-xl border border-primary/15 bg-primary/5 p-4">
                      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                        <Sparkles className="h-3.5 w-3.5" /> Sugestões inteligentes
                      </h3>
                      {reference.ai_summary && <p className="text-sm leading-relaxed">{reference.ai_summary}</p>}
                      {reference.ai_tags && (
                        <div className="flex flex-wrap gap-1.5">
                          {reference.ai_tags.map(t => <Badge key={t} variant="secondary" className="text-xs font-normal">{t}</Badge>)}
                        </div>
                      )}
                    </section>
                  ) : null}

                  {linkedCards && linkedCards.length > 0 && (
                    <Secao titulo="Cards criados a partir desta ideia">
                      <ul className="space-y-1.5">
                        {linkedCards.map((l: any) => (
                          <li key={l.card_id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5 text-sm">
                            <span className="truncate">{l.cards?.title || 'Card'}</span>
                            <Badge variant="outline" className="shrink-0 text-[11px] font-normal">{l.cards?.status}</Badge>
                          </li>
                        ))}
                      </ul>
                    </Secao>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Ações sempre à mão: a principal à direita, a destrutiva isolada à esquerda */}
          <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border/70 bg-background px-6 py-4 sm:px-8">
            <Button
              variant="ghost" size="sm"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmarExclusao(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />Excluir
            </Button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {reference.source_url && (
                <Button variant="outline" onClick={() => window.open(reference.source_url!, '_blank', 'noopener')}>
                  <ExternalLink className="mr-2 h-4 w-4" />Abrir original
                </Button>
              )}
              <Button onClick={() => onCreateCard(reference)}>
                <MessageSquarePlus className="mr-2 h-4 w-4" />Criar card
              </Button>
            </div>
          </footer>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmarExclusao} onOpenChange={setConfirmarExclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta referência?</AlertDialogTitle>
            <AlertDialogDescription>
              “{reference.title}” sai do banco de ideias, junto com a análise, os roteiros e os comentários ligados a ela. Os cards já criados continuam existindo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => remove.mutate(reference.id, { onSuccess: () => onOpenChange(false) })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
