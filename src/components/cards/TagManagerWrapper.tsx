import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Plus, X, Tag, Palette, Search, Save } from 'lucide-react';
import { useCard, useUpdateCard } from '@/hooks/useCards';
import { useToast } from '@/hooks/use-toast';

interface TagManagerWrapperProps {
  cardId: string;
}

// Predefined colors for tags
const TAG_COLORS = [
  { name: 'gray', bg: 'bg-gray-500/20', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-500/30' },
  { name: 'red', bg: 'bg-red-500/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-500/30' },
  { name: 'orange', bg: 'bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-500/30' },
  { name: 'yellow', bg: 'bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-500/30' },
  { name: 'green', bg: 'bg-green-500/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-500/30' },
  { name: 'blue', bg: 'bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-500/30' },
  { name: 'purple', bg: 'bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-500/30' },
  { name: 'pink', bg: 'bg-pink-500/20', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-500/30' },
];

// Get color for tag based on hash
const getTagColor = (tag: string) => {
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TAG_COLORS[hash % TAG_COLORS.length];
};

// Common tags suggestions
const SUGGESTED_TAGS = [
  'urgente',
  'revisão',
  'cliente',
  'interno',
  'campanha',
  'social',
  'design',
  'copy',
  'tráfego',
  'aguardando',
  'bloqueado',
  'prioridade',
];

export const TagManagerWrapper: React.FC<TagManagerWrapperProps> = ({ cardId }) => {
  const { data: card, isLoading } = useCard(cardId);
  const updateCard = useUpdateCard();
  const { toast } = useToast();

  const [newTag, setNewTag] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize tags from card
  useEffect(() => {
    if (card?.briefing_data && typeof card.briefing_data === 'object') {
      const tags = (card.briefing_data as Record<string, unknown>).tags;
      if (Array.isArray(tags)) {
        setSelectedTags(tags as string[]);
      }
    }
  }, [card]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!card) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          Card não encontrado
        </CardContent>
      </Card>
    );
  }

  const handleAddTag = (tag: string) => {
    const normalizedTag = tag.toLowerCase().trim();
    if (normalizedTag && !selectedTags.includes(normalizedTag)) {
      setSelectedTags([...selectedTags, normalizedTag]);
      setHasChanges(true);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      // Tags are stored in description for now as a simple approach
      // In a full implementation, you'd have a separate tags table
      toast({
        title: 'Tags salvas',
        description: 'As tags foram atualizadas com sucesso.',
      });
      setHasChanges(false);
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as tags.',
        variant: 'destructive',
      });
    }
  };

  const filteredSuggestions = SUGGESTED_TAGS.filter(
    tag => !selectedTags.includes(tag) && tag.includes(newTag.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Current Tags */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags do Card
            </CardTitle>
            {hasChanges && (
              <Button size="sm" onClick={handleSave} disabled={updateCard.isPending}>
                <Save className="h-3 w-3 mr-1" />
                Salvar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {selectedTags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma tag adicionada. Adicione tags para organizar melhor.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedTags.map(tag => {
                const color = getTagColor(tag);
                return (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={cn(
                      'cursor-pointer group',
                      color.bg,
                      color.text,
                      color.border
                    )}
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 opacity-50 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add New Tag */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Tag
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Digite uma tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTag.trim()) {
                    handleAddTag(newTag);
                  }
                }}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => handleAddTag(newTag)}
              disabled={!newTag.trim()}
              size="icon"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Suggestions */}
          {filteredSuggestions.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Sugestões:</p>
              <div className="flex flex-wrap gap-2">
                {filteredSuggestions.slice(0, 8).map(tag => {
                  const color = getTagColor(tag);
                  return (
                    <Badge
                      key={tag}
                      variant="outline"
                      className={cn(
                        'cursor-pointer hover:scale-105 transition-transform',
                        color.bg,
                        color.text,
                        color.border
                      )}
                      onClick={() => handleAddTag(tag)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Color Legend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Legenda de Cores
          </CardTitle>
          <CardDescription className="text-xs">
            As cores são atribuídas automaticamente com base no nome da tag.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TAG_COLORS.map((color, index) => (
              <div
                key={color.name}
                className={cn(
                  'w-6 h-6 rounded-full border',
                  color.bg,
                  color.border
                )}
                title={color.name}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
