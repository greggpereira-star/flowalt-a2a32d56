import React, { useState } from 'react';
import { Gift, Swords, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdministrarMetaDoTime, useHistoricoDeEntregas, useMetaDoTime } from '@/hooks/useMetaDoTime';
import { sugerirAlvo, TIPOS_DE_META, type TipoDeMeta } from '@/lib/gamificacao/metaDoTime';

const formatar = (n: number) => String(n);

/** Criacao da meta do time da semana (admin), com modelos prontos sugeridos pelo historico real de entregas. */
export function MetaDoTimeAdmin() {
  const metas = useMetaDoTime();
  const historico = useHistoricoDeEntregas();
  const { criar, remover, semana } = useAdministrarMetaDoTime();
  const [tipo, setTipo] = useState<TipoDeMeta>('entregas');
  const [alvo, setAlvo] = useState('');
  const [recompensa, setRecompensa] = useState('');

  const fechadas = historico.filter(s => s.semana_inicio < semana).slice(-4);
  const alvoNumero = Number(alvo);
  const valido = Number.isInteger(alvoNumero) && alvoNumero >= 1 && alvoNumero <= 1000;

  const usarModelo = (t: TipoDeMeta) => {
    setTipo(t);
    const s = sugerirAlvo(t, historico, semana);
    if (s != null) setAlvo(String(s));
  };

  const salvar = () => {
    criar.mutate(
      { tipo, alvo: alvoNumero, recompensa },
      {
        onSuccess: () => {
          toast.success('Meta do time criada para esta semana');
          setAlvo('');
          setRecompensa('');
        },
        onError: () => toast.error('Não foi possível salvar a meta. Tente de novo.'),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-primary" aria-hidden /> Meta do time da semana
        </CardTitle>
        <CardDescription>
          Uma meta coletiva (o "chefão" da semana). O progresso vem dos cards entregues; quando o time bate, todos recebem o aviso com a recompensa que você definir.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {fechadas.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Referência: últimas semanas fechadas</p>
            <p className="mt-1 text-muted-foreground">
              Entregas: <span className="tabular-nums text-foreground">{fechadas.map(s => formatar(s.entregas)).join(' · ')}</span>
              <span className="mx-2">|</span>
              No prazo: <span className="tabular-nums text-foreground">{fechadas.map(s => formatar(s.no_prazo)).join(' · ')}</span>
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2" role="group" aria-label="Modelos prontos">
          {(Object.keys(TIPOS_DE_META) as TipoDeMeta[]).map(t => {
            const s = sugerirAlvo(t, historico, semana);
            return (
              <Button key={t} type="button" variant="outline" size="sm" onClick={() => usarModelo(t)}>
                {TIPOS_DE_META[t].rotulo}
                {s != null && <span className="ml-1.5 rounded bg-muted px-1.5 text-xs tabular-nums">{s}</span>}
              </Button>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div className="space-y-1.5">
            <Label htmlFor="meta-tipo">Tipo de meta</Label>
            <Select value={tipo} onValueChange={v => setTipo(v as TipoDeMeta)}>
              <SelectTrigger id="meta-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPOS_DE_META) as TipoDeMeta[]).map(t => (
                  <SelectItem key={t} value={t}>
                    {TIPOS_DE_META[t].rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{TIPOS_DE_META[tipo].descricao}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meta-alvo">Alvo (cards)</Label>
            <Input id="meta-alvo" type="number" min={1} max={1000} inputMode="numeric" value={alvo} onChange={e => setAlvo(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="meta-recompensa" className="flex items-center gap-1.5">
            <Gift className="h-3.5 w-3.5" aria-hidden /> Recompensa (opcional)
          </Label>
          <Input
            id="meta-recompensa"
            value={recompensa}
            maxLength={140}
            placeholder="Ex.: sexta-feira liberada às 17h"
            onChange={e => setRecompensa(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Aparece no cartão da meta e no aviso enviado quando o time bate o alvo.</p>
        </div>

        <Button type="button" onClick={salvar} disabled={!valido || criar.isPending}>
          {metas.some(m => m.tipo === tipo) ? 'Atualizar meta desta semana' : 'Criar meta desta semana'}
        </Button>

        {metas.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Metas ativas esta semana</p>
            {metas.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.atual} de {m.alvo}
                    {m.recompensa ? ` · Recompensa: ${m.recompensa}` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover a meta: ${m.titulo}`}
                  disabled={remover.isPending}
                  onClick={() => remover.mutate(m.id, { onError: () => toast.error('Não foi possível remover a meta.') })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
