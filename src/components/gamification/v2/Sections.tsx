import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  Lock,
  MessageSquare,
  Minus,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { LEVEL_CONFIGS } from '@/hooks/useUserLevel';
import { BADGE_DEFINITIONS } from '@/hooks/useBadges';
import type { Jogador, Pesos } from './useGamificationData';

export const iniciais = (nome: string) => {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};

const MEDALHAS = [
  { anel: 'ring-yellow-400', fundo: 'from-yellow-400/25 to-amber-500/5', texto: 'text-yellow-500', rotulo: '1º' },
  { anel: 'ring-slate-300', fundo: 'from-slate-300/25 to-slate-400/5', texto: 'text-slate-400', rotulo: '2º' },
  { anel: 'ring-amber-600', fundo: 'from-amber-600/25 to-orange-700/5', texto: 'text-amber-600', rotulo: '3º' },
];

function Variacao({ valor }: { valor: number | null }) {
  if (valor == null) return null;
  if (valor === 0) return <Minus className="h-3 w-3 text-muted-foreground" aria-label="Manteve a posição" />;
  const subiu = valor > 0;
  return (
    <span
      className={cn('inline-flex items-center text-[11px] font-semibold', subiu ? 'text-green-600' : 'text-red-500')}
      title={subiu ? `Subiu ${valor} posição(ões)` : `Caiu ${Math.abs(valor)} posição(ões)`}
    >
      {subiu ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(valor)}
    </span>
  );
}

function Foto({ j, className }: { j: Jogador; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarImage src={j.avatar_url ?? undefined} alt={j.name} />
      <AvatarFallback>{iniciais(j.name)}</AvatarFallback>
    </Avatar>
  );
}

// ---------------------------------------------------------------------------
// "Você": posição, nível, sequência e quanto falta para alcançar o próximo
// ---------------------------------------------------------------------------
export function CartaoVoce({ eu, jogadores, rotuloPeriodo }: { eu: Jogador | null; jogadores: Jogador[]; rotuloPeriodo: string }) {
  if (!eu) return null;
  const ranking = jogadores.filter(j => j.participa);
  const acima = eu.posicao && eu.posicao > 1 ? ranking[eu.posicao - 2] : null;
  const falta = acima ? Math.max(0.1, Math.round((acima.score - eu.score) * 10) / 10) : 0;

  return (
    <Card className="overflow-hidden border-primary/30">
      <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Foto j={eu} className="h-16 w-16 ring-2 ring-primary/50" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Seu desempenho · {rotuloPeriodo}</p>
            <p className="truncate text-xl font-bold">{eu.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <span>{eu.nivel_icone}</span> Nível {eu.nivel} · {eu.nivel_nome}
              </Badge>
              {eu.streak_atual > 0 && (
                <Badge className="gap-1 bg-orange-500/15 text-orange-600 hover:bg-orange-500/15 dark:text-orange-400">
                  <Flame className="h-3 w-3" />
                  {eu.streak_atual} {eu.streak_atual === 1 ? 'dia útil' : 'dias úteis'} seguidos
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            {eu.participa ? (
              <>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Posição</p>
                <p className="text-4xl font-black tabular-nums leading-none">
                  {eu.posicao}º<span className="text-base font-medium text-muted-foreground"> de {ranking.length}</span>
                </p>
              </>
            ) : (
              <Badge variant="outline">Fora do ranking</Badge>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>XP · {eu.xp.toLocaleString('pt-BR')}</span>
              <span>próximo nível em {eu.xp_proximo.toLocaleString('pt-BR')}</span>
            </div>
            <Progress value={eu.nivel_progresso} className="h-2.5" />
          </div>
          {eu.participa && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Score {eu.score}/100</span>
                <span>{eu.entregas} entregas · {eu.dias_ativos} dias ativos</span>
              </div>
              <Progress value={eu.score} className="h-2.5" />
            </div>
          )}
        </div>

        {eu.participa && (
          <p className="mt-4 text-sm">
            {acima ? (
              <>
                <Target className="mr-1 inline h-4 w-4 text-primary" />
                Faltam <strong>{falta} pontos</strong> para passar <strong>{acima.name}</strong>.
              </>
            ) : (
              <>
                <Crown className="mr-1 inline h-4 w-4 text-yellow-500" />
                Você lidera o ranking. Mantenha o ritmo para segurar o 1º lugar.
              </>
            )}
          </p>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Pódio
// ---------------------------------------------------------------------------
export function Podio({ jogadores, meuId }: { jogadores: Jogador[]; meuId?: string }) {
  const top = jogadores.filter(j => j.participa).slice(0, 3);
  if (top.length === 0) return null;
  // Ordem visual: 2º, 1º, 3º
  const ordem = [top[1], top[0], top[2]].filter(Boolean);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" /> Pódio
        </CardTitle>
        <CardDescription>Os três com maior score no período</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-center gap-2 sm:gap-6">
          {ordem.map(j => {
            const pos = (j.posicao ?? 1) - 1;
            const m = MEDALHAS[pos];
            const altura = pos === 0 ? 'h-28 sm:h-32' : pos === 1 ? 'h-20 sm:h-24' : 'h-16 sm:h-20';
            return (
              <div key={j.user_id} className="flex w-1/3 max-w-[11rem] flex-col items-center text-center">
                {pos === 0 && <Crown className="mb-1 h-6 w-6 text-yellow-500" />}
                <Foto j={j} className={cn('ring-4', m.anel, pos === 0 ? 'h-20 w-20 sm:h-24 sm:w-24' : 'h-14 w-14 sm:h-16 sm:w-16')} />
                <p className={cn('mt-2 w-full truncate text-sm font-semibold', j.user_id === meuId && 'text-primary')}>
                  {j.name.split(' ')[0]}
                </p>
                <p className="text-xs text-muted-foreground">{j.nivel_icone} {j.nivel_nome}</p>
                <div className={cn('mt-2 flex w-full flex-col items-center justify-start rounded-t-lg bg-gradient-to-b pt-2', m.fundo, altura)}>
                  <span className={cn('text-2xl font-black', m.texto)}>{m.rotulo}</span>
                  <span className="text-sm font-bold tabular-nums">{j.score}</span>
                  <span className="text-[10px] text-muted-foreground">pontos</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Destaques por categoria
// ---------------------------------------------------------------------------
export function Destaques({ jogadores }: { jogadores: Jogador[] }) {
  const ranking = jogadores.filter(j => j.participa);
  const lider = (valor: (j: Jogador) => number) => {
    const ord = [...ranking].sort((a, b) => valor(b) - valor(a));
    return ord[0] && valor(ord[0]) > 0 ? ord[0] : null;
  };
  const itens = [
    { titulo: 'Mais entregas', icone: <CheckCircle2 className="h-4 w-4" />, j: lider(j => j.entregas), valor: (j: Jogador) => `${j.entregas} cards`, cor: 'text-green-600 bg-green-500/10' },
    { titulo: 'Mais constante', icone: <Flame className="h-4 w-4" />, j: lider(j => j.dias_ativos), valor: (j: Jogador) => `${j.dias_ativos} dias ativos`, cor: 'text-orange-600 bg-orange-500/10' },
    { titulo: 'Mais colaborativo', icone: <MessageSquare className="h-4 w-4" />, j: lider(j => j.comentarios * 2 + j.movimentacoes), valor: (j: Jogador) => `${j.comentarios} comentários`, cor: 'text-blue-600 bg-blue-500/10' },
    { titulo: 'Mais horas', icone: <Clock className="h-4 w-4" />, j: lider(j => j.horas), valor: (j: Jogador) => `${j.horas}h`, cor: 'text-purple-600 bg-purple-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {itens.map(i => (
        <Card key={i.titulo}>
          <CardContent className="p-4">
            <div className={cn('mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', i.cor)}>
              {i.icone} {i.titulo}
            </div>
            {i.j ? (
              <div className="flex items-center gap-2">
                <Foto j={i.j} className="h-9 w-9" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{i.j.name.split(' ')[0]}</p>
                  <p className="text-xs text-muted-foreground">{i.valor(i.j)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Ninguém ainda. A vaga é sua.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desafios da semana (calculados dos últimos 7 dias, não dependem de cadastro)
// ---------------------------------------------------------------------------
export function Desafios({ semana }: { semana: any | null }) {
  const lista = [
    { titulo: 'Entregar 3 cards', atual: semana?.entregas ?? 0, meta: 3, icone: <CheckCircle2 className="h-4 w-4" /> },
    { titulo: 'Ficar ativo em 4 dias', atual: semana?.dias_ativos ?? 0, meta: 4, icone: <Flame className="h-4 w-4" /> },
    { titulo: 'Comentar em 5 cards', atual: semana?.comentarios ?? 0, meta: 5, icone: <MessageSquare className="h-4 w-4" /> },
    { titulo: 'Registrar 5h no cronômetro', atual: Math.floor(Number(semana?.horas ?? 0)), meta: 5, icone: <Clock className="h-4 w-4" /> },
  ];
  const feitos = lista.filter(l => l.atual >= l.meta).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" /> Desafios da semana
            </CardTitle>
            <CardDescription>Últimos 7 dias · {feitos} de {lista.length} concluídos</CardDescription>
          </div>
          {feitos === lista.length && (
            <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white">
              <Trophy className="mr-1 h-3 w-3" /> Semana perfeita
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {lista.map(l => {
          const pct = Math.min(100, Math.round((l.atual / l.meta) * 100));
          const ok = l.atual >= l.meta;
          return (
            <div key={l.titulo}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className={cn('inline-flex items-center gap-1.5 font-medium', ok && 'text-green-600')}>
                  {ok ? <CheckCircle2 className="h-4 w-4" /> : l.icone} {l.titulo}
                </span>
                <span className="tabular-nums text-muted-foreground">{Math.min(l.atual, l.meta)}/{l.meta}</span>
              </div>
              <Progress value={pct} className={cn('h-2', ok && '[&>div]:bg-green-500')} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Ranking completo, com ordenação por critério
// ---------------------------------------------------------------------------
type Criterio = 'score' | 'entregas' | 'constancia' | 'colaboracao' | 'horas';
const CRITERIOS: { id: Criterio; rotulo: string }[] = [
  { id: 'score', rotulo: 'Geral' },
  { id: 'entregas', rotulo: 'Entregas' },
  { id: 'constancia', rotulo: 'Constância' },
  { id: 'colaboracao', rotulo: 'Colaboração' },
  { id: 'horas', rotulo: 'Horas' },
];

export function RankingCompleto({ jogadores, pesos, meuId }: { jogadores: Jogador[]; pesos: Pesos; meuId?: string }) {
  const [criterio, setCriterio] = useState<Criterio>('score');

  const lista = useMemo(() => {
    const ranking = jogadores.filter(j => j.participa);
    const chave: Record<Criterio, (j: Jogador) => number> = {
      score: j => j.score,
      entregas: j => j.entregas,
      constancia: j => j.dias_ativos,
      colaboracao: j => j.comentarios * 2 + j.movimentacoes,
      horas: j => j.horas,
    };
    return [...ranking].sort((a, b) => chave[criterio](b) - chave[criterio](a) || b.score - a.score);
  }, [jogadores, criterio]);

  const valor = (j: Jogador) => {
    switch (criterio) {
      case 'entregas': return `${j.entregas}`;
      case 'constancia': return `${j.dias_ativos} dias`;
      case 'colaboracao': return `${j.comentarios * 2 + j.movimentacoes} pts`;
      case 'horas': return `${j.horas}h`;
      default: return `${j.score}`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Ranking da equipe
        </CardTitle>
        <CardDescription>
          Score de 0 a 100: entregas {pesos.entrega}%, constância {pesos.constancia}%, colaboração {pesos.colaboracao}% e horas {pesos.horas}%.
        </CardDescription>
        <div className="flex flex-wrap gap-1.5 pt-2" role="tablist" aria-label="Ordenar ranking">
          {CRITERIOS.map(c => (
            <button
              key={c.id}
              role="tab"
              aria-selected={criterio === c.id}
              onClick={() => setCriterio(c.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                criterio === c.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
            >
              {c.rotulo}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {lista.map((j, i) => {
          const m = i < 3 ? MEDALHAS[i] : null;
          return (
            <div
              key={j.user_id}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3',
                m && `bg-gradient-to-r ${m.fundo}`,
                j.user_id === meuId && 'ring-2 ring-primary/60'
              )}
            >
              <div className="flex w-10 shrink-0 flex-col items-center">
                <span className={cn('text-lg font-black tabular-nums', m?.texto ?? 'text-muted-foreground')}>{i + 1}</span>
                {criterio === 'score' && <Variacao valor={j.variacao} />}
              </div>
              <Foto j={j} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {j.name}
                  {j.user_id === meuId && <span className="ml-1 text-xs font-normal text-primary">(você)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {j.nivel_icone} Nível {j.nivel} · {j.nivel_nome} · {j.cargo}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                  <span>{j.entregas} entregas</span>
                  <span>{j.dias_ativos} dias ativos</span>
                  <span>{j.comentarios} comentários</span>
                  {j.streak_atual > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-orange-600">
                      <Flame className="h-3 w-3" />
                      {j.streak_atual}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-20 shrink-0 text-right sm:w-28">
                <p className="text-xl font-bold tabular-nums">{valor(j)}</p>
                {criterio === 'score' && <Progress value={j.score} className="mt-1 h-1.5" />}
              </div>
            </div>
          );
        })}
        {lista.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum participante no ranking.</p>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Conquistas
// ---------------------------------------------------------------------------
export function Conquistas({
  jogadores,
  meuId,
  medalhasTime,
}: {
  jogadores: Jogador[];
  meuId?: string;
  medalhasTime: { user_id: string; badge_type: string; earned_at: string }[];
}) {
  const totalMembros = Math.max(1, jogadores.length);
  const minhas = new Map(medalhasTime.filter(m => m.user_id === meuId).map(m => [m.badge_type, m.earned_at]));
  const porTipo = new Map<string, number>();
  medalhasTime.forEach(m => porTipo.set(m.badge_type, (porTipo.get(m.badge_type) ?? 0) + 1));

  const todas = Object.values(BADGE_DEFINITIONS);
  const conquistadas = todas.filter(b => minhas.has(b.type)).length;
  const recentes = medalhasTime.filter(m => BADGE_DEFINITIONS[m.badge_type]).slice(0, 8);
  const nome = (id: string) => jogadores.find(j => j.user_id === id);

  const raridade = (tipo: string) => {
    const pct = ((porTipo.get(tipo) ?? 0) / totalMembros) * 100;
    if (pct === 0) return { rotulo: 'Ninguém ainda', cor: 'text-purple-600' };
    if (pct <= 25) return { rotulo: 'Raríssima', cor: 'text-purple-600' };
    if (pct <= 50) return { rotulo: 'Rara', cor: 'text-blue-600' };
    return { rotulo: 'Comum', cor: 'text-muted-foreground' };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Suas conquistas</CardTitle>
          <CardDescription>{conquistadas} de {todas.length} desbloqueadas</CardDescription>
          <Progress value={(conquistadas / todas.length) * 100} className="mt-2 h-2" />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3 lg:grid-cols-4">
          {todas.map(b => {
            const ganha = minhas.get(b.type);
            const r = raridade(b.type);
            return (
              <div
                key={b.type}
                className={cn('rounded-xl border p-3 text-center transition', ganha ? 'bg-card shadow-sm' : 'bg-muted/30 opacity-70')}
              >
                <div className={cn('mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full text-2xl', ganha ? b.color : 'bg-muted')}>
                  {ganha ? b.icon : <Lock className="h-5 w-5 text-muted-foreground" />}
                </div>
                <p className="text-sm font-semibold">{b.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{b.description}</p>
                <p className={cn('mt-1 text-[11px] font-medium', r.cor)}>
                  {r.rotulo} · {porTipo.get(b.type) ?? 0}/{totalMembros}
                </p>
                {ganha && (
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(ganha), "dd 'de' MMM yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mural da equipe</CardTitle>
          <CardDescription>Últimas conquistas desbloqueadas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentes.map((m, i) => {
            const j = nome(m.user_id);
            const def = BADGE_DEFINITIONS[m.badge_type];
            return (
              <div key={`${m.user_id}-${m.badge_type}-${i}`} className="flex items-center gap-3 text-sm">
                {j ? <Foto j={j} className="h-8 w-8" /> : <div className="h-8 w-8 rounded-full bg-muted" />}
                <span className="min-w-0 flex-1 truncate">
                  <strong>{j?.name ?? 'Alguém'}</strong> desbloqueou {def.icon} {def.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(m.earned_at), 'dd/MM', { locale: ptBR })}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Níveis: a escada, quem está em cada degrau e como ganhar XP
// ---------------------------------------------------------------------------
export function Niveis({ jogadores, eu, pesos }: { jogadores: Jogador[]; eu: Jogador | null; pesos: Pesos }) {
  const regras = [
    ['Card entregue como responsável', '+20 XP'],
    ['Comentário', '+3 XP'],
    ['Movimentação de card', '+2 XP'],
    ['Dia de atividade', '+5 XP'],
    ['Hora no cronômetro', '+5 XP'],
    ['Medalha de marco (cards, tempo, comentário...)', '+50 XP'],
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Jornada de níveis</CardTitle>
          <CardDescription>O XP acumula toda a sua atividade e nunca diminui com o período escolhido.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...LEVEL_CONFIGS].reverse().map(l => {
            const aqui = jogadores.filter(j => j.nivel === l.level);
            const meuNivel = eu?.nivel === l.level;
            return (
              <div
                key={l.level}
                className={cn('flex items-center gap-3 rounded-lg border p-3', meuNivel && 'border-primary/60 bg-primary/5')}
              >
                <span className="w-8 text-center text-2xl">{l.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    Nível {l.level} · {l.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.minScore.toLocaleString('pt-BR')}+ XP
                  </p>
                </div>
                <div className="flex -space-x-2">
                  {aqui.slice(0, 5).map(j => (
                    <Avatar key={j.user_id} className="h-8 w-8 border-2 border-background" title={`${j.name} · ${j.xp} XP`}>
                      <AvatarImage src={j.avatar_url ?? undefined} alt={j.name} />
                      <AvatarFallback className="text-[10px]">{iniciais(j.name)}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Como ganhar XP</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {regras.map(([acao, xp]) => (
              <div key={acao} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{acao}</span>
                <span className="font-semibold tabular-nums">{xp}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Como o score é calculado</CardTitle>
            <CardDescription>O score decide o ranking e reinicia a cada período.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ['Entregas', pesos.entrega],
              ['Constância (dias ativos)', pesos.constancia],
              ['Colaboração', pesos.colaboracao],
              ['Horas no cronômetro', pesos.horas],
            ].map(([nome, peso]) => (
              <div key={nome as string}>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{nome}</span>
                  <span className="font-semibold tabular-nums">{peso} pts</span>
                </div>
                <Progress value={Number(peso)} className="mt-1 h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
