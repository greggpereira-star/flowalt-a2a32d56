import React from 'react';
import { Plus, Link, CheckSquare, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskInlineActionsProps {
  onAddSubtask?: () => void;
  onLinkItems?: () => void;
  onCreateChecklist?: () => void;
  onAttachFile?: () => void;
}

const ActionRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick?: () => void;
}> = ({ icon, label, shortcut, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 w-full px-2 py-[7px] rounded-md text-[13px] text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all group/action"
  >
    {icon}
    <span>{label}</span>
    {shortcut && (
      <span className="ml-auto text-[10px] text-muted-foreground/50 opacity-0 group-hover/action:opacity-100 transition-opacity">
        {shortcut}
      </span>
    )}
  </button>
);

export const TaskInlineActions: React.FC<TaskInlineActionsProps> = ({
  onAddSubtask,
  onLinkItems,
  onCreateChecklist,
  onAttachFile,
}) => {
  return (
    <div className="flex flex-col gap-0 border-t border-border/30 pt-2 mt-1">
      <ActionRow icon={<Plus className="h-3.5 w-3.5" />} label="Adicionar subtarefa" shortcut="S" onClick={onAddSubtask} />
      <ActionRow icon={<Link className="h-3.5 w-3.5" />} label="Vincular itens ou adicionar dependências" onClick={onLinkItems} />
      <ActionRow icon={<CheckSquare className="h-3.5 w-3.5" />} label="Criar checklist" onClick={onCreateChecklist} />
      <ActionRow icon={<Paperclip className="h-3.5 w-3.5" />} label="Anexar arquivo" onClick={onAttachFile} />
    </div>
  );
};
