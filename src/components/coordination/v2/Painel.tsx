import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CalendarClock, CheckCircle2, Hourglass, UserX, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type {
  CardEmAtencao,
  CargaPessoa,
  Problema,
  Resumo,
  ResumoEtapa,
} from '@/lib/coordination/coordMetrics';

const nomeDe = (nomes: Map<string, string>, id: string) => nomes.get(id) ?? 'Ex-membro';

function rotuloProblema(p: Problema): { texto: string; grave: boolean } {
  switch (p.tipo) {
    case 'atrasado':
      return { texto: `${p.dias} ${p.dias === 1 ? 'dia' : 'dias'} de atraso`, grave: true };
    case 'sla-critico':
      return { texto: `${p.dias} d em "${p.etapa}" (limite ${Math.round(p.limiteHoras / 24)} d)`, grave: true };
    case 'sla-aviso':
      return { texto: `${p.dias} d em "${p.etapa}" (alerta ${Math.round(p.limiteHoras / 24)} d)`, grave: false };
    case 'parado':
      return { texto: `${p.dias} d sem alteração`, grave: p.dias > 30 };
    case 'sem-responsavel':
      return { texto: 'sem responsável', grave: true };
    case 'responsavel-inativo':
      return { texto: 'responsável fora da equipe', grave: true };
    case 'sem-prazo':
      return { texto: 'sem prazo', grave: false };
  }
}

// ---------------------------------------------------------------------------
export function KpisCoordenacao({ resumo }: { resumo: Resumo }) {
  const itens = [
    { rotulo: 'Em aberto', valor: resumo.abertos, ajuda: 'não entregues', alerta: false },
    { rotulo: 'Atrasados', valor: resumo.atrasados, ajuda: 'prazo vencido', alerta: resumo.atrasados > 0 },
    { rotulo: 'Vencem em 7 dias', valor: resumo.vencem7d, ajuda: 'próximos prazos', alerta: false },
    { rotulo: 'Fora do SLA', valor: resumo.foraDoSla, ajuda: 'tempo na etapa', alerta: resumo.foraDoSla > 0 },
    { rotulo: 'Sem responsável', valor: resumo.semResponsavel, ajuda: 'ou responsável que saiu', alerta: resumo.semResponsavel > 0 },
    { rotulo: 'Sem prazo', valor: resumo.semPrazo, ajuda: 'cards abertos', alerta: false },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {itens.map(i => (
        <Card key={i.rotulo} className={cn(i.alerta && 'border-destructive/40')}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">{i.rotulo}</p>
            <p className={cn('mt-1 text-3xl font-bold tabular-nums', i.alerta && 'text-destructive')}>{i.valor}</p>
            <p className="text-[11px] text-muted-foreground">{i.ajuda}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function AtencaoAgora({
  avaliados,
  nomes,
  onCardClick,
}: {
  avaliados: CardEmAtencao[];
  nomes: Map<string, string>;
  onCardClick: (id: string) => void;
}) {
  const lista = avaliados.filter(a => a.pontos > 0).sort((a, b) => b.pontos - a.pontos);

  if (lista.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
          <p className="text-lg font-medium">Tudo em ordem</p>
          <p className="text-muted-foreground">Nenhum card aberto com atraso, SLA estourado ou cadastro incompleto.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" /> Precisa de decisão
        </CardTitle>
        <CardDescription>
          {lista.length} cards abertos com algum problema, do mais crítico ao menos. Clique para abrir o card.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {lista.map(a => (
          <button
            key={a.card.id}
            onClick={() => onCardClick(a.card.id)}
            className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{a.card.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {a.card.space?.name ?? 'Sem space'}
                  {' · '}
                  {a.responsaveis.length ? a.responsaveis.map(id => nomeDe(nomes, id).split(' ')[0]).join(', ') : 'sem responsável'}
                </p>
              </div>
              <Badge variant={a.pontos >= 6 ? 'destructive' : 'secondary'} className="shrink-0">
                {a.pontos >= 6 ? 'Crítico' : a.pontos >= 3 ? 'Atenção' : 'Revisar'}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {a.problemas.map((p, i) => {
                const r = rotuloProblema(p);
                return (
                  <span
                    key={i}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      r.grave ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    )}
                  >
                    {r.texto}
                  </span>
                );
              })}
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
export function PainelEtapas({ etapas }: { etapas: ResumoEtapa[] }) {
  const max = Math.max(1, ...etapas.map(e => e.cards));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hourglass className="h-5 w-5" /> Onde o trabalho está parado
        </CardTitle>
        <CardDescription>
          Cards abertos por etapa do fluxo, quanto tempo estão nela e os limites de SLA e de trabalho em andamento (WIP) configurados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {etapas.map(r => (
          <div key={r.etapa.slug} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{r.etapa.name}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {r.etapa.sla_warning_hours || r.etapa.sla_critical_hours ? (
                  <span className="text-muted-foreground">
                    SLA: alerta {r.etapa.sla_warning_hours ? `${Math.round(r.etapa.sla_warning_hours / 24)} d` : '–'}, crítico{' '}
                    {r.etapa.sla_critical_hours ? `${Math.round(r.etapa.sla_critical_hours / 24)} d` : '–'}
                  </span>
                ) : (
                  <span className="text-muted-foreground">sem SLA configurado</span>
                )}
                {r.etapa.wip_limit && (
                  <Badge variant={r.excedeWip ? 'destructive' : 'outline'}>
                    WIP {r.cards}/{r.etapa.wip_limit}
                  </Badge>
                )}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Progress value={(r.cards / max) * 100} className="h-2 flex-1" />
              <span className="w-16 text-right text-sm font-semibold tabular-nums">{r.cards} {r.cards === 1 ? 'card' : 'cards'}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Tempo médio na etapa: <strong className="text-foreground">{r.diasMedio != null ? `${r.diasMedio} d` : '–'}</strong></span>
              <span>Mais antigo: <strong className="text-foreground">{r.diasMax != null ? `${r.diasMax} d` : '–'}</strong></span>
              {r.foraDoSlaCritico > 0 && (
                <span className="font-medium text-red-600 dark:text-red-400">{r.foraDoSlaCritico} acima do SLA crítico</span>
              )}
            </div>
          </div>
        ))}
        {etapas.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma etapa de fluxo configurada.</p>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
export function PainelEquipe({ carga, nomes }: { carga: CargaPessoa[]; nomes: Map<string, string> }) {
  const maxAbertos = Math.max(1, ...carga.map(c => c.abertos));
  const maxSemana = Math.max(1, ...carga.flatMap(c => c.porSemana));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Carga por pessoa
        </CardTitle>
        <CardDescription>
          Cards abertos em que a pessoa é responsável e quantos prazos caem em cada uma das próximas 4 semanas.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[38rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-2 font-medium">Pessoa</th>
              <th className="px-2 font-medium">Em aberto</th>
              <th className="px-2 text-right font-medium">Atrasados</th>
              <th className="px-2 text-right font-medium">Sem prazo</th>
              <th className="pl-2 font-medium">Prazos nas próximas semanas</th>
            </tr>
          </thead>
          <tbody>
            {carga.map(c => (
              <tr key={c.userId} className="border-b last:border-0">
                <td className="py-2 pr-2 font-medium">{nomeDe(nomes, c.userId)}</td>
                <td className="px-2">
                  <div className="flex items-center gap-2">
                    <Progress value={(c.abertos / maxAbertos) * 100} className="h-1.5 w-16" />
                    <span className="tabular-nums">{c.abertos}</span>
                  </div>
                </td>
                <td className={cn('px-2 text-right tabular-nums', c.atrasados > 0 && 'font-semibold text-red-500')}>{c.atrasados}</td>
                <td className="px-2 text-right tabular-nums">{c.semPrazo}</td>
                <td className="pl-2">
                  <div className="flex gap-1">
                    {c.porSemana.map((n, i) => (
                      <div
                        key={i}
                        title={`Semana ${i + 1}: ${n} ${n === 1 ? 'prazo' : 'prazos'}`}
                        className={cn(
                          'flex h-7 w-9 items-center justify-center rounded text-xs font-semibold tabular-nums',
                          n === 0 ? 'bg-muted text-muted-foreground' : 'text-white'
                        )}
                        style={n === 0 ? undefined : { backgroundColor: `hsl(var(--primary) / ${0.35 + 0.65 * (n / maxSemana)})` }}
                      >
                        {n}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {carga.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum card aberto com responsável.</p>}
        <p className="mt-3 text-xs text-muted-foreground">
          A carga é medida em número de cards. As horas estimadas não estão preenchidas na maioria dos cards, então não entram na conta.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
export function PainelPrazos({
  proximos,
  nomes,
  onCardClick,
}: {
  proximos: CardEmAtencao[];
  nomes: Map<string, string>;
  onCardClick: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" /> Próximos prazos (30 dias)
        </CardTitle>
        <CardDescription>Cards abertos com prazo nos próximos 30 dias, em ordem de data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {proximos.map(a => (
          <button
            key={a.card.id}
            onClick={() => onCardClick(a.card.id)}
            className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
          >
            <div className="w-14 shrink-0 text-center">
              <p className="text-lg font-bold leading-none">{format(new Date(a.card.due_date!), 'dd', { locale: ptBR })}</p>
              <p className="text-[11px] uppercase text-muted-foreground">{format(new Date(a.card.due_date!), 'MMM', { locale: ptBR })}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.card.title}</p>
              <p className="text-xs text-muted-foreground">
                {a.card.space?.name ?? 'Sem space'} ·{' '}
                {a.responsaveis.length ? a.responsaveis.map(id => nomeDe(nomes, id).split(' ')[0]).join(', ') : 'sem responsável'}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{format(new Date(a.card.due_date!), "HH'h'mm")}</span>
          </button>
        ))}
        {proximos.length === 0 && (
          <div className="py-10 text-center text-muted-foreground">
            <UserX className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p>Nenhum card aberto com prazo nos próximos 30 dias.</p>
            <p className="text-xs">Cards sem prazo não aparecem aqui; veja "Sem prazo" nos indicadores.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
