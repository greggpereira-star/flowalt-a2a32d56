import React, { useEffect, useState } from 'react';
import { Gift, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdministrarTemporada } from '@/hooks/useTemporada';
import { rotuloDoMes } from '@/lib/gamificacao/temporada';

/** Prêmio (texto livre) da temporada oficial em andamento ou, se ainda não há uma, da próxima. Aparece na aba Temporada e no aviso de encerramento. */
export function PremioDaTemporadaAdmin() {
  const { mesAlvo, premioAtual, salvar } = useAdministrarTemporada();
  const [premio, setPremio] = useState('');
  useEffect(() => setPremio(premioAtual), [premioAtual]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" aria-hidden /> Prêmio da temporada de {rotuloDoMes(mesAlvo)}
        </CardTitle>
        <CardDescription>O que o campeão do mês ganha. Aparece para todo o time na aba Temporada e no aviso de encerramento.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="premio-temporada" className="flex items-center gap-1.5">
            <Gift className="h-3.5 w-3.5" aria-hidden /> Prêmio do campeão
          </Label>
          <Input id="premio-temporada" value={premio} maxLength={140} placeholder="Ex.: um dia de folga à escolha" onChange={e => setPremio(e.target.value)} />
        </div>
        <Button
          type="button"
          disabled={salvar.isPending || premio.trim() === premioAtual.trim()}
          onClick={() =>
            salvar.mutate(premio, {
              onSuccess: () => toast.success('Prêmio da temporada salvo'),
              onError: () => toast.error('Não foi possível salvar o prêmio. Tente de novo.'),
            })
          }
        >
          Salvar prêmio
        </Button>
      </CardContent>
    </Card>
  );
}
