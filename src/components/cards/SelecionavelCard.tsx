import React from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSelecaoDeCards } from '@/hooks/useCardSelection';

interface CaixaProps {
  marcado: boolean;
  parcial?: boolean;
  rotulo: string;
  onChange?: () => void;
  className?: string;
}

/**
 * Caixinha de seleção: 18px visíveis, mas com área de toque de ~34px (a margem invisível do `before`).
 * O estado também aparece no ícone, nunca só na cor.
 */
export const CaixaSelecao: React.FC<CaixaProps & React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  marcado, parcial, rotulo, onChange, className, ...resto
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={parcial ? 'mixed' : marcado}
    aria-label={rotulo}
    data-caixa-selecao
    onClick={onChange}
    className={cn(
      'relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border bg-background text-primary-foreground',
      'border-foreground/25 shadow-[0_1px_2px_rgba(15,23,42,0.08)]',
      'transition-[background-color,border-color,box-shadow,opacity,transform] duration-150 ease-out',
      'before:absolute before:-inset-2 before:content-[""]',
      'hover:border-foreground/50 active:scale-90',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      (marcado || parcial) && 'border-primary bg-primary hover:border-primary',
      className
    )}
    {...resto}
  >
    {parcial ? (
      <Minus className="h-3 w-3 animate-in zoom-in-50 duration-150" strokeWidth={3} />
    ) : marcado ? (
      <Check className="h-3 w-3 animate-in zoom-in-50 duration-150" strokeWidth={3} />
    ) : null}
  </button>
);

interface Props {
  id: string;
  titulo: string;
  /** Ids do grupo na ordem da tela (a coluna), para o Shift+clique. */
  grupo: string[];
  children: React.ReactNode;
}

/**
 * Envolve um card do quadro: caixinha discreta no canto (sem mexer no layout do card), realce fino com halo
 * suave quando marcado e, com a seleção ativa, clique no card marca em vez de abrir.
 * Shift/Ctrl/Cmd+clique já começa a seleção.
 */
export const SelecionavelCard: React.FC<Props> = ({ id, titulo, grupo, children }) => {
  const sel = useSelecaoDeCards();
  if (!sel) return <>{children}</>;
  const marcado = sel.tem(id);

  const aoClicar = (e: React.MouseEvent) => {
    const naCaixa = !!(e.target as HTMLElement).closest('[data-caixa-selecao]');
    if (!naCaixa && !sel.ativa && !e.shiftKey && !e.metaKey && !e.ctrlKey) return;
    e.preventDefault();
    e.stopPropagation();
    sel.alternar(id, { intervalo: e.shiftKey ? grupo : undefined });
  };

  return (
    <div className="group/sel relative" onClickCapture={aoClicar}>
      <CaixaSelecao
        marcado={marcado}
        rotulo={`${marcado ? 'Desmarcar' : 'Selecionar'} o card ${titulo}`}
        className={cn(
          'absolute -left-1.5 -top-1.5 z-20 ring-2 ring-background',
          // Sem mouse (celular/tablet) não existe "passar por cima": a caixinha fica sempre visível.
          marcado || sel.ativa ? 'opacity-100' : 'opacity-0 group-hover/sel:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100'
        )}
      />
      <div
        className={cn(
          'relative rounded-xl transition-shadow duration-150 ease-out',
          marcado &&
            'shadow-[0_0_0_1.5px_hsl(var(--primary)/0.75),0_0_0_4px_hsl(var(--primary)/0.10)] after:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:bg-primary/[0.04] after:content-[""]'
        )}
      >
        {children}
      </div>
    </div>
  );
};
