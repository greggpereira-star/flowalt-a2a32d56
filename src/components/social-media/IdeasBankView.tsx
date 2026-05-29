import { useEffect, useState } from 'react';
import { useIdeaBoards } from '@/hooks/useIdeaBoards';
import { BoardsGalleryView } from '@/components/ideas-bank/BoardsGalleryView';
import { BoardMoodboardView } from '@/components/ideas-bank/BoardMoodboardView';
import { Skeleton } from '@/components/ui/skeleton';

interface IdeasBankViewProps {
  folderId: string;
  viewId: string;
}

/**
 * Wrapper que mantém o contrato antigo (folderId, viewId) e renderiza
 * a nova experiência Central Criativa, escopada à pasta atual.
 * - Se houver uma única board ligada à pasta, abre direto o moodboard.
 * - Caso contrário, mostra a galeria de boards da pasta.
 */
export const IdeasBankView: React.FC<IdeasBankViewProps> = ({ folderId }) => {
  const { boards, isLoading, create } = useIdeaBoards({ folderId });
  const [openBoardId, setOpenBoardId] = useState<string | null>(null);
  const [autoCreated, setAutoCreated] = useState(false);

  // Se a pasta nunca teve um quadro, cria um default automaticamente
  useEffect(() => {
    if (!isLoading && boards.length === 0 && !autoCreated && folderId) {
      setAutoCreated(true);
      create.mutate(
        { name: 'Quadro de ideias', folder_id: folderId, description: 'Quadro padrão desta pasta.' },
        { onSuccess: (b) => setOpenBoardId(b.id) },
      );
    }
  }, [isLoading, boards.length, autoCreated, folderId]);

  if (isLoading) {
    return (
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
        ))}
      </div>
    );
  }

  if (openBoardId) {
    return (
      <BoardMoodboardView
        boardId={openBoardId}
        onBack={boards.length > 1 ? () => setOpenBoardId(null) : undefined}
      />
    );
  }

  if (boards.length === 1) {
    return <BoardMoodboardView boardId={boards[0].id} />;
  }

  return <BoardsGalleryView folderId={folderId} onOpenBoard={setOpenBoardId} />;
};
