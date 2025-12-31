import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Lightbulb,
  Link,
  Image,
  Tag,
  MoreHorizontal,
  Trash2,
  Edit,
  ExternalLink,
  Grid,
  List,
  Search,
  Sparkles,
  Palette,
  Video,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface IdeasBankViewProps {
  folderId: string;
  viewId: string;
}

interface Idea {
  id: string;
  title: string;
  description: string | null;
  reference_url: string | null;
  reference_type: 'image' | 'video' | 'article' | 'social' | 'other';
  tags: string[];
  client_name: string | null;
  thumbnail_url: string | null;
  created_at: string;
  folder_id: string;
  workspace_id: string;
}

const referenceTypes = [
  { value: 'image', label: 'Imagem', icon: Image, color: 'bg-blue-500' },
  { value: 'video', label: 'Vídeo', icon: Video, color: 'bg-red-500' },
  { value: 'article', label: 'Artigo', icon: FileText, color: 'bg-green-500' },
  { value: 'social', label: 'Post Social', icon: Sparkles, color: 'bg-purple-500' },
  { value: 'other', label: 'Outro', icon: Palette, color: 'bg-gray-500' },
];

export const IdeasBankView: React.FC<IdeasBankViewProps> = ({
  folderId,
  viewId,
}) => {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isAddingOpen, setIsAddingOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reference_url: '',
    reference_type: 'other' as Idea['reference_type'],
    tags: '',
    client_name: '',
  });

  // Fetch ideas - using cards table with a specific status for ideas
  const { data: ideas, isLoading } = useQuery({
    queryKey: ['ideas-bank', folderId],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      
      // Fetch cards that are in backlog status (ideas) for this space
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('status', 'backlog')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform cards to ideas format
      return data.map(card => ({
        id: card.id,
        title: card.title,
        description: card.description,
        reference_url: (card.briefing_data as any)?.reference_url || null,
        reference_type: (card.briefing_data as any)?.reference_type || 'other',
        tags: (card.briefing_data as any)?.tags || [],
        client_name: null, // Could be linked via client_id
        thumbnail_url: (card.briefing_data as any)?.thumbnail_url || null,
        created_at: card.created_at,
        folder_id: folderId,
        workspace_id: card.workspace_id,
      })) as Idea[];
    },
    enabled: !!folderId && !!currentWorkspace,
  });

  // Get all unique tags
  const allTags = React.useMemo(() => {
    if (!ideas) return [];
    const tagSet = new Set<string>();
    ideas.forEach(idea => {
      idea.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [ideas]);

  // Filter ideas
  const filteredIdeas = React.useMemo(() => {
    if (!ideas) return [];
    
    return ideas.filter(idea => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          idea.title.toLowerCase().includes(query) ||
          idea.description?.toLowerCase().includes(query) ||
          idea.tags?.some(tag => tag.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }
      
      // Tag filter
      if (selectedTag && !idea.tags?.includes(selectedTag)) {
        return false;
      }
      
      return true;
    });
  }, [ideas, searchQuery, selectedTag]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      reference_url: '',
      reference_type: 'other',
      tags: '',
      client_name: '',
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setEditingIdea(null);
    setIsAddingOpen(true);
  };

  const handleOpenEdit = (idea: Idea) => {
    setFormData({
      title: idea.title,
      description: idea.description || '',
      reference_url: idea.reference_url || '',
      reference_type: idea.reference_type,
      tags: idea.tags?.join(', ') || '',
      client_name: idea.client_name || '',
    });
    setEditingIdea(idea);
    setIsAddingOpen(true);
  };

  const getTypeConfig = (type: string) => {
    return referenceTypes.find(t => t.value === type) || referenceTypes[4];
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <h2 className="font-semibold">Banco de Ideias</h2>
            <Badge variant="secondary">{filteredIdeas.length} referências</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button onClick={handleOpenAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Ideia
            </Button>
          </div>
        </div>
        
        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar referências..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Tags filter */}
          <div className="flex items-center gap-1 overflow-x-auto">
            <Button
              variant={selectedTag === null ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedTag(null)}
            >
              Todas
            </Button>
            {allTags.slice(0, 5).map(tag => (
              <Button
                key={tag}
                variant={selectedTag === tag ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTag(tag)}
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {filteredIdeas.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Lightbulb className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery || selectedTag ? 'Nenhuma ideia encontrada' : 'Seu banco de ideias está vazio'}
              </h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                {searchQuery || selectedTag 
                  ? 'Tente ajustar os filtros de busca.'
                  : 'Comece a salvar referências, inspirações e ideias para criar conteúdos incríveis para seus clientes!'}
              </p>
              {!searchQuery && !selectedTag && (
                <Button onClick={handleOpenAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar primeira ideia
                </Button>
              )}
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredIdeas.map(idea => {
              const typeConfig = getTypeConfig(idea.reference_type);
              const TypeIcon = typeConfig.icon;
              
              return (
                <Card 
                  key={idea.id} 
                  className="group cursor-pointer hover:shadow-lg transition-all overflow-hidden"
                >
                  {/* Thumbnail or placeholder */}
                  <div className={cn(
                    'aspect-video flex items-center justify-center relative',
                    !idea.thumbnail_url && typeConfig.color
                  )}>
                    {idea.thumbnail_url ? (
                      <img 
                        src={idea.thumbnail_url} 
                        alt={idea.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <TypeIcon className="h-12 w-12 text-white/80" />
                    )}
                    
                    {/* Actions overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {idea.reference_url && (
                        <Button
                          size="icon"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(idea.reference_url!, '_blank');
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(idea);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        <TypeIcon className="h-3 w-3 mr-1" />
                        {typeConfig.label}
                      </Badge>
                    </div>
                    <h4 className="font-medium text-sm line-clamp-2 mb-1">{idea.title}</h4>
                    {idea.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {idea.description}
                      </p>
                    )}
                    {idea.tags && idea.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {idea.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                        {idea.tags.length > 3 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            +{idea.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredIdeas.map(idea => {
              const typeConfig = getTypeConfig(idea.reference_type);
              const TypeIcon = typeConfig.icon;
              
              return (
                <Card key={idea.id} className="hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div className={cn(
                        'h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0',
                        typeConfig.color
                      )}>
                        <TypeIcon className="h-6 w-6 text-white" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">{idea.title}</h4>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {typeConfig.label}
                          </Badge>
                        </div>
                        {idea.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {idea.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {idea.tags?.slice(0, 5).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {format(new Date(idea.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {idea.reference_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(idea.reference_url!, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(idea)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddingOpen} onOpenChange={setIsAddingOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingIdea ? 'Editar Referência' : 'Nova Referência'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Título *</label>
              <Input
                placeholder="Ex: Carrossel criativo da marca X"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1.5 block">Descrição</label>
              <Textarea
                placeholder="Por que essa referência é interessante? Para qual cliente?"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1.5 block">Link da referência</label>
              <Input
                placeholder="https://..."
                value={formData.reference_url}
                onChange={(e) => setFormData(prev => ({ ...prev, reference_url: e.target.value }))}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tipo de referência</label>
              <div className="flex flex-wrap gap-2">
                {referenceTypes.map(type => {
                  const TypeIcon = type.icon;
                  return (
                    <Button
                      key={type.value}
                      type="button"
                      variant={formData.reference_type === type.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, reference_type: type.value as any }))}
                    >
                      <TypeIcon className="h-4 w-4 mr-1" />
                      {type.label}
                    </Button>
                  );
                })}
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tags</label>
              <Input
                placeholder="Ex: instagram, carrossel, moda (separadas por vírgula)"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use tags para organizar e encontrar suas referências depois
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1.5 block">Para qual cliente?</label>
              <Input
                placeholder="Ex: Cliente X ou deixe vazio para geral"
                value={formData.client_name}
                onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsAddingOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={!formData.title.trim()}>
              {editingIdea ? 'Salvar alterações' : 'Adicionar referência'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
