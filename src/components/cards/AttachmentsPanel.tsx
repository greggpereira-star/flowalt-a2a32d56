import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Upload,
  File,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  MoreHorizontal,
  Trash2,
  Download,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  formatFileSize,
  type Attachment,
} from '@/hooks/useAttachments';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface AttachmentsPanelProps {
  cardId: string;
}

const getFileIcon = (type: string | null) => {
  if (!type) return File;
  if (type.startsWith('image/')) return FileImage;
  if (type.startsWith('video/')) return FileVideo;
  if (type.startsWith('audio/')) return FileAudio;
  if (type.includes('pdf') || type.includes('document') || type.includes('word'))
    return FileText;
  return File;
};

const getFileColor = (type: string | null): string => {
  if (!type) return 'text-muted-foreground';
  if (type.startsWith('image/')) return 'text-green-500';
  if (type.startsWith('video/')) return 'text-purple-500';
  if (type.startsWith('audio/')) return 'text-yellow-500';
  if (type.includes('pdf')) return 'text-red-500';
  if (type.includes('word') || type.includes('document')) return 'text-blue-500';
  return 'text-muted-foreground';
};

export const AttachmentsPanel: React.FC<AttachmentsPanelProps> = ({ cardId }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: attachments, isLoading } = useAttachments(cardId);
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
        await uploadAttachment.mutateAsync({
          card_id: cardId,
          file,
        });
        toast.success(`${file.name} enviado com sucesso`);
      } catch (error) {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    try {
      await deleteAttachment.mutateAsync({
        id: attachment.id,
        card_id: cardId,
        file_url: attachment.file_url,
      });
      toast.success('Anexo removido');
    } catch (error) {
      toast.error('Erro ao remover anexo');
    }
  };

  const handleDownload = (attachment: Attachment) => {
    window.open(attachment.file_url, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors',
          uploadAttachment.isPending && 'opacity-50 pointer-events-none'
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
        />
        
        {uploadAttachment.isPending ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Enviando...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Clique para enviar arquivos</p>
            <p className="text-xs text-muted-foreground">
              Imagens, vídeos, PDFs, documentos (máx. 50MB)
            </p>
          </div>
        )}
      </div>

      {/* Attachments List */}
      {attachments?.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-sm">Nenhum anexo ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments?.map((attachment) => {
            const FileIcon = getFileIcon(attachment.file_type);
            const iconColor = getFileColor(attachment.file_type);
            const isImage = attachment.file_type?.startsWith('image/');

            return (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
              >
                {/* Thumbnail or Icon */}
                <div className="flex-shrink-0">
                  {isImage ? (
                    <div className="h-12 w-12 rounded overflow-hidden bg-muted">
                      <img
                        src={attachment.file_url}
                        alt={attachment.file_name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'h-12 w-12 rounded bg-muted flex items-center justify-center',
                        iconColor
                      )}
                    >
                      <FileIcon className="h-6 w-6" />
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{attachment.file_size ? formatFileSize(attachment.file_size) : '-'}</span>
                    <span>•</span>
                    <span>
                      {format(new Date(attachment.created_at), "dd MMM 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDownload(attachment)}>
                      <Download className="h-4 w-4 mr-2" />
                      Baixar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(attachment)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
