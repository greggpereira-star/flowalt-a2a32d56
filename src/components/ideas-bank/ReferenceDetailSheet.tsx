import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { IdeaReference, useIdeaReferences } from '@/hooks/useIdeaReferences';
import { getTypeMeta } from './types';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ExternalLink, Star, Trash2, MessageSquarePlus, Sparkles, Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Props {
  reference: IdeaReference | null;
  boardId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreateCard: (ref: IdeaReference) => void;
}

export const ReferenceDetailSheet: React.FC<Props> = ({ reference, boardId, open, onOpenChange, onCreateCard }) => {
  const { remove, toggleFavorite } = useIdeaReferences(boardId);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        <div className="p-6 pb-4">
          <SheetHeader className="mb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <Badge variant="secondary" className="mb-2"><Icon className="h-3 w-3 mr-1" />{meta.label}</Badge>
                <SheetTitle className="text-xl">{reference.title}</SheetTitle>
              </div>
              <Button
                size="icon" variant="ghost"
                onClick={() => toggleFavorite.mutate(reference)}
                className={cn(reference.is_favorite && 'text-amber-500')}
              >
                <Star className={cn('h-4 w-4', reference.is_favorite && 'fill-current')} />
              </Button>
            </div>
          </SheetHeader>

          {img && (
            reference.type === 'video' ? (
              <video src={img} controls className="w-full rounded-lg mb-4" />
            ) : (
              <img src={img} alt={reference.title} className="w-full rounded-lg mb-4" />
            )
          )}

          {reference.file_url && (
            <a
              href={reference.file_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 p-3 border rounded-lg mb-4 hover:bg-muted/30"
            >
              <Icon className="h-5 w-5" />
              <span className="flex-1 text-sm truncate">{reference.file_name || 'Abrir arquivo'}</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          )}

          {reference.description && (
            <div className="mb-4">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Descrição</h4>
              <p className="text-sm whitespace-pre-wrap">{reference.description}</p>
            </div>
          )}

          {reference.source_url && (
            <Button
              variant="outline" size="sm" className="w-full mb-4"
              onClick={() => window.open(reference.source_url!, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir link original
            </Button>
          )}

          {reference.tags?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Tags</h4>
              <div className="flex flex-wrap gap-1.5">
                {reference.tags.map(t => <Badge key={t} variant="outline">{t}</Badge>)}
              </div>
            </div>
          )}

          {reference.ai_summary || reference.ai_tags?.length ? (
            <div className="mb-4 p-3 rounded-lg border bg-primary/5">
              <h4 className="text-xs uppercase tracking-wider text-primary mb-1.5 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Sugestões inteligentes
              </h4>
              {reference.ai_summary && <p className="text-sm mb-2">{reference.ai_summary}</p>}
              {reference.ai_tags && (
                <div className="flex flex-wrap gap-1">
                  {reference.ai_tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                </div>
              )}
            </div>
          ) : null}

          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-4">
            <Calendar className="h-3 w-3" />
            {format(new Date(reference.created_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}
          </div>

          {linkedCards && linkedCards.length > 0 && (
            <>
              <Separator className="my-4" />
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Cards criados a partir desta ideia
              </h4>
              <div className="space-y-1.5 mb-4">
                {linkedCards.map((l: any) => (
                  <div key={l.card_id} className="p-2 border rounded text-sm flex justify-between">
                    <span className="truncate">{l.cards?.title || 'Card'}</span>
                    <Badge variant="outline" className="text-[10px]">{l.cards?.status}</Badge>
                  </div>
                ))}
              </div>
            </>
          )}

          <Separator className="my-4" />

          <div className="flex flex-col gap-2">
            <Button onClick={() => onCreateCard(reference)}>
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              Criar card a partir desta ideia
            </Button>
            <Button
              variant="ghost" className="text-destructive"
              onClick={() => {
                if (confirm('Excluir esta referência?')) {
                  remove.mutate(reference.id, { onSuccess: () => onOpenChange(false) });
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />Excluir
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
