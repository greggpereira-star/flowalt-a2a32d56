import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Upload, File, FileImage, FileText, Trash2, Download, Loader2, Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useContractAttachments,
  useUploadContractAttachment,
  useDeleteContractAttachment,
} from '@/hooks/useContractAttachments';
import { formatFileSize } from '@/hooks/useAttachments';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface ContractAttachmentsProps {
  clientId: string | undefined;
}

const getFileIcon = (type: string | null) => {
  if (!type) return File;
  if (type.startsWith('image/')) return FileImage;
  if (type.includes('pdf') || type.includes('document') || type.includes('word')) return FileText;
  return File;
};

const getFileColor = (type: string | null): string => {
  if (!type) return 'text-muted-foreground';
  if (type.startsWith('image/')) return 'text-green-500';
  if (type.includes('pdf')) return 'text-red-500';
  if (type.includes('word') || type.includes('document')) return 'text-blue-500';
  return 'text-muted-foreground';
};

export const ContractAttachments: React.FC<ContractAttachmentsProps> = ({ clientId }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: attachments = [], isLoading } = useContractAttachments(clientId);
  const uploadAttachment = useUploadContractAttachment();
  const deleteAttachment = useDeleteContractAttachment();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !clientId) return;

    for (const file of Array.from(files)) {
      try {
        await uploadAttachment.mutateAsync({ client_id: clientId, file });
        toast.success(`${file.name} anexado com sucesso`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'falha no upload';
        toast.error(`Erro ao anexar ${file.name}: ${msg}`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (att: { id: string; file_url: string }) => {
    if (!clientId) return;
    try {
      await deleteAttachment.mutateAsync({ id: att.id, client_id: clientId, file_url: att.file_url });
      toast.success('Anexo removido');
    } catch {
      toast.error('Erro ao remover anexo');
    }
  };

  if (!clientId) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          Documentos do Contrato
          {attachments.length > 0 && (
            <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
              {attachments.length}
            </span>
          )}
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          disabled={uploadAttachment.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadAttachment.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Anexar
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept="*/*"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : attachments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          <Paperclip className="h-5 w-5 mx-auto mb-1 opacity-40" />
          Nenhum documento anexado ao contrato
        </div>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((att) => {
            const IconComp = getFileIcon(att.file_type);
            const iconColor = getFileColor(att.file_type);
            return (
              <div
                key={att.id}
                className="flex items-center gap-2.5 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors group text-sm"
              >
                <div className={cn('flex-shrink-0', iconColor)}>
                  <IconComp className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium">{att.file_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {att.file_size ? formatFileSize(att.file_size) : ''}
                    {att.file_size ? ' · ' : ''}
                    {format(new Date(att.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!att.download_url}
                    onClick={() => att.download_url && window.open(att.download_url, '_blank', 'noopener,noreferrer')}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(att)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
