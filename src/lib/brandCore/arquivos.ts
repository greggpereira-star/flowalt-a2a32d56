/** Regras puras dos arquivos do cliente (Brand Core): nome seguro, caminho no storage, validação e exibição. */

export const LIMITE_ARQUIVO_BYTES = 52_428_800; // 50 MB, o mesmo limite do bucket
// Executáveis não entram: o cliente baixa o que estiver numa pasta visível a ele.
const EXTENSOES_BLOQUEADAS = ['exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'vbs', 'ps1', 'jar', 'dll', 'apk', 'js', 'sh'];

const extensaoDe = (nome: string) => {
  const i = nome.lastIndexOf('.');
  return i > 0 && i < nome.length - 1 ? nome.slice(i + 1).toLowerCase() : '';
};

/** Nome sem acento nem caracteres que quebram caminho ou URL; mantém a extensão e limita o tamanho. */
export function nomeSeguro(nome: string): string {
  const ext = extensaoDe(nome).replace(/[^a-z0-9]/g, '').slice(0, 10);
  const base = (ext ? nome.slice(0, nome.lastIndexOf('.')) : nome)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  const corpo = base || 'arquivo';
  return ext ? `${corpo}.${ext}` : corpo;
}

/** <workspace>/<cliente>/<pasta>/<uuid>-<nome>: o padrão que o banco exige. */
export function caminhoDoArquivo(workspaceId: string, clientId: string, folderId: string, nome: string, uuid: string): string {
  return `${workspaceId}/${clientId}/${folderId}/${uuid}-${nomeSeguro(nome)}`;
}

/** Mensagem de erro, ou null se o arquivo pode ser enviado. */
export function validarArquivo(arquivo: { name: string; size: number }): string | null {
  if (!arquivo.size) return `"${arquivo.name}" está vazio.`;
  if (arquivo.size > LIMITE_ARQUIVO_BYTES) return `"${arquivo.name}" passa de 50 MB.`;
  if (EXTENSOES_BLOQUEADAS.includes(extensaoDe(arquivo.name))) return `"${arquivo.name}": este tipo de arquivo não pode ser enviado.`;
  return null;
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1).replace('.', ',') : Math.round(mb)} MB`;
}

export type TipoDeArquivo = 'imagem' | 'video' | 'pdf' | 'planilha' | 'documento' | 'arquivo';

export function tipoDoArquivo(mime: string | null | undefined, nome: string): TipoDeArquivo {
  const m = (mime ?? '').toLowerCase();
  const e = extensaoDe(nome);
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(e)) return 'imagem';
  if (m.startsWith('video/') || ['mp4', 'mov', 'webm'].includes(e)) return 'video';
  if (m === 'application/pdf' || e === 'pdf') return 'pdf';
  if (m.includes('spreadsheet') || m.includes('excel') || ['xls', 'xlsx', 'csv', 'ods'].includes(e)) return 'planilha';
  if (m.includes('word') || m.includes('document') || m.startsWith('text/') || ['doc', 'docx', 'txt', 'md', 'odt', 'ppt', 'pptx', 'key'].includes(e)) return 'documento';
  return 'arquivo';
}
