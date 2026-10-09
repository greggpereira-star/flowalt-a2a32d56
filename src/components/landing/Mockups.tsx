import React, { useEffect, useState } from 'react';
import { CheckCircle2, MessageSquareWarning } from 'lucide-react';
import { PreviaInstagram } from '@/components/approvals/PreviaInstagram';
import { cn } from '@/lib/utils';

/**
 * Cenas do produto usadas na landing. Usam os mesmos componentes e as mesmas cores do app, com dados de exemplo
 * (cliente fictício). Todas são decorativas para leitores de tela: o texto da seção já descreve o que mostram.
 */

// Foto de exemplo: um café visto de cima, feito em SVG para não depender de imagem externa.
const FOTO_CAFE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><defs>
      <linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3E3CC"/><stop offset="1" stop-color="#DDA878"/></linearGradient>
      <radialGradient id="c" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#8A5A3B"/><stop offset="1" stop-color="#5A3722"/></radialGradient>
    </defs>
    <rect width="400" height="500" fill="url(#f)"/>
    <rect x="-40" y="360" width="480" height="180" fill="#C98F5C" opacity=".35" transform="rotate(-6 200 450)"/>
    <ellipse cx="200" cy="262" rx="146" ry="146" fill="#FFFFFF" opacity=".92"/>
    <ellipse cx="200" cy="262" rx="104" ry="104" fill="url(#c)"/>
    <path d="M200 318c-28-22-46-38-46-58 0-16 12-26 26-26 9 0 16 5 20 11 4-6 11-11 20-11 14 0 26 10 26 26 0 20-18 36-46 58z" fill="#FBF1E2"/>
    <rect x="318" y="238" width="54" height="22" rx="11" fill="#FFFFFF" opacity=".92"/>
    <path d="M262 98c-8 14 8 22 0 38M292 92c-8 14 8 22 0 38" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" fill="none" opacity=".8"/>
  </svg>`,
  );

const LEGENDA = 'Sábado pede mesa posta e café coado na hora. Vem passar a manhã com a gente. ☕ #cafe #sabado';

type Estado = 'p' | 'a' | 'r';
const ESTILO: Record<Estado, { rotulo: string; chip: string }> = {
  p: { rotulo: 'Pendente', chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  a: { rotulo: 'Aprovado', chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' },
  r: { rotulo: 'Ajuste pedido', chip: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300' },
};
const ETAPAS = ['Tema', 'Conteúdo', 'Mídia', 'Legenda'];

const PASSOS: { s: Estado[]; eventos: number; rodape: string; final?: boolean }[] = [
  { s: ['p', 'p', 'p', 'p'], eventos: 0, rodape: '0 de 4 etapas respondidas' },
  { s: ['a', 'p', 'p', 'p'], eventos: 1, rodape: '1 de 4 etapas respondidas' },
  { s: ['a', 'a', 'p', 'p'], eventos: 2, rodape: '2 de 4 etapas respondidas' },
  { s: ['a', 'a', 'r', 'p'], eventos: 3, rodape: '3 de 4 etapas respondidas, 1 com ajuste' },
  { s: ['a', 'a', 'p', 'p'], eventos: 4, rodape: '2 de 4 etapas respondidas, nova mídia enviada' },
  { s: ['a', 'a', 'a', 'a'], eventos: 5, rodape: 'Tudo aprovado · agendado para sáb, 12:00', final: true },
];

// Histórico do pedido: cresce conforme o exemplo avança.
const EVENTOS: { cor: string; t: string; q?: string; h: string }[] = [
  { cor: 'bg-emerald-500', t: 'Camila aprovou o Tema', h: '16:41' },
  { cor: 'bg-emerald-500', t: 'Camila aprovou o Conteúdo', h: '16:44' },
  { cor: 'bg-rose-500', t: 'Camila pediu ajuste na Mídia', q: 'Trocar a foto da capa por uma com luz natural.', h: '16:47' },
  { cor: 'bg-primary', t: 'A equipe enviou a nova mídia', h: '17:20' },
  { cor: 'bg-emerald-500', t: 'Camila aprovou a Mídia e a Legenda', h: '17:32' },
];

function Etapas({ estados }: { estados: Estado[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {ETAPAS.map((nome, i) => (
        <li key={nome} className="flex flex-col items-center gap-1.5 rounded-xl border bg-card px-2 py-3 text-center">
          <span className="text-[13px] font-semibold">{nome}</span>
          <span key={estados[i]} className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors duration-300 motion-safe:animate-[pop_.35s_ease-out]', ESTILO[estados[i]].chip)}>
            {ESTILO[estados[i]].rotulo}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Hero: o post de um cliente sendo aprovado etapa por etapa, com um pedido de ajuste no meio. */
export function MockAprovacao({ className }: { className?: string }) {
  const [passo, setPasso] = useState(0);
  const [parado, setParado] = useState(false);

  useEffect(() => {
    const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduz) {
      setPasso(PASSOS.length - 1);
      setParado(true);
    }
  }, []);

  useEffect(() => {
    if (parado) return;
    const espera = passo === PASSOS.length - 1 ? 4200 : passo === 3 ? 2600 : 1500;
    const t = window.setTimeout(() => setPasso(p => (p + 1) % PASSOS.length), espera);
    return () => window.clearTimeout(t);
  }, [passo, parado]);

  const atual = PASSOS[passo];
  return (
    <div aria-hidden className={cn('rounded-3xl border bg-card p-4 shadow-[0_30px_80px_-30px_hsl(235_72%_40%/0.35)] sm:p-5', className)}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">CV</span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-semibold">Casa Verde Café</p>
          <p className="text-[11px] text-muted-foreground">Aprovação de conteúdo · Rodada 1</p>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-300', atual.final ? ESTILO.a.chip : ESTILO.p.chip)}>
          {atual.final ? 'Aprovado' : 'Aguardando você'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,210px)_minmax(0,1fr)]">
        <PreviaInstagram nome="casaverdecafe" subtitulo="Café e brunch" midias={[{ kind: 'image', url: FOTO_CAFE }]} legenda={LEGENDA} className="mx-auto w-full max-w-[220px] shadow-none sm:max-w-none" />
        <div className="flex flex-col gap-3">
          <Etapas estados={atual.s} />
          <div className="min-h-[148px]">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Atividade</p>
            {atual.eventos === 0 ? (
              <p className="text-xs text-muted-foreground">Aguardando a primeira resposta do cliente.</p>
            ) : (
              <ul className="space-y-2.5">
                {EVENTOS.slice(0, atual.eventos).slice(-3).map(e => (
                  <li key={e.t} className="flex items-start gap-2.5 text-xs motion-safe:animate-[pop_.35s_ease-out]">
                    <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', e.cor)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{e.t}</span>
                      {e.q && <span className="mt-0.5 block text-muted-foreground">“{e.q}”</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{e.h}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-auto">
            <div className="flex gap-1" role="presentation">
              {atual.s.map((e, i) => (
                <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-500', e === 'a' ? 'bg-emerald-500' : e === 'r' ? 'bg-rose-500' : 'bg-muted')} />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground tabular-nums">{atual.rodape}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Os dois modos de aprovação, lado a lado, parados. */
export function MockModos() {
  return (
    <div aria-hidden className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-sm font-bold">Rápida</p>
        <p className="mt-1 text-xs text-muted-foreground">Uma decisão só, com mídia e legenda juntas.</p>
        <div className="mt-4 rounded-xl border bg-background p-3">
          <div className="aspect-[16/9] overflow-hidden rounded-lg">
            <img src={FOTO_CAFE} alt="" className="h-full w-full object-cover" />
          </div>
          <p className="mt-2.5 line-clamp-2 text-xs text-muted-foreground">{LEGENDA}</p>
          <div className="mt-3 flex gap-2">
            <span className="flex h-9 flex-1 items-center justify-center rounded-lg border text-xs font-semibold">Pedir ajustes</span>
            <span className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground"><CheckCircle2 className="h-3.5 w-3.5" /> Aprovar</span>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-sm font-bold">Em etapas</p>
        <p className="mt-1 text-xs text-muted-foreground">Cada etapa tem a sua decisão e o seu status.</p>
        <div className="mt-4 rounded-xl border bg-background p-3">
          <Etapas estados={['a', 'a', 'r', 'p']} />
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-900 dark:bg-rose-500/10 dark:text-rose-200">
            <MessageSquareWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span><b className="font-semibold">[Mídia]</b> Trocar a foto da capa.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

const SITUACAO = {
  aguardando: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30',
  ajustes: 'bg-rose-50 text-rose-900 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30',
  aprovado: 'bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30',
  publicado: 'bg-violet-50 text-violet-900 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/30',
} as const;

// Outubro de 2026 começa numa quinta-feira.
const PECAS: Record<number, { t: string; s: keyof typeof SITUACAO }[]> = {
  2: [{ t: 'Reels da vitrine', s: 'publicado' }],
  6: [{ t: 'Carrossel de preços', s: 'aprovado' }],
  8: [{ t: 'Stories de sábado', s: 'aguardando' }],
  13: [{ t: 'Post do brunch', s: 'ajustes' }, { t: 'Reels dos bastidores', s: 'aprovado' }],
  17: [{ t: 'Café da manhã', s: 'aguardando' }],
  21: [{ t: 'Dicas de preparo', s: 'aprovado' }],
  27: [{ t: 'Promoção da semana', s: 'aguardando' }],
};

/** Calendário do portal do cliente, em miniatura. */
export function MockCalendario() {
  const dias = Array.from({ length: 35 }, (_, i) => i - 3); // semana de domingo; o dia 1 cai na 5ª coluna (quinta)
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <p className="text-sm font-bold">Calendário de publicações</p>
        <span className="ml-auto rounded-md bg-muted px-2 py-1 text-[11px] font-semibold">Outubro de 2026</span>
      </div>
      <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map(d => <div key={d} className="py-1.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d, i) => {
          const dentro = d >= 1 && d <= 31;
          const pecas = dentro ? PECAS[d] ?? [] : [];
          return (
            <div key={i} className={cn('min-h-[58px] border-b border-r p-1 sm:min-h-[72px]', (i + 1) % 7 === 0 && 'border-r-0', !dentro && 'bg-muted/20')}>
              <span className={cn('ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[10px] tabular-nums', d === 8 ? 'bg-primary font-bold text-primary-foreground' : dentro ? 'text-foreground' : 'text-transparent')}>{dentro ? d : ''}</span>
              {pecas.map(p => (
                <span key={p.t} className={cn('mt-0.5 block truncate rounded px-1 py-0.5 text-[9px] font-medium ring-1 ring-inset sm:text-[10px]', SITUACAO[p.s])}>{p.t}</span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Uma persona do Brand Core, como a equipe e o cliente enxergam. */
export function MockBrandCore() {
  const itens = [
    { n: 'Diagnóstico do perfil', c: 'Completo' },
    { n: 'Personas', c: '2' },
    { n: 'Concorrência', c: '4' },
    { n: 'Esteira de ofertas', c: '3' },
    { n: 'Arquivos', c: '12' },
  ];
  return (
    <div aria-hidden className="grid overflow-hidden rounded-2xl border bg-card shadow-sm sm:grid-cols-[190px_minmax(0,1fr)]">
      <ul className="border-b bg-muted/30 p-2 sm:border-b-0 sm:border-r">
        {itens.map((i, idx) => (
          <li key={i.n} className={cn('flex items-center justify-between rounded-lg px-3 py-2 text-xs', idx === 1 ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground')}>
            {i.n}
            <span className="rounded-full bg-background px-1.5 text-[10px] tabular-nums">{i.c}</span>
          </li>
        ))}
      </ul>
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold">Mariana, a empreendedora ocupada</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Completa</span>
        </div>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
          <div className="sm:col-span-2"><dt className="font-semibold uppercase tracking-wide text-muted-foreground">Quem é</dt><dd className="mt-0.5 text-[13px]">34 anos, dona de loja online, mãe de dois filhos.</dd></div>
          <div><dt className="font-semibold uppercase tracking-wide text-muted-foreground">Dores</dt><dd className="mt-0.5 text-[13px]">Falta de tempo e de verba para anunciar.</dd></div>
          <div><dt className="font-semibold uppercase tracking-wide text-muted-foreground">Desejos</dt><dd className="mt-0.5 text-[13px]">Vender mais sem trabalhar de madrugada.</dd></div>
        </dl>
        <p className="mt-4 rounded-lg border border-dashed px-3 py-2 text-[11px] text-muted-foreground">Visível ao cliente no portal: Personas, Esteira de ofertas e a pasta Logos.</p>
      </div>
    </div>
  );
}
