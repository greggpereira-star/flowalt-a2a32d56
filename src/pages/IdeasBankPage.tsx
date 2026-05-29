import { useState } from 'react';
import { BoardsGalleryView } from '@/components/ideas-bank/BoardsGalleryView';
import { BoardMoodboardView } from '@/components/ideas-bank/BoardMoodboardView';

const IdeasBankPage = () => {
  const [openBoardId, setOpenBoardId] = useState<string | null>(null);

  if (openBoardId) {
    return <BoardMoodboardView boardId={openBoardId} onBack={() => setOpenBoardId(null)} />;
  }
  return <BoardsGalleryView onOpenBoard={(id) => setOpenBoardId(id)} />;
};

export default IdeasBankPage;
