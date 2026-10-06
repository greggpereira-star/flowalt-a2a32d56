import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { gerarToken, sha256Hex } from '@/hooks/useApprovals';
import { toast } from 'sonner';

// A tabela do portal ainda nao esta em integrations/supabase/types.ts; cliente sem tipos.
const db = supabase as any;

export interface AcessoDoPortal {
  id: string;
  created_at: string;
  renewed_at: string | null;
  last_seen_at: string | null;
  view_count: number;
  revoked_at: string | null;
}

export const linkDoPortal = (token: string) => `${window.location.origin}/portal/${token}`;

/** Situacao do link do portal de um cliente (nunca devolve o hash). */
export function useAcessoDoPortal(clientId: string | undefined) {
  return useQuery({
    queryKey: ['portal-acesso', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<AcessoDoPortal | null> => {
      const { data, error } = await db
        .from('client_portal_access').select('id, created_at, renewed_at, last_seen_at, view_count, revoked_at').eq('client_id', clientId).maybeSingle();
      if (error) throw error;
      return (data ?? null) as AcessoDoPortal | null;
    },
  });
}

/** Cria o link do portal ou gera um novo (o anterior deixa de funcionar). O token em claro so existe aqui. */
export function useGerarLinkDoPortal() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, jaExiste }: { clientId: string; jaExiste: boolean }) => {
      if (!user?.id || !currentWorkspace?.id) throw new Error('Sessão expirada.');
      const token = gerarToken();
      const token_hash = await sha256Hex(token);
      if (jaExiste) {
        const { error } = await db.from('client_portal_access').update({ token_hash, renewed_at: new Date().toISOString(), revoked_at: null }).eq('client_id', clientId);
        if (error) throw error;
      } else {
        const { error } = await db.from('client_portal_access').insert({ workspace_id: currentWorkspace.id, client_id: clientId, token_hash, created_by: user.id });
        if (error) throw error;
      }
      return { link: linkDoPortal(token) };
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: ['portal-acesso', v.clientId] }),
    onError: (e: any) => toast.error(e?.message || 'Não foi possível gerar o link.'),
  });
}

export function useRevogarPortal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId }: { clientId: string }) => {
      const { error } = await db.from('client_portal_access').update({ revoked_at: new Date().toISOString() }).eq('client_id', clientId);
      if (error) throw error;
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['portal-acesso', v.clientId] });
      toast.success('Link revogado. O cliente não consegue mais abrir o portal.');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível revogar.'),
  });
}

/** Cor da marca da agencia (workspaces.settings.brand_color), usada no portal, na pagina de aprovacao e nos e-mails. */
export function useMarcaDaAgencia() {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['marca-agencia', wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data, error } = await db.from('workspaces').select('settings').eq('id', wsId).single();
      if (error) throw error;
      return { settings: (data?.settings ?? {}) as Record<string, unknown> };
    },
  });
  const salvar = useMutation({
    mutationFn: async (cor: string | null) => {
      const settings = { ...(q.data?.settings ?? {}) } as Record<string, unknown>;
      if (cor) settings.brand_color = cor; else delete settings.brand_color;
      const { data, error } = await db.from('workspaces').update({ settings }).eq('id', wsId).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Só owner e admin mudam a cor da marca.');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marca-agencia', wsId] });
      toast.success('Cor da marca salva.');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível salvar a cor.'),
  });
  const cor = typeof q.data?.settings?.brand_color === 'string' ? (q.data!.settings.brand_color as string) : null;
  return { cor, carregando: q.isLoading, salvar };
}
