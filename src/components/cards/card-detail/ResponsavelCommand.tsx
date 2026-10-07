import React from 'react';
import { Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { Sugestao } from '@/lib/inteligencia/sugestao-responsavel';
import { cn } from '@/lib/utils';

export interface MembroEscolha {
  user_id: string;
  profile?: { full_name: string | null; email: string; avatar_url: string | null };
}

const iniciais = (nome?: string | null) => {
  const p = (nome || '').trim().split(' ').filter(Boolean);
  if (!p.length) return '?';
  return (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase();
};
const nomeDe = (m: MembroEscolha) => m.profile?.full_name || m.profile?.email || 'Usuário';

/** "42 entregas em 180 dias · 0 abertos": os números que justificam a indicação, sem frase longa. */
function razao(s: Sugestao) {
  const ab = `${s.abertos} ${s.abertos === 1 ? 'aberto' : 'abertos'}`;
  return s.semHistorico ? `sem histórico neste space · ${ab}` : `${s.entregas} ${s.entregas === 1 ? 'entrega' : 'entregas'} em 180 dias · ${ab}`;
}

/**
 * Lista do "+" de Responsáveis. A sugestão vive aqui dentro (oculta até o clique): os indicados vêm primeiro,
 * com destaque dourado e título, e o resto da equipe logo abaixo. Quem for a melhor indicação já nasce
 * selecionado, então Enter atribui sem tocar no mouse.
 */
export function ResponsavelCommand({
  membros,
  sugestoes,
  onEscolher,
}: {
  membros: MembroEscolha[];
  sugestoes: Sugestao[];
  onEscolher: (userId: string) => void;
}) {
  const porId = new Map(membros.map(m => [m.user_id, m]));
  const indicados = sugestoes.filter(s => porId.has(s.user_id));
  const idsIndicados = new Set(indicados.map(s => s.user_id));
  const resto = membros.filter(m => !idsIndicados.has(m.user_id));

  return (
    <Command className="rounded-lg [&_[cmdk-input-wrapper]]:border-none [&_[cmdk-input-wrapper]_svg]:hidden [&_[cmdk-input-wrapper]]:px-0">
      <CommandInput
        placeholder="Buscar membro..."
        className="!h-8 !border-none !bg-muted/40 !rounded-md !px-3 !text-sm !shadow-none !ring-0 !outline-none"
      />
      <CommandList className="mt-1 max-h-[300px]">
        <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">Nenhum membro</CommandEmpty>

        {indicados.length > 0 && (
          <CommandGroup heading="Indicados para este card">
            {indicados.map((s, i) => {
              const m = porId.get(s.user_id)!;
              const melhor = i === 0 && !s.semHistorico;
              return (
                <CommandItem
                  key={s.user_id}
                  value={`${nomeDe(m)} indicado`}
                  onSelect={() => onEscolher(s.user_id)}
                  title={s.motivo}
                  className={cn(
                    'mb-1 cursor-pointer items-center gap-2.5 rounded-lg border px-2 py-2',
                    melhor
                      ? 'border-amber-500/40 bg-amber-500/[0.08] data-[selected=true]:bg-amber-500/[0.16]'
                      : 'border-transparent data-[selected=true]:bg-amber-500/[0.10]'
                  )}
                >
                  <Avatar className={cn('h-8 w-8 shrink-0', melhor && 'ring-2 ring-amber-500/60 ring-offset-1 ring-offset-background')}>
                    {m.profile?.avatar_url && <AvatarImage src={m.profile.avatar_url} />}
                    <AvatarFallback className="bg-amber-500/15 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      {iniciais(m.profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{nomeDe(m)}</span>
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          melhor ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300' : 'text-amber-800/80 dark:text-amber-300/80'
                        )}
                      >
                        {melhor && <Star className="h-3 w-3 fill-current" aria-hidden />}
                        {s.semHistorico ? 'Menor carga' : melhor ? 'Mais indicado' : 'Indicado'}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{razao(s)}</span>
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {resto.length > 0 && (
          <CommandGroup heading={indicados.length > 0 ? 'Equipe' : undefined}>
            {resto.map(m => (
              <CommandItem key={m.user_id} value={nomeDe(m)} onSelect={() => onEscolher(m.user_id)} className="cursor-pointer gap-2.5 px-2 py-1.5">
                <Avatar className="h-6 w-6">
                  {m.profile?.avatar_url && <AvatarImage src={m.profile.avatar_url} />}
                  <AvatarFallback className="bg-primary/10 text-[10px] text-primary">{iniciais(m.profile?.full_name)}</AvatarFallback>
                </Avatar>
                <span className="truncate text-sm">{nomeDe(m)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}
