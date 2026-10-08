import React, { useEffect, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, Heart, ImageOff, MessageCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MidiaDaPrevia {
  kind: 'image' | 'video';
  url: string;
}

interface Props {
  /** Nome exibido no topo do post (o perfil do cliente). */
  nome: string;
  /** Segunda linha do topo (ex.: nome da agencia). */
  subtitulo?: string | null;
  logoUrl?: string | null;
  midias: MidiaDaPrevia[];
  legenda?: string | null;
  className?: string;
}

/** Previa de um post do Instagram: a mesma que o cliente ve ao aprovar. Nao publica nada; so mostra como vai ficar. */
export function PreviaInstagram({ nome, subtitulo, logoUrl, midias, legenda, className }: Props) {
  const [indice, setIndice] = useState(0);
  const [expandida, setExpandida] = useState(false);

  useEffect(() => {
    if (indice > midias.length - 1) setIndice(0);
  }, [midias.length, indice]);

  const atual = midias[indice];
  const texto = (legenda ?? '').trim();
  const longa = texto.length > 140 || texto.split('\n').length > 3;

  return (
    <figure className={cn('overflow-hidden rounded-2xl border bg-card shadow-sm', className)} aria-label="Prévia do post no Instagram">
      <header className="flex items-center gap-2.5 px-3.5 py-3">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {nome.trim().charAt(0).toUpperCase() || '·'}
          </span>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-semibold">{nome}</p>
          {subtitulo && <p className="truncate text-[11px] text-muted-foreground">{subtitulo}</p>}
        </div>
      </header>

      <div className="relative aspect-[4/5] w-full bg-muted/60">
        {atual ? (
          atual.kind === 'video' ? (
            <video key={atual.url} src={atual.url} controls playsInline className="h-full w-full bg-black object-contain" />
          ) : (
            <img src={atual.url} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
            <ImageOff className="h-7 w-7" />
            <p className="text-xs">A mídia ainda não foi enviada. Ela aparece aqui quando a etapa de Mídia chegar.</p>
          </div>
        )}

        {midias.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Mídia anterior"
              disabled={indice === 0}
              onClick={() => setIndice(i => Math.max(0, i - 1))}
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 shadow disabled:opacity-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Próxima mídia"
              disabled={indice === midias.length - 1}
              onClick={() => setIndice(i => Math.min(midias.length - 1, i + 1))}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 shadow disabled:opacity-0"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">
              {indice + 1}/{midias.length}
            </span>
          </>
        )}
      </div>

      {midias.length > 1 && (
        <div className="flex justify-center gap-1 pt-2.5" aria-hidden>
          {midias.map((_, i) => (
            <span key={i} className={cn('h-1.5 w-1.5 rounded-full', i === indice ? 'bg-primary' : 'bg-muted-foreground/30')} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-3.5 px-3.5 pb-1 pt-2.5 text-foreground" aria-hidden>
        <Heart className="h-[22px] w-[22px]" />
        <MessageCircle className="h-[22px] w-[22px]" />
        <Send className="h-[22px] w-[22px]" />
        <Bookmark className="ml-auto h-[22px] w-[22px]" />
      </div>

      <figcaption className="px-3.5 pb-3.5 pt-1 text-[13px] leading-snug">
        {texto ? (
          <p className={cn('whitespace-pre-wrap', !expandida && 'line-clamp-3')}>
            <span className="font-semibold">{nome}</span> {texto}
          </p>
        ) : (
          <p className="text-muted-foreground">A legenda ainda não foi enviada.</p>
        )}
        {texto && longa && (
          <button type="button" onClick={() => setExpandida(e => !e)} className="mt-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            {expandida ? 'ver menos' : 'ver mais'}
          </button>
        )}
      </figcaption>
    </figure>
  );
}
