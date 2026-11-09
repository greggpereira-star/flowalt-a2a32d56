import React, { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, Medal, PackageCheck, Target, Trophy, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLinhaDoTempo } from '@/hooks/useLinhaDoTempo';
import { descreverEvento, type TipoDeEvento } from '@/lib/gamificacao/linhaDoTempo';

const ICONES: Record<TipoDeEvento, LucideIcon> = {
  entrega: PackageCheck,
  missao: Target,
  conquista: Trophy,
  kudos: Medal,
};

const VISIVEIS = 8;

/**
 * Linha do tempo do time: o que acabou de acontecer (entregas, missoes, niveis de conquista, kudos) nos ultimos 7 dias.
 * So mostra coisa boa: nao lista atraso nem quem ficou parado. Atualiza sozinha.
 */
export function LinhaDoTempoCard() {
  const { eventos, carregando, indisponivel } = useLinhaDoTempo(30);
  const [todos, setTodos] = useState(false);
  if (carregando || indisponivel) return null;

  const mostrados = todos ? eventos : eventos.slice(0, VISIVEIS);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" aria-hidden /> Acontecendo no time
        </CardTitle>
        <CardDescription>Entregas, missões, níveis de conquista e kudos dos últimos 7 dias. Atualiza sozinho.</CardDescription>
      </CardHeader>
      <CardContent>
        {eventos.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nada por aqui nos últimos 7 dias. A primeira entrega já aparece neste mural.</p>
        ) : (
          <>
            <ul className="divide-y">
              {mostrados.map((e, i) => {
                const t = descreverEvento(e);
                const Icone = ICONES[e.tipo];
                return (
                  <li key={`${e.tipo}-${e.quando}-${i}`} className="flex items-start gap-2.5 py-2 text-sm">
                    <Icone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <p className="min-w-0 flex-1">
                      <strong>{t.quem}</strong> {t.acao} <span className="text-muted-foreground">{t.complemento}</span>
                      {t.selo && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{t.selo}</span>}
                    </p>
                    <time className="shrink-0 text-xs text-muted-foreground" dateTime={e.quando}>
                      {formatDistanceToNowStrict(new Date(e.quando), { addSuffix: true, locale: ptBR })}
                    </time>
                  </li>
                );
              })}
            </ul>
            {eventos.length > VISIVEIS && (
              <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setTodos(v => !v)}>
                {todos ? 'Mostrar menos' : `Ver mais ${eventos.length - VISIVEIS}`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
