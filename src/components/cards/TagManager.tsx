import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Plus, X, Tag, Palette, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TagManagerProps {
  tags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  allowCreate?: boolean;
  compact?: boolean;
}

// Predefined colors for tags
const TAG_COLORS = [
  { name: 'gray', bg: 'bg-gray-500/20', text: 'text-gray-700', border: 'border-gray-500/30' },
  { name: 'red', bg: 'bg-red-500/20', text: 'text-red-700', border: 'border-red-500/30' },
  { name: 'orange', bg: 'bg-orange-500/20', text: 'text-orange-700', border: 'border-orange-500/30' },
  { name: 'yellow', bg: 'bg-yellow-500/20', text: 'text-yellow-700', border: 'border-yellow-500/30' },
  { name: 'green', bg: 'bg-green-500/20', text: 'text-green-700', border: 'border-green-500/30' },
  { name: 'blue', bg: 'bg-blue-500/20', text: 'text-blue-700', border: 'border-blue-500/30' },
  { name: 'purple', bg: 'bg-purple-500/20', text: 'text-purple-700', border: 'border-purple-500/30' },
  { name: 'pink', bg: 'bg-pink-500/20', text: 'text-pink-700', border: 'border-pink-500/30' },
];

// Get color for tag based on hash
const getTagColor = (tag: string) => {
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TAG_COLORS[hash % TAG_COLORS.length];
};

export const TagManager: React.FC<TagManagerProps> = ({
  tags,
  selectedTags,
  onTagsChange,
  allowCreate = true,
  compact = false,
}) => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // Filter tags by search
  const filteredTags = useMemo(() => {
    if (!searchQuery) return tags;
    return tags.filter(tag => 
      tag.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tags, searchQuery]);

  // Toggle tag selection
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  // Create new tag
  const createTag = () => {
    if (!newTagName.trim()) return;
    
    const normalizedTag = newTagName.trim().toLowerCase();
    if (tags.includes(normalizedTag)) {
      toast({ title: 'Tag já existe', variant: 'destructive' });
      return;
    }
    
    // Add to selection
    onTagsChange([...selectedTags, normalizedTag]);
    setNewTagName('');
    setIsDialogOpen(false);
    toast({ title: 'Tag criada' });
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {selectedTags.map(tag => {
          const color = getTagColor(tag);
          return (
            <Badge
              key={tag}
              variant="outline"
              className={cn(
                'cursor-pointer text-xs',
                color.bg, color.text, color.border
              )}
              onClick={() => toggleTag(tag)}
            >
              {tag}
              <X className="h-2 w-2 ml-1" />
            </Badge>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
              <Plus className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <div className="p-2">
              <Input
                placeholder="Buscar tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <ScrollArea className="h-32">
              {filteredTags.map(tag => (
                <DropdownMenuItem
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'flex items-center gap-2',
                    selectedTags.includes(tag) && 'bg-primary/10'
                  )}
                >
                  <div className={cn('w-2 h-2 rounded-full', getTagColor(tag).bg.replace('/20', ''))} />
                  {tag}
                </DropdownMenuItem>
              ))}
            </ScrollArea>
            {allowCreate && (
              <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-3 w-3 mr-2" />
                Criar nova tag
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Create dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[300px]">
            <DialogHeader>
              <DialogTitle>Nova Tag</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Nome da tag"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createTag()}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={createTag}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Tags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Selected tags */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-muted-foreground mr-1">Selecionadas:</span>
            {selectedTags.map(tag => {
              const color = getTagColor(tag);
              return (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn(
                    'cursor-pointer',
                    color.bg, color.text, color.border
                  )}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              );
            })}
          </div>
        )}

        {/* Available tags */}
        <ScrollArea className="h-32">
          <div className="flex flex-wrap gap-1">
            {filteredTags
              .filter(t => !selectedTags.includes(t))
              .map(tag => {
                const color = getTagColor(tag);
                return (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={cn(
                      'cursor-pointer opacity-60 hover:opacity-100',
                      color.bg, color.text, color.border
                    )}
                    onClick={() => toggleTag(tag)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                );
              })}
          </div>
        </ScrollArea>

        {/* Create new */}
        {allowCreate && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Nova Tag
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[300px]">
              <DialogHeader>
                <DialogTitle>Nova Tag</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="Nome da tag"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createTag()}
              />
              <div className="flex gap-1">
                {TAG_COLORS.map(color => (
                  <div
                    key={color.name}
                    className={cn(
                      'w-6 h-6 rounded cursor-pointer',
                      color.bg.replace('/20', '')
                    )}
                  />
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={createTag}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
};

// Simple inline tag display
export const TagBadges: React.FC<{ tags: string[]; max?: number }> = ({ tags, max = 3 }) => {
  const visibleTags = tags.slice(0, max);
  const remaining = tags.length - max;

  return (
    <div className="flex flex-wrap gap-1">
      {visibleTags.map(tag => {
        const color = getTagColor(tag);
        return (
          <Badge
            key={tag}
            variant="outline"
            className={cn(
              'text-[10px] px-1 py-0',
              color.bg, color.text, color.border
            )}
          >
            {tag}
          </Badge>
        );
      })}
      {remaining > 0 && (
        <Badge variant="outline" className="text-[10px] px-1 py-0">
          +{remaining}
        </Badge>
      )}
    </div>
  );
};
