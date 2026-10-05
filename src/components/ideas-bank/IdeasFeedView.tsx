import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, Inbox, Loader2, Search, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIdeaBoards } from '@/hooks/useIdeaBoards';
import type { IdeaReference } from '@/hooks/useIdeaReferences';
import {
  FILTROS_PADRAO, STATUS_ANALISE, rotuloStatus, useIdeaFeed, useIdeaFeedTotais, useMudarStatusAnalise,
  type FiltroPlataforma, type FiltrosFeed, type StatusAnalise,
} from '@/hooks/useIdeaFeed';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ReferenceCard } from './ReferenceCard';
import { ReferenceDetailSheet } from './ReferenceDetailSheet';
import { CreateCardFromIdeaDialog } from './CreateCardFromIdeaDialog';

/**
 * Feed de referências: a visão que atravessa as pastas. O objetivo é revisar o que a equipe
 * salvou (TikTok, Instagram, YouTube, links, imagens) e marcar o que já foi analisado e o que
 * vai para campanha, sem precisar abrir pasta por pasta.
 */

const COR_STATUS: Record<StatusAnalise, string> = {
  para_analisar: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  analisado: 'bg-primary/10 text-primary',
  usar: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
};

function SeletorStatus({ valor, onMudar }: { valor: StatusAnalise; onMudar: (s: StatusAnalise) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', COR_STATUS[valor])}
          aria-label={`Status: ${rotuloStatus(valor)}. Clique para mudar`}
        >
          {rotuloStatus(valor)}
          <ChevronDown className="h-3 w-3 opacity-70" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {STATUS_ANALISE.map(s => (
          <DropdownMenuItem key={s.value} onClick={() => onMudar(s.value)} className={cn(s.value === valor && 'font-semibold')}>
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function IdeasFeedView({ onOpenBoard }: { onOpenBoard: (id: string) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<FiltrosFeed>(FILTROS_PADRAO);
  const [detail, setDetail] = useState<IdeaReference | null>(null);
  const [creatingFor, setCreatingFor] = useState<IdeaReference | null>(null);

  const { boards } = useIdeaBoards({});
  const { itens, pessoas, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useIdeaFeed(f);
  const { data: totais } = useIdeaFeedTotais();
  const mudarStatus = useMudarStatusAnalise();

  const nomePasta = useMemo(() => new Map<string, string>(boards.map(b => [b.id, b.name] as [string, string])), [boards]);

  // Nomes de todas as pessoas que já salvaram algo, para o filtro "Salvo por".
  const autoresKey = (totais?.autores ?? []).join(',');
  const { data: autores = [] } = useQuery({
    queryKey: ['idea-feed-autores', autoresKey],
    enabled: (totais?.autores.length ?? 0) > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', totais!.autores);
      return (data ?? []).map((p: any) => ({ id: p.id as string, nome: (p.full_name || p.email || 'Membro') as string }));
    },
  });

  const favoritar = useMutation({
    mutationFn: async (r: IdeaReference) => {
      const { error } = await (supabase as any).from('idea_references').update({ is_favorite: !r.is_favorite }).eq('id', r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idea-feed'] });
      qc.invalidateQueries({ queryKey: ['idea-feed-totais'] });
      qc.invalidateQueries({ queryKey: ['idea-references'] });
    },
  });

  const mudar = (parcial: Partial<FiltrosFeed>) => setF(a => ({ ...a, ...parcial }));
  const filtrosAtivos =
    (f.busca ? 1 : 0) + (f.plataforma !== 'todas' ? 1 : 0) + (f.boardId !== 'todas' ? 1 : 0) +
    (f.autorId !== 'todos' ? 1 : 0) + (f.status !== 'todos' ? 1 : 0) + (f.favoritas ? 1 : 0);

  const atalhosStatus: { chave: StatusAnalise | 'todos'; rotulo: string; n: number }[] = [
    { chave: 'todos', rotulo: 'Todas', n: totais?.total ?? 0 },
    { chave: 'para_analisar', rotulo: 'Para analisar', n: totais?.porStatus.para_analisar ?? 0 },
    { chave: 'analisado', rotulo: 'Analisadas', n: totais?.porStatus.analisado ?? 0 },
    { chave: 'usar', rotulo: 'Usar em campanha', n: totais?.porStatus.usar ?? 0 },
  ];

  const plataformas: { chave: FiltroPlataforma; rotulo: string; n?: number }[] = [
    { chave: 'todas', rotulo: 'Todas as redes' },
    { chave: 'tiktok', rotulo: 'TikTok', n: totais?.porPlataforma.tiktok },
    { chave: 'instagram', rotulo: 'Instagram', n: totais?.porPlataforma.instagram },
    { chave: 'youtube', rotulo: 'YouTube', n: totais?.porPlataforma.youtube },
    { chave: 'outros', rotulo: 'Outros', n: totais?.porPlataforma.outros },
  ];

  const selectClasse =
    'h-9 w-full min-w-0 cursor-pointer sm:w-auto rounded-lg border border-border/60 bg-card px-2.5 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Atalhos de status */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {atalhosStatus.map(a => (
            <button
              key={a.chave}
              type="button"
              onClick={() => mudar({ status: a.chave })}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                f.status === a.chave
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border/60 bg-card text-muted-foreground hover:bg-muted'
              )}
            >
              {a.rotulo} <span className="opacity-70">{a.n}</span>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
          <div className="relative col-span-2 min-w-0 sm:min-w-[200px] sm:flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="ib-feed-busca" className="sr-only">Buscar no feed</label>
            <input
              id="ib-feed-busca"
              value={f.busca}
              onChange={e => mudar({ busca: e.target.value })}
              placeholder="Buscar por título, legenda ou criador"
              className="h-9 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <select
            value={f.plataforma}
            onChange={e => mudar({ plataforma: e.target.value as FiltroPlataforma })}
            aria-label="Filtrar por rede"
            className={selectClasse}
          >
            {plataformas.map(p => (
              <option key={p.chave} value={p.chave}>
                {p.rotulo}{p.n !== undefined ? ` (${p.n})` : ''}
              </option>
            ))}
          </select>

          <select value={f.boardId} onChange={e => mudar({ boardId: e.target.value })} aria-label="Filtrar por pasta" className={selectClasse}>
            <option value="todas">Todas as pastas</option>
            {boards.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select value={f.autorId} onChange={e => mudar({ autorId: e.target.value })} aria-label="Filtrar por quem salvou" className={selectClasse}>
            <option value="todos">Salvo por: todos</option>
            {autores.map(a => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => mudar({ favoritas: !f.favoritas })}
            aria-pressed={f.favoritas}
            className={cn(
              'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors',
              f.favoritas ? 'border-amber-400/50 bg-amber-400/10 text-amber-700 dark:text-amber-400' : 'border-border/60 bg-card text-muted-foreground hover:bg-muted'
            )}
          >
            <Star className={cn('h-3.5 w-3.5', f.favoritas && 'fill-amber-400 text-amber-400')} aria-hidden="true" />
            Favoritas
          </button>

          {filtrosAtivos > 0 && (
            <button type="button" onClick={() => setF(FILTROS_PADRAO)} className="text-[13px] font-medium text-primary hover:underline">
              Limpar filtros
            </button>
          )}
        </div>

        {/* Resultado */}
        {isLoading ? (
          <div className="columns-2 gap-4 md:columns-3 lg:columns-4 xl:columns-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className={cn('mb-4 w-full rounded-xl', i % 3 === 0 ? 'h-64' : i % 2 === 0 ? 'h-48' : 'h-40')} />
            ))}
          </div>
        ) : itens.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-border/60 bg-card py-16 text-center">
            <Inbox className="mb-3 h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            <h2 className="font-semibold">{filtrosAtivos > 0 ? 'Nada com esses filtros' : 'O feed ainda está vazio'}</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {filtrosAtivos > 0
                ? 'Tente tirar algum filtro.'
                : 'Salve referências nas pastas (cole links do TikTok, Instagram ou YouTube) e elas aparecem aqui, da mais nova para a mais antiga.'}
            </p>
          </div>
        ) : (
          <>
            <div className="columns-2 gap-4 md:columns-3 lg:columns-4 xl:columns-5">
              {itens.map(r => {
                const pessoa = r.created_by ? pessoas[r.created_by] : undefined;
                return (
                  <ReferenceCard
                    key={r.id}
                    reference={r}
                    onClick={() => setDetail(r)}
                    onCreateCard={() => setCreatingFor(r)}
                    onFavorite={() => favoritar.mutate(r)}
                    pendingFavorite={favoritar.isPending && favoritar.variables?.id === r.id}
                    draggable={false}
                    extra={
                      <div className="mt-2 space-y-1.5" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                        <SeletorStatus
                          valor={(r.review_status as StatusAnalise) ?? 'para_analisar'}
                          onMudar={status => mudarStatus.mutate({ id: r.id, status })}
                        />
                        <button
                          type="button"
                          onClick={() => onOpenBoard(r.board_id)}
                          className="block max-w-full truncate text-left text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                          title="Abrir a pasta"
                        >
                          {nomePasta.get(r.board_id) ?? 'Pasta'}
                        </button>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          {pessoa && (
                            <Avatar className="h-4 w-4">
                              {pessoa.avatar && <AvatarImage src={pessoa.avatar} />}
                              <AvatarFallback className="bg-muted text-[8px] font-semibold">{pessoa.nome.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                          )}
                          <span className="truncate">
                            {pessoa ? `${pessoa.nome.split(' ')[0]} · ` : ''}
                            {formatDistanceToNow(new Date(r.created_at), { locale: ptBR, addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    }
                  />
                );
              })}
            </div>

            {hasNextPage && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="rounded-xl">
                  {isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  Carregar mais
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {detail && (
        <ReferenceDetailSheet
          reference={detail}
          boardId={detail.board_id}
          open={!!detail}
          onOpenChange={o => !o && setDetail(null)}
          onCreateCard={r => { setDetail(null); setCreatingFor(r); }}
        />
      )}
      <CreateCardFromIdeaDialog
        reference={creatingFor}
        open={!!creatingFor}
        onOpenChange={o => !o && setCreatingFor(null)}
        boardName={creatingFor ? nomePasta.get(creatingFor.board_id) : undefined}
        boardId={creatingFor?.board_id}
      />
    </TooltipProvider>
  );
}
