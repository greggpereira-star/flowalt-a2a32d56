import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { CARD_STATUS_LABELS, setRuntimeStatusLabels } from '@/lib/cards/cardStatusLabels';
import type { CardStatus } from '@/lib/supabase';
import { toast } from 'sonner';

/**
 * workspace_status_labels foi criada depois da ultima geracao de tipos do
 * Supabase, entao o cliente tipado ainda nao a conhece. O cast fica isolado
 * aqui, com o formato da linha declarado logo abaixo, em vez de espalhar
 * `as any` por cada chamada.
 */
interface LinhaRotulo {
  status: string;
  label: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Rótulos de etapa do workspace.
 *
 * A tabela só guarda o que o time renomeou; o resto cai no padrão do código.
 * Assim o padrão pode mudar sem precisar migrar linha de todo workspace, e um
 * status novo já nasce com nome sem depender de INSERT.
 *
 * Ao carregar, os rótulos são publicados em `setRuntimeStatusLabels` para que
 * as telas que leem o mapa direto (badge do card, mapa mental, aba do cliente)
 * mostrem a mesma palavra sem precisar receber props de rótulo.
 */
export function useStatusLabels() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? null;
  const queryClient = useQueryClient();

  const { data: labels = CARD_STATUS_LABELS, isLoading } = useQuery({
    queryKey: ['workspace-status-labels', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await db
        .from('workspace_status_labels')
        .select('status, label')
        .eq('workspace_id', workspaceId);

      if (error) throw error;

      const mesclado = { ...CARD_STATUS_LABELS };
      ((data ?? []) as LinhaRotulo[]).forEach(linha => {
        if (linha.status in mesclado) {
          mesclado[linha.status as CardStatus] = linha.label;
        }
      });

      setRuntimeStatusLabels(mesclado);
      return mesclado;
    },
  });

  const rename = useMutation({
    mutationFn: async ({ status, label }: { status: CardStatus; label: string }) => {
      if (!workspaceId) throw new Error('Nenhum workspace ativo.');

      const limpo = label.trim();
      if (!limpo) throw new Error('O nome da etapa não pode ficar vazio.');
      if (limpo.length > 40) throw new Error('O nome da etapa deve ter até 40 caracteres.');

      const { data: sessao } = await supabase.auth.getUser();

      // Voltar ao padrão apaga a linha em vez de gravar o texto padrão: assim o
      // workspace volta a acompanhar mudanças futuras do rótulo de fábrica.
      if (limpo === CARD_STATUS_LABELS[status]) {
        const { error } = await db
          .from('workspace_status_labels')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('status', status);
        if (error) throw error;
        return;
      }

      const { error } = await db
        .from('workspace_status_labels')
        .upsert(
          {
            workspace_id: workspaceId,
            status,
            label: limpo,
            updated_by: sessao?.user?.id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id,status' },
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-status-labels', workspaceId] });
      toast.success('Nome da etapa atualizado para todo o time.');
    },
    onError: (erro: unknown) => {
      // Sem permissão o PostgREST devolve 403 com corpo vazio; sem esta
      // mensagem o usuário só veria o nome voltar sozinho e não saberia por quê.
      const msg = erro instanceof Error ? erro.message : String(erro);
      const semPermissao = /permission|denied|row-level|policy|403/i.test(msg);
      toast.error(
        semPermissao
          ? 'Só quem administra o workspace pode renomear etapas.'
          : `Não foi possível renomear: ${msg}`,
      );
    },
  });

  return {
    labels,
    isLoading,
    renameStatus: rename.mutate,
    isRenaming: rename.isPending,
  };
}
