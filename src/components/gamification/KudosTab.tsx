import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Heart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAcoesDeKudos, useColegasDeKudos, useKudos, useKudosRestantes } from '@/hooks/useKudos';
import {
  CATEGORIAS_DE_KUDOS,
  KUDOS_POR_SEMANA,
  MOTIVO_MAX,
  mensagemDeErroDeKudos,
  rotuloDaCategoria,
  rotuloDeRestantes,
  validarMotivo,
  type CategoriaDeKudos,
} from '@/lib/gamificacao/kudos';
import { cn } from '@/lib/utils';

const iniciais = (nome: string | null) =>
  (nome ?? '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const primeiro = (nome: string | null) => (nome ?? 'Alguém').split(' ')[0];

function Foto({ nome, url, className }: { nome: string | null; url: string | null; className?: string }) {
  return (
    <Avatar className={className}>
      {url && <AvatarImage src={url} alt={nome ?? ''} />}
      <AvatarFallback>{iniciais(nome)}</AvatarFallback>
    </Avatar>
  );
}

/** Reconhecimento entre colegas: 3 palmas por semana, sem pontos. Existe para o jogo nao ficar so competitivo. */
export function KudosTab() {
  const { kudos, carregando, indisponivel } = useKudos();
  const restantes = useKudosRestantes();
  const colegas = useColegasDeKudos();
  const { dar, remover } = useAcoesDeKudos();
  const [para, setPara] = useState('');
  const [categoria, setCategoria] = useState<CategoriaDeKudos>('ajuda');
  const [motivo, setMotivo] = useState('');
  const [tocou, setTocou] = useState(false);

  if (indisponivel) return null;

  const erroDoMotivo = tocou ? validarMotivo(motivo) : null;
  const semPalmas = restantes !== null && restantes <= 0;
  const podeEnviar = !!para && validarMotivo(motivo) === null && !semPalmas && !dar.isPending;

  const enviar = () => {
    dar.mutate(
      { para, categoria, motivo: motivo.trim() },
      {
        onSuccess: () => {
          toast.success('Kudos enviado');
          setMotivo('');
          setPara('');
          setTocou(false);
        },
        onError: e => toast.error(mensagemDeErroDeKudos(e)),
      },
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-500" aria-hidden /> Dar kudos
              </CardTitle>
              <CardDescription className="mt-1 max-w-xl">
                Reconheça um colega pelo que ele fez. É só elogio: não dá pontos nem muda o ranking. Uma palma por colega por semana.
              </CardDescription>
            </div>
            {restantes !== null && (
              <div className="text-right text-xs text-muted-foreground">
                <div className="mb-1 flex justify-end gap-1" aria-hidden>
                  {Array.from({ length: KUDOS_POR_SEMANA }, (_, i) => (
                    <Heart key={i} className={cn('h-4 w-4', i < restantes ? 'fill-pink-500 text-pink-500' : 'text-muted-foreground/40')} />
                  ))}
                </div>
                <p>{rotuloDeRestantes(restantes)}</p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="kudos-para" className="text-sm font-medium">Para quem?</label>
            <select
              id="kudos-para"
              value={para}
              onChange={e => setPara(e.target.value)}
              disabled={semPalmas}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              <option value="">Escolha um colega</option>
              {colegas.map(c => (
                <option key={c.user_id} value={c.user_id}>{c.nome ?? 'Membro'}</option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-1.5" disabled={semPalmas}>
            <legend className="text-sm font-medium">Pelo quê?</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS_DE_KUDOS.map(c => (
                <button
                  key={c.chave}
                  type="button"
                  aria-pressed={categoria === c.chave}
                  onClick={() => setCategoria(c.chave)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition',
                    categoria === c.chave ? 'border-pink-500 bg-pink-500/10 text-pink-700 dark:text-pink-300' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {c.rotulo}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="kudos-motivo" className="text-sm font-medium">Conte o que ele fez</label>
            <Textarea
              id="kudos-motivo"
              value={motivo}
              maxLength={MOTIVO_MAX}
              rows={3}
              disabled={semPalmas}
              placeholder="Ex.: Pegou meu card parado e entregou no mesmo dia."
              onChange={e => setMotivo(e.target.value)}
              onBlur={() => setTocou(true)}
              aria-invalid={!!erroDoMotivo}
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-destructive">{erroDoMotivo}</span>
              <span className="tabular-nums text-muted-foreground">{motivo.trim().length}/{MOTIVO_MAX}</span>
            </div>
          </div>

          <Button type="button" onClick={enviar} disabled={!podeEnviar}>
            <Heart className="mr-2 h-4 w-4" aria-hidden /> Enviar kudos
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Mural de kudos</CardTitle>
          <CardDescription>O que a equipe reconheceu nos últimos 60 dias.</CardDescription>
        </CardHeader>
        <CardContent>
          {carregando ? null : kudos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Ninguém deu kudos ainda. Seja o primeiro: reconheça um colega.</p>
          ) : (
            <ul className="space-y-3">
              {kudos.map(k => (
                <li key={k.id} className="rounded-xl border p-3">
                  <div className="flex items-center gap-2.5">
                    <Foto nome={k.de_nome} url={k.de_avatar} className="h-8 w-8 shrink-0" />
                    <p className="min-w-0 flex-1 text-sm">
                      <strong>{primeiro(k.de_nome)}</strong> reconheceu <strong>{primeiro(k.para_nome)}</strong>
                    </p>
                    <span className="shrink-0 rounded-full bg-pink-500/10 px-2 py-0.5 text-[11px] font-semibold text-pink-700 dark:text-pink-300">{rotuloDaCategoria(k.categoria)}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{k.motivo}</p>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDistanceToNow(new Date(k.criado_em), { addSuffix: true, locale: ptBR })}</span>
                    {k.posso_remover && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-destructive"
                        disabled={remover.isPending}
                        onClick={() => {
                          if (window.confirm('Remover este kudos? A palma volta para quem deu.')) {
                            remover.mutate(k.id, { onError: () => toast.error('Não foi possível remover. Tente de novo.') });
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden /> Remover
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
