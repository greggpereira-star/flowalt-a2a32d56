import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Calendar, CheckCircle2, ExternalLink, MessageSquare } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { RichTextViewer, isRichTextEmpty } from '@/components/ui/rich-text-viewer';
import { CardAssignees, type Assignee } from '@/components/cards/CardAssignees';
import { statusConfig } from '@/components/cards/CardBadges';
import { useChecklists, useUpdateChecklist } from '@/hooks/useChecklists';
import { useComments } from '@/hooks/useComments';
import { EVENTO_ABRIR_PEEK, peekHover } from '@/lib/cardPeek';
import type { Card } from '@/hooks/useCards';
import type { CardStatus } from '@/lib/supabase';

interface InfoDoCard {
  clientName?: string;
  assignees: Assignee[];
}

function Conteudo({
  card,
  info,
  aoAbrirCard,
}: {
  card: Card;
  info: InfoDoCard;
  aoAbrirCard: () => void;
}) {
  const { data: itens, isLoading: carregandoChecklist } = useChecklists(card.id);
  const { data: comentarios, isLoading: carregandoComentarios } = useComments(card.id);
  const atualizar = useUpdateChecklist();

  const total = itens?.length ?? 0;
  const feitos = itens?.filter(i => i.is_completed).length ?? 0;
  const ultimos = (comentarios ?? []).slice(-3);
  const vencimento = card.due_date ? new Date(card.due_date) : null;
  const rotuloStatus = statusConfig[card.status as CardStatus]?.label ?? card.status;

  return (
    <>
      <SheetHeader className="space-y-2 border-b p-5 text-left">
        <SheetTitle className="pr-6 text-lg font-bold leading-snug">{card.title}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2 text-xs">
          {info.clientName && <span className="font-semibold text-foreground/80">{info.clientName}</span>}
          <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{rotuloStatus}</span>
          {vencimento && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(vencimento, "dd 'de' MMM · HH:mm", { locale: ptBR })}
            </span>
          )}
        </SheetDescription>
        <CardAssignees assignees={info.assignees} maxVisible={5} size="sm" />
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <section>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Descrição</h3>
          {isRichTextEmpty(card.description) ? (
            <p className="text-sm text-muted-foreground">Sem descrição.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto text-sm">
              <RichTextViewer content={card.description} />
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Checklist{total > 0 ? ` · ${feitos} de ${total}` : ''}
            </h3>
          </div>
          {carregandoChecklist ? (
            <Skeleton className="h-16 w-full" />
          ) : total === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum item de checklist.</p>
          ) : (
            <>
              <Progress value={(feitos / total) * 100} className="mb-3 h-1.5" />
              <ul className="space-y-1.5">
                {itens!.map(item => (
                  <li key={item.id} className="flex items-start gap-2.5">
                    <Checkbox
                      checked={item.is_completed}
                      disabled={atualizar.isPending}
                      onCheckedChange={v =>
                        atualizar.mutate(
                          { id: item.id, card_id: card.id, is_completed: !!v },
                          { onError: () => toast.error('Não foi possível atualizar o item') }
                        )
                      }
                      className="mt-0.5"
                      aria-label={item.title}
                    />
                    <span className={item.is_completed ? 'text-sm text-muted-foreground line-through' : 'text-sm'}>
                      {item.title}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" /> Últimos comentários
          </h3>
          {carregandoComentarios ? (
            <Skeleton className="h-16 w-full" />
          ) : ultimos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum comentário.</p>
          ) : (
            <ul className="space-y-3">
              {ultimos.map(c => (
                <li key={c.id} className="rounded-xl bg-muted/50 px-3 py-2">
                  <p className="text-xs font-bold">
                    {c.user?.full_name || 'Alguém'}
                    <span className="ml-2 font-medium text-muted-foreground">
                      {format(new Date(c.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </p>
                  <div className="mt-0.5 text-sm">
                    <RichTextViewer content={c.content} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex items-center gap-3 border-t bg-muted/30 p-4">
        <span className="text-xs text-muted-foreground">
          <kbd className="rounded border bg-background px-1.5 py-0.5 font-sans text-[10px] font-bold">Esc</kbd> fechar
        </span>
        <Button className="ml-auto gap-2" onClick={aoAbrirCard}>
          Abrir card
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}

/**
 * Visualização rápida do card (visual novo do Kanban): passe o mouse sobre um card e aperte
 * Espaço (ou use o olho na barra de atalhos) para ver descrição, checklist e comentários sem abrir
 * o card inteiro. Os itens do checklist podem ser marcados daqui. Esc fecha.
 */
export function CardPeekHost({
  cards,
  infoDe,
  aoAbrirCard,
}: {
  cards: Card[];
  infoDe: (card: Card) => InfoDoCard;
  aoAbrirCard: (card: Card) => void;
}) {
  const [cardId, setCardId] = useState<string | null>(null);

  useEffect(() => {
    const abrir = (e: Event) => setCardId((e as CustomEvent<string>).detail);

    const tecla = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      // Não rouba o Espaço de quem está digitando, de botões/menus nem de qualquer janela aberta.
      if (
        alvo?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"]')
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"]')) return;
      const sobOMouse = peekHover.atual();
      if (!sobOMouse) return;
      e.preventDefault();
      setCardId(sobOMouse);
    };

    window.addEventListener(EVENTO_ABRIR_PEEK, abrir);
    document.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener(EVENTO_ABRIR_PEEK, abrir);
      document.removeEventListener('keydown', tecla);
    };
  }, []);

  const card = cardId ? cards.find(c => c.id === cardId) : undefined;

  return (
    <Sheet open={!!card} onOpenChange={aberto => !aberto && setCardId(null)}>
      <SheetContent size="md" className="flex flex-col gap-0 p-0 sm:p-0">
        {card && (
          <Conteudo
            card={card}
            info={infoDe(card)}
            aoAbrirCard={() => {
              setCardId(null);
              aoAbrirCard(card);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
