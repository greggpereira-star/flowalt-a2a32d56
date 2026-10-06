import React, { useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CircleDot, Image as ImageIcon, Layers, Megaphone, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CardDetailSheet } from '@/components/cards/CardDetailSheet';
import { FEATURE_FLAGS, useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useUpdateCardCustomFields } from '@/hooks/useSocialMediaTemplates';
import { SituacaoDoPost, PostDoFeed, useClientesDoFeed, useFeedEditorial } from '@/hooks/useFeedEditorial';
import { chaveMes } from '@/lib/feed/situacao-do-post';
import { cn } from '@/lib/utils';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const SITUACAO: Record<SituacaoDoPost, { rotulo: string; chip: string; ponto: string; fundo: string }> = {
  planejado: { rotulo: 'Planejado', chip: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300', ponto: 'bg-slate-400', fundo: 'from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800' },
  em_producao: { rotulo: 'Em produção', chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300', ponto: 'bg-amber-500', fundo: 'from-amber-100 to-amber-200 dark:from-amber-900/50 dark:to-amber-800/40' },
  em_aprovacao: { rotulo: 'Em aprovação', chip: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300', ponto: 'bg-sky-500', fundo: 'from-sky-100 to-sky-200 dark:from-sky-900/50 dark:to-sky-800/40' },
  aprovado: { rotulo: 'Aprovado', chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300', ponto: 'bg-emerald-500', fundo: 'from-emerald-100 to-emerald-200 dark:from-emerald-900/50 dark:to-emerald-800/40' },
  publicado: { rotulo: 'Publicado', chip: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300', ponto: 'bg-violet-500', fundo: 'from-violet-100 to-violet-200 dark:from-violet-900/50 dark:to-violet-800/40' },
};
const ORDEM: SituacaoDoPost[] = ['planejado', 'em_producao', 'em_aprovacao', 'aprovado', 'publicado'];

const TIPOS: Record<string, { rotulo: string; Icone: React.ComponentType<{ className?: string }> }> = {
  post: { rotulo: 'Post', Icone: ImageIcon },
  story: { rotulo: 'Story', Icone: CircleDot },
  reels: { rotulo: 'Reels', Icone: Play },
  video: { rotulo: 'Vídeo', Icone: Play },
  carousel: { rotulo: 'Carrossel', Icone: Layers },
  ad: { rotulo: 'Anúncio', Icone: Megaphone },
};
const tipoDe = (t: string | null) => TIPOS[t ?? ''] ?? { rotulo: 'Peça', Icone: ImageIcon };

const diaMes = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;
const iniciais = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';

function Quadro({ post, onAbrir }: { post: PostDoFeed; onAbrir: () => void }) {
  const s = SITUACAO[post.situacao];
  const { Icone } = tipoDe(post.tipo);
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`${post.titulo}, ${s.rotulo}${post.data ? `, ${diaMes(post.data)}` : ''}`}
      className="group relative aspect-[3/4] overflow-hidden rounded-md text-left outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
    >
      {post.miniatura ? (
        <img src={post.miniatura} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
      ) : (
        <div className={cn('absolute inset-0 flex items-center justify-center bg-gradient-to-br p-2', s.fundo)}>
          <p className="line-clamp-5 text-center text-[11px] font-semibold leading-snug text-foreground/70">{post.titulo}</p>
        </div>
      )}
      <span className="absolute left-1.5 top-1.5 rounded-md bg-black/55 p-1 text-white"><Icone className="h-3 w-3" /></span>
      <span className={cn('absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white/80', s.ponto)} />
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/65 to-transparent px-1.5 pb-1 pt-6 text-[10.5px] font-bold text-white">
        <span>{post.data ? diaMes(post.data) : ''}</span>
        {post.aprovacao === 'aprovado' && <span>✓ cliente</span>}
        {post.aprovacao === 'ajustes' && <span>ajustes</span>}
      </span>
    </button>
  );
}

export default function FeedEditorialPage() {
  const { isEnabled, isReady } = useFeatureFlags();
  const ligada = isEnabled(FEATURE_FLAGS.EDITORIAL_FEED);
  const [params, setParams] = useSearchParams();
  const { data: clientes, isLoading: carregandoClientes } = useClientesDoFeed();
  const qc = useQueryClient();
  const atualizarCampos = useUpdateCardCustomFields();
  const [cardAberto, setCardAberto] = useState<string | null>(null);

  const hoje = new Date();
  const mesParam = /^(\d{4})-(\d{2})$/.exec(params.get('mes') ?? '');
  const ano = mesParam ? Number(mesParam[1]) : hoje.getFullYear();
  const mes0 = mesParam ? Math.min(11, Math.max(0, Number(mesParam[2]) - 1)) : hoje.getMonth();
  const clienteId = params.get('cliente') ?? clientes?.[0]?.id ?? null;
  const cliente = clientes?.find(c => c.id === clienteId) ?? null;

  const { doCiclo, gaveta, contagem, total, carregando, erro } = useFeedEditorial(ligada ? clienteId : null, ano, mes0);

  const aprovadosOuPublicados = contagem.aprovado + contagem.publicado;
  const progresso = total ? Math.round((aprovadosOuPublicados / total) * 100) : 0;

  const mudarParam = (chave: string, valor: string | null) => {
    const p = new URLSearchParams(params);
    if (valor) p.set(chave, valor); else p.delete(chave);
    setParams(p, { replace: true });
  };
  const irPara = (delta: number) => {
    const d = new Date(ano, mes0 + delta, 1);
    mudarParam('mes', chaveMes(d.getFullYear(), d.getMonth()));
  };

  const definirData = (cardId: string, data: string) => {
    if (!data) return;
    atualizarCampos.mutate(
      { cardId, fields: { post_date: data } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['feed-editorial'] });
          toast.success('Data de postagem definida.');
        },
        onError: (e: any) => toast.error(e?.message || 'Não foi possível definir a data.'),
      },
    );
  };

  const grade = useMemo(() => doCiclo, [doCiclo]);

  if (!isReady) return <div className="p-6"><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  if (!ligada) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-6 sm:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight sm:text-[30px]">Feed editorial</h1>
          <p className="mt-1 text-sm text-muted-foreground">Como a linha editorial do cliente vai ficar no perfil, mês a mês.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Cliente"
            value={clienteId ?? ''}
            onChange={e => mudarParam('cliente', e.target.value || null)}
            className="h-10 min-w-[200px] rounded-lg border bg-background px-3 text-sm font-medium"
          >
            {(clientes ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="inline-flex items-center rounded-lg border bg-card">
            <button type="button" onClick={() => irPara(-1)} aria-label="Mês anterior" className="rounded-l-lg p-2.5 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-[132px] px-2 text-center text-sm font-semibold capitalize">{MESES[mes0]} {ano}</span>
            <button type="button" onClick={() => irPara(1)} aria-label="Próximo mês" className="rounded-r-lg p-2.5 hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      {carregandoClientes ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : !cliente ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhum cliente ativo. Cadastre um cliente para montar o feed.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
          <section aria-label="Prévia do feed" className="min-w-0 rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-3">
              <Avatar className="h-12 w-12">
                {cliente.logo_url && <AvatarImage src={cliente.logo_url} alt="" />}
                <AvatarFallback className="font-semibold">{iniciais(cliente.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-base font-bold">{cliente.name}</p>
                <p className="text-xs text-muted-foreground">Ciclo de <span className="capitalize">{MESES[mes0]}</span> · {total} {total === 1 ? 'post' : 'posts'}</p>
              </div>
            </div>

            {carregando ? (
              <div className="grid grid-cols-3 gap-1">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-md" />)}</div>
            ) : erro ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Não foi possível carregar o feed agora. Tente novamente.</p>
            ) : grade.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <p className="text-sm font-semibold">Nenhum post com data em {MESES[mes0]}</p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">Preencha a Data de Postagem nos cards deste cliente ou escolha uma data para os posts da gaveta.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {grade.map(p => <Quadro key={p.cardId} post={p} onAbrir={() => setCardAberto(p.cardId)} />)}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="text-[15px] font-bold">Andamento do ciclo</h2>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100} aria-label="Posts aprovados ou publicados">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progresso}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{aprovadosOuPublicados} de {total} aprovados ou publicados</p>
              <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ORDEM.map(s => (
                  <li key={s} className="rounded-xl bg-muted/50 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><span className={cn('h-2 w-2 rounded-full', SITUACAO[s].ponto)} />{SITUACAO[s].rotulo}</p>
                    <p className="mt-0.5 text-xl font-bold tabular-nums">{contagem[s]}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="text-[15px] font-bold">Gaveta</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Posts do cliente com plataforma ou tipo definidos, mas sem data. Escolha a data para encaixar no ciclo.</p>
              {gaveta.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nada guardado na gaveta.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border/60">
                  {gaveta.map(p => {
                    const { rotulo, Icone } = tipoDe(p.tipo);
                    return (
                      <li key={p.cardId} className="flex items-center gap-3 py-2.5">
                        <Icone className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <button type="button" onClick={() => setCardAberto(p.cardId)} className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-sm font-semibold">{p.titulo}</span>
                          <span className="block truncate text-xs text-muted-foreground">{rotulo}{p.plataforma ? ` · ${p.plataforma}` : ''} · {SITUACAO[p.situacao].rotulo}</span>
                        </button>
                        <input
                          type="date"
                          aria-label={`Data de postagem de ${p.titulo}`}
                          onChange={e => definirData(p.cardId, e.target.value)}
                          className="h-9 rounded-lg border bg-background px-2 text-xs"
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <p className="px-1 text-xs text-muted-foreground">
              A miniatura é a primeira imagem anexada ao card. A situação vem do fluxo do card e da aprovação do cliente; um Link do Post preenchido marca como publicado.
            </p>
          </aside>
        </div>
      )}

      <CardDetailSheet cardId={cardAberto || undefined} open={!!cardAberto} onOpenChange={aberto => !aberto && setCardAberto(null)} />
    </div>
  );
}
