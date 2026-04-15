import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MoreHorizontal,
  Link2,
  BellOff,
  FileText,
  Clock,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

interface CommentContextMenuProps {
  commentId: string;
  isAuthor: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddToDescription?: () => void;
}

export const CommentContextMenu: React.FC<CommentContextMenuProps> = ({
  commentId,
  isAuthor,
  onEdit,
  onDelete,
  onAddToDescription,
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.href}#comment-${commentId}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado');
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-6 w-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted/80 transition-all text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-lg shadow-lg">
          <DropdownMenuItem onClick={handleCopyLink} className="gap-2 text-xs cursor-pointer">
            <Link2 className="h-3.5 w-3.5" />
            Copiar URL
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2 text-xs cursor-pointer">
              <Clock className="h-3.5 w-3.5" />
              Lembrar-me
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => toast.success('Lembrete em 30 min')}>Em 30 min</DropdownMenuItem>
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => toast.success('Lembrete em 1 hora')}>Em 1 hora</DropdownMenuItem>
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => toast.success('Lembrete amanhã')}>Amanhã</DropdownMenuItem>
              <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => toast.success('Lembrete próxima semana')}>Próxima semana</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {onAddToDescription && (
            <DropdownMenuItem onClick={onAddToDescription} className="gap-2 text-xs cursor-pointer">
              <FileText className="h-3.5 w-3.5" />
              Adicionar à descrição
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="gap-2 text-xs cursor-pointer">
            <BellOff className="h-3.5 w-3.5" />
            Não me notifique sobre respostas
          </DropdownMenuItem>

          {isAuthor && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit} className="gap-2 text-xs cursor-pointer">
                <Pencil className="h-3.5 w-3.5" />
                Editar comentário
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteDialogOpen(true)}
                className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir comentário
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
