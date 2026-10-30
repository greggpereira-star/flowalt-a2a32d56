import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Hourglass, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMissoes } from '@/hooks/useMissoes';
import {
  pontosEmJogo,
  separarMissoes,
  situacaoDaMissao,
  tempoRestanteDaMissao,
  TIPOS_DE_MISSAO,
  type Missao,
} from '@/lib/gamificacao/missoes';
import { cn } from '@/lib/utils';

/**
 * Missoes da semana: o sistema aponta os cards que mais travam a entrega (vencidos ou parados em Aprovacao).
 * Cobrar com um comentario de verdade e destravar rendem pontos de temporada. Quem resolve e o card, nao a pessoa: qualquer um pega.
 */
export function MissoesDaSemanaCard() {
  const navigate = useNavigate();
  const { missoes, carregando, indisponivel } = useMissoes();
  const { abertas, encerradas } = separarMissoes(missoes);
  if (carregando || indisponivel) return null;

  const abrirCard = (m: Missao) => navigate(m.space_id ? `/space/${m.space_id}?card=${m.card_id}` : `/tasks?card=${m.card_id}`);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" aria-hidden /> Missões da semana
            </CardTitle>
            <CardDescription className="mt-1 max-w-xl">
              Cards que mais travam a entrega. Cobrar com um comentário de verdade e destravar rendem pontos de temporada. Qualquer pessoa pode pegar.
            </CardDescription>
          </div>
          {abertas.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{pontosEmJogo(abertas)} pts em jogo</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {abertas.length === 0 ? (
          <p className="rounded-lg bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
            Nenhuma missão agora: nada vencido há mais de 1 dia nem parado em aprovação há mais de 2. O time está em dia.
          </p>
        ) : (
          <ul className="space-y-2">
            {abertas.map(m => (
              <li key={m.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold',
                      m.tipo === 'atraso' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
                    )}
                  >
                    {m.tipo === 'atraso' ? <Clock className="h-3 w-3" aria-hidden /> : <Hourglass className="h-3 w-3" aria-hidden />}
                    {situacaoDaMissao(m)}
                  </span>
                  <span className="text-muted-foreground">{TIPOS_DE_MISSAO[m.tipo].nome}</span>
                  <span className="ml-auto text-muted-foreground">{tempoRestanteDaMissao(m.expira_em)}</span>
                </div>
                <button type="button" onClick={() => abrirCard(m)} className="mt-1.5 block w-full truncate text-left text-sm font-semibold hover:underline" title={m.titulo}>
                  {m.titulo}
                </button>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {m.cobrada_por ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Cobrado por {m.cobrada_por} (+{m.pontos_cobranca})
                    </span>
                  ) : (
                    <span>
                      Cobrar com um comentário: <span className="font-semibold text-foreground">+{m.pontos_cobranca}</span>
                    </span>
                  )}
                  <span>
                    {TIPOS_DE_MISSAO[m.tipo].verbo}: <span className="font-semibold text-foreground">+{m.pontos_resolucao}</span>
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}

        {encerradas.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Encerradas nos últimos 7 dias</p>
            <ul className="space-y-1">
              {encerradas.map(m => (
                <li key={m.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  {m.status === 'cumprida' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <Hourglass className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="truncate" title={m.titulo}>{m.titulo}</span>
                  <span className="ml-auto shrink-0">
                    {m.status === 'cumprida' ? (m.resolvida_por ? `${m.resolvida_por} +${m.pontos_resolucao}` : 'cumprida') : 'expirou'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
