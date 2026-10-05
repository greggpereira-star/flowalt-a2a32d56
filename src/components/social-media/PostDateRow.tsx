import React from 'react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Megaphone, X } from 'lucide-react';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  useCardCustomFields,
  useCustomFieldDefinitions,
  useUpdateCardCustomFields,
} from '@/hooks/useSocialMediaTemplates';
import { FieldRow } from '@/components/cards/card-detail/CardPropertiesPanel';

/**
 * Data de postagem: quando o conteúdo vai ao ar. É diferente do Prazo da Tarefa (entrega interna da produção).
 * O quadro/calendário de Postagens só funciona para cards que têm esta data.
 */
export const PostDateRow: React.FC<{ cardId: string; spaceType?: string }> = ({ cardId, spaceType = 'social_media' }) => {
  const { data: definicoes } = useCustomFieldDefinitions(spaceType);
  const { data: campos } = useCardCustomFields(cardId);
  const atualizar = useUpdateCardCustomFields();
  const [aberto, setAberto] = React.useState(false);

  if (!definicoes?.some((d) => d.field_key === 'post_date')) return null;

  const valor = campos?.find((c) => c.field_key === 'post_date')?.field_value || '';
  const data = valor ? parse(valor, 'yyyy-MM-dd', new Date()) : undefined;
  const valida = !!data && !Number.isNaN(data.getTime());

  const salvar = async (novoValor: string) => {
    try {
      await atualizar.mutateAsync({ cardId, fields: { post_date: novoValor } });
      setAberto(false);
    } catch (e) {
      toast.error('Não foi possível salvar a data de postagem.', { description: (e as Error)?.message });
    }
  };

  return (
    <FieldRow icon={<Megaphone className="h-3.5 w-3.5 text-primary" />} label="Data de postagem" className="rounded-lg bg-primary/[0.04]">
      <div className="flex items-center gap-1.5">
        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-muted/50',
                valida ? 'font-medium text-foreground' : 'border border-dashed border-muted-foreground/30 text-muted-foreground/60'
              )}
              title="Quando o conteúdo vai ao ar (diferente do prazo da tarefa)"
            >
              {valida ? format(data!, "EEE, dd 'de' MMM", { locale: ptBR }) : 'Definir data'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={valida ? data : undefined}
              onSelect={(d) => d && salvar(format(d, 'yyyy-MM-dd'))}
              locale={ptBR}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        {valida && (
          <button
            type="button"
            onClick={() => salvar('')}
            className="rounded p-0.5 text-muted-foreground/60 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
            aria-label="Remover data de postagem"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </FieldRow>
  );
};
