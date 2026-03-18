import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Upload,
  File,
  FileImage,
  FileText,
  Trash2,
  Download,
  Loader2,
  Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useTransactionAttachments,
  useUploadTransactionAttachment,
  useDeleteTransactionAttachment,
} from '@/hooks/useTransactionAttachments';
import { formatFileSize } from '@/hooks/useAttachments';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface TransactionAttachmentsProps {
  transactionId: string | undefined;
  compact?: boolean;
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

export const TransactionAttachments: React.FC<TransactionAttachmentsProps> = ({
  transactionId,
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: attachments = [], isLoading } = useTransactionAttachments(transactionId);
  const uploadAttachment = useUploadTransactionAttachment();
  const deleteAttachment = useDeleteTransactionAttachment();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !transactionId) return;

    for (const file of Array.from(files)) {
      try {
        await uploadAttachment.mutateAsync({ transaction_id: transactionId, file });
        toast.success(`${file.name} anexado com sucesso`);
      } catch {
        toast.error(`Erro ao anexar ${file.name}`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (att: { id: string; file_url: string }) => {
    if (!transactionId) return;
    try {
      await deleteAttachment.mutateAsync({ id: att.id, transaction_id: transactionId, file_url: att.file_url });
      toast.success('Anexo removido');
    } catch {
      toast.error('Erro ao remover anexo');
    }
  };

  if (!transactionId) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        <Paperclip className="h-5 w-5 mx-auto mb-1 opacity-40" />
        Salve o lançamento primeiro para anexar documentos
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          Anexos
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
        <p className="text-xs text-muted-foreground text-center py-2">
          Nenhum documento anexado
        </p>
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
                    onClick={() => window.open(att.file_url, '_blank')}
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
