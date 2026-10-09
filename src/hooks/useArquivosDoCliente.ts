import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { caminhoDoArquivo, validarArquivo } from '@/lib/brandCore/arquivos';
import { toast } from 'sonner';

// As tabelas ainda nao estao em integrations/supabase/types.ts; cliente sem tipos e formas declaradas aqui.
const db = supabase as any;
const BUCKET = 'client-files';

export interface PastaDoCliente {
  id: string;
  client_id: string;
  name: string;
  access: 'team' | 'managers';
  visible_to_client: boolean;
  position: number;
  created_at: string;
}
export interface ArquivoDoCliente {
  id: string;
  folder_id: string;
  name: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

const chave = (clientId?: string) => ['client-files', clientId] as const;

/** Pastas e arquivos de um cliente, em tempo real. O banco ja esconde as pastas que o usuario nao pode ver. */
export function useArquivosDoCliente(clientId: string | undefined) {
  useRealtimeSubscription({ table: 'client_file_folders', filter: clientId ? `client_id=eq.${clientId}` : undefined, queryKeys: [chave(clientId)], enabled: !!clientId });
  useRealtimeSubscription({ table: 'client_files', filter: clientId ? `client_id=eq.${clientId}` : undefined, queryKeys: [chave(clientId)], enabled: !!clientId });

  return useQuery({
    queryKey: chave(clientId),
    enabled: !!clientId,
    queryFn: async (): Promise<{ pastas: PastaDoCliente[]; arquivos: ArquivoDoCliente[] }> => {
      const [p, a] = await Promise.all([
        db.from('client_file_folders').select('id, client_id, name, access, visible_to_client, position, created_at').eq('client_id', clientId).order('position').order('name'),
        db.from('client_files').select('id, folder_id, name, storage_path, size_bytes, mime_type, uploaded_by, created_at').eq('client_id', clientId).order('created_at', { ascending: false }),
      ]);
      if (p.error) throw p.error;
      if (a.error) throw a.error;
      return { pastas: (p.data ?? []) as PastaDoCliente[], arquivos: (a.data ?? []) as ArquivoDoCliente[] };
    },
  });
}

const mensagemDeErro = (e: any, padrao: string) => {
  const m = String(e?.message ?? '');
  if (m.includes('uq_client_file_folders_nome')) return 'Já existe uma pasta com esse nome neste cliente.';
  if (m.includes('row-level security')) return 'Você não tem permissão para fazer isso.';
  return m || padrao;
};

export function useGerenciarPastas(clientId: string) {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const refrescar = () => qc.invalidateQueries({ queryKey: chave(clientId) });

  const criar = useMutation({
    mutationFn: async (p: { name: string; access: 'team' | 'managers'; visible_to_client: boolean; position: number }) => {
      if (!currentWorkspace?.id) throw new Error('Workspace não carregado.');
      const { data, error } = await db.from('client_file_folders').insert({ workspace_id: currentWorkspace.id, client_id: clientId, ...p }).select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => { refrescar(); toast.success('Pasta criada.'); },
    onError: (e: any) => toast.error(mensagemDeErro(e, 'Não foi possível criar a pasta.')),
  });

  const atualizar = useMutation({
    mutationFn: async (p: { id: string; name: string; access: 'team' | 'managers'; visible_to_client: boolean }) => {
      const { id, ...campos } = p;
      const { data, error } = await db.from('client_file_folders').update(campos).eq('id', id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Você não tem permissão para alterar esta pasta.');
    },
    onSuccess: () => { refrescar(); toast.success('Pasta atualizada.'); },
    onError: (e: any) => toast.error(mensagemDeErro(e, 'Não foi possível atualizar a pasta.')),
  });

  // Apaga primeiro os objetos do storage e so depois a pasta (os registros dos arquivos saem junto, em cascata).
  const excluir = useMutation({
    mutationFn: async (pasta: { id: string }) => {
      const { data: arquivos, error: e1 } = await db.from('client_files').select('storage_path').eq('folder_id', pasta.id);
      if (e1) throw e1;
      const caminhos = (arquivos ?? []).map((a: { storage_path: string }) => a.storage_path);
      if (caminhos.length) {
        const { error: e2 } = await supabase.storage.from(BUCKET).remove(caminhos);
        if (e2) throw e2;
      }
      const { data, error } = await db.from('client_file_folders').delete().eq('id', pasta.id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Só gestores excluem pastas.');
    },
    onSuccess: () => { refrescar(); toast.success('Pasta excluída.'); },
    onError: (e: any) => { refrescar(); toast.error(mensagemDeErro(e, 'Não foi possível excluir a pasta.')); },
  });

  return { criar, atualizar, excluir };
}

export interface ResultadoDoEnvio {
  enviados: number;
  falhas: string[];
}

export function useEnviarArquivos(clientId: string) {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ folderId, arquivos, aoProgredir }: { folderId: string; arquivos: File[]; aoProgredir?: (feitos: number, total: number) => void }): Promise<ResultadoDoEnvio> => {
      if (!currentWorkspace?.id) throw new Error('Workspace não carregado.');
      const falhas: string[] = [];
      let enviados = 0;
      for (const [i, arquivo] of arquivos.entries()) {
        aoProgredir?.(i, arquivos.length);
        const invalido = validarArquivo(arquivo);
        if (invalido) { falhas.push(invalido); continue; }
        const caminho = caminhoDoArquivo(currentWorkspace.id, clientId, folderId, arquivo.name, crypto.randomUUID());
        const { error: eUp } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { contentType: arquivo.type || undefined, upsert: false });
        if (eUp) { falhas.push(`"${arquivo.name}": não foi possível enviar.`); continue; }
        const { error: eReg } = await db.from('client_files').insert({
          workspace_id: currentWorkspace.id, client_id: clientId, folder_id: folderId, name: arquivo.name, storage_path: caminho, size_bytes: arquivo.size, mime_type: arquivo.type || null,
        });
        if (eReg) {
          await supabase.storage.from(BUCKET).remove([caminho]); // nao deixa objeto orfao
          falhas.push(`"${arquivo.name}": ${mensagemDeErro(eReg, 'não foi possível registrar.')}`);
          continue;
        }
        enviados += 1;
      }
      aoProgredir?.(arquivos.length, arquivos.length);
      return { enviados, falhas };
    },
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: chave(clientId) });
      if (r.enviados) toast.success(r.enviados === 1 ? 'Arquivo enviado.' : `${r.enviados} arquivos enviados.`);
      r.falhas.slice(0, 3).forEach(f => toast.error(f));
      if (r.falhas.length > 3) toast.error(`E mais ${r.falhas.length - 3} arquivos com problema.`);
    },
    onError: (e: any) => toast.error(mensagemDeErro(e, 'Não foi possível enviar.')),
  });
}

export function useExcluirArquivo(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (arquivo: ArquivoDoCliente) => {
      const { data, error } = await db.from('client_files').delete().eq('id', arquivo.id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Só gestores ou quem enviou o arquivo podem excluí-lo.');
      await supabase.storage.from(BUCKET).remove([arquivo.storage_path]);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: chave(clientId) }); toast.success('Arquivo excluído.'); },
    onError: (e: any) => toast.error(mensagemDeErro(e, 'Não foi possível excluir o arquivo.')),
  });
}

/** Abre o arquivo por uma URL assinada de 2 minutos (o bucket e privado). */
export async function abrirArquivo(arquivo: ArquivoDoCliente) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(arquivo.storage_path, 120, { download: arquivo.name });
  if (error || !data?.signedUrl) {
    toast.error('Não foi possível abrir o arquivo.');
    return;
  }
  window.open(data.signedUrl, '_blank', 'noopener');
}
