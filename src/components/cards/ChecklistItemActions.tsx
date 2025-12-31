import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MoreHorizontal, 
  Plus, 
  Pencil, 
  UserPlus, 
  Trash2, 
  Check,
  Search,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceMembers, type WorkspaceMember } from '@/hooks/useWorkspaceMembers';
import type { Checklist } from '@/hooks/useChecklists';

interface ChecklistItemActionsProps {
  item: Checklist;
  onRename: (newTitle: string) => void;
  onAddBelow: () => void;
  onAssign: (memberId: string | null, functionTitle: string | null) => void;
  onDelete: () => void;
  isRenaming: boolean;
  onStartRename: () => void;
  onCancelRename: () => void;
}

export const ChecklistItemActions: React.FC<ChecklistItemActionsProps> = ({
  item,
  onRename,
  onAddBelow,
  onAssign,
  onDelete,
  isRenaming,
  onStartRename,
  onCancelRename,
}) => {
  const [renameValue, setRenameValue] = useState(item.title);
  const [assignPopoverOpen, setAssignPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: members } = useWorkspaceMembers();

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue.trim() !== item.title) {
      onRename(renameValue.trim());
    } else {
      onCancelRename();
    }
  };

  const handleAssign = (member: WorkspaceMember | null) => {
    if (member) {
      onAssign(member.user_id, member.function_title);
    } else {
      onAssign(null, null);
    }
    setAssignPopoverOpen(false);
    setSearchQuery('');
  };

  const filteredMembers = members?.filter(m => {
    const name = m.profile?.full_name || m.profile?.email || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const assignedMember = members?.find(m => m.user_id === item.assignee_id);

  if (isRenaming) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit();
            if (e.key === 'Escape') onCancelRename();
          }}
          autoFocus
          className="h-8 text-sm"
        />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleRenameSubmit}>
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancelRename}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* Quick Add Below */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onAddBelow}
        title="Adicionar item abaixo"
      >
        <Plus className="h-4 w-4" />
      </Button>

      {/* Assign Member Popover */}
      <Popover open={assignPopoverOpen} onOpenChange={setAssignPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7',
              item.assignee_id && 'opacity-100'
            )}
            title="Atribuir"
          >
            {assignedMember ? (
              <Avatar className="h-5 w-5">
                <AvatarImage src={assignedMember.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-[8px]">
                  {(assignedMember.profile?.full_name || assignedMember.profile?.email || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="end">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar membro..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
            <ScrollArea className="h-48">
              <div className="space-y-1">
                {item.assignee_id && (
                  <button
                    onClick={() => handleAssign(null)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-sm text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                    Remover atribuição
                  </button>
                )}
                {filteredMembers?.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleAssign(member)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-left',
                      item.assignee_id === member.user_id && 'bg-accent'
                    )}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {(member.profile?.full_name || member.profile?.email || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.profile?.full_name || member.profile?.email}
                      </p>
                      {member.function_title && (
                        <p className="text-xs text-muted-foreground truncate">
                          {member.function_title}
                        </p>
                      )}
                    </div>
                    {item.assignee_id === member.user_id && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                ))}
                {filteredMembers?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum membro encontrado
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>

      {/* More Actions Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onAddBelow}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar item
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onStartRename}>
            <Pencil className="h-4 w-4 mr-2" />
            Renomear
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAssignPopoverOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Atribuir a
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
