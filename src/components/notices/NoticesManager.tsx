import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Send, Bell, AlertTriangle, PartyPopper, Calendar, Info, Wrench, FileText, 
  Trash2, Edit, Eye, Clock, Users, CheckCircle2
} from 'lucide-react';

interface NoticeFormData {
  title: string;
  content: string;
  category: 'general' | 'urgent' | 'celebration' | 'holiday' | 'maintenance' | 'policy';
  priority: 'low' | 'normal' | 'high' | 'critical';
  requires_confirmation: boolean;
  starts_at: string;
  ends_at: string;
}

const categoryOptions = [
  { value: 'general', label: 'Geral', icon: Info },
  { value: 'urgent', label: 'Urgente', icon: AlertTriangle },
  { value: 'celebration', label: 'Celebração', icon: PartyPopper },
  { value: 'holiday', label: 'Feriado', icon: Calendar },
  { value: 'maintenance', label: 'Manutenção', icon: Wrench },
  { value: 'policy', label: 'Política', icon: FileText },
];

const priorityOptions = [
  { value: 'low', label: 'Baixa', color: 'bg-muted' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-500' },
  { value: 'high', label: 'Alta', color: 'bg-amber-500' },
  { value: 'critical', label: 'Crítica', color: 'bg-destructive' },
];

export const NoticesManager: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<NoticeFormData>({
    title: '',
    content: '',
    category: 'general',
    priority: 'normal',
    requires_confirmation: false,
    starts_at: new Date().toISOString().slice(0, 16),
    ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetch notices
  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['workspace-notices', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Create/Update notice
  const saveMutation = useMutation({
    mutationFn: async (data: NoticeFormData) => {
      if (!currentWorkspace?.id || !user?.id) throw new Error('Missing context');
      
      const noticeData = {
        ...data,
        workspace_id: currentWorkspace.id,
        created_by: user.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from('notices')
          .update(noticeData)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notices')
          .insert(noticeData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-notices'] });
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      toast.success(editingId ? 'Aviso atualizado!' : 'Aviso enviado!');
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao salvar aviso: ' + error.message);
    },
  });

  // Delete notice
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-notices'] });
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      toast.success('Aviso removido');
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      category: 'general',
      priority: 'normal',
      requires_confirmation: false,
      starts_at: new Date().toISOString().slice(0, 16),
      ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    });
    setEditingId(null);
  };

  const handleEdit = (notice: any) => {
    setFormData({
      title: notice.title,
      content: notice.content || '',
      category: notice.category,
      priority: notice.priority,
      requires_confirmation: notice.requires_confirmation,
      starts_at: new Date(notice.starts_at).toISOString().slice(0, 16),
      ends_at: new Date(notice.ends_at).toISOString().slice(0, 16),
    });
    setEditingId(notice.id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Título é obrigatório');
      return;
    }
    saveMutation.mutate(formData);
  };

  const activeNotices = notices.filter((n: any) => new Date(n.ends_at) >= new Date());
  const expiredNotices = notices.filter((n: any) => new Date(n.ends_at) < new Date());

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {editingId ? 'Editar Aviso' : 'Enviar Novo Aviso'}
          </CardTitle>
          <CardDescription>
            Crie avisos e comunicados para todos os membros do workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Título do aviso"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v: any) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <opt.icon className="h-4 w-4" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v: any) => setFormData({ ...formData, priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Descrição detalhada do aviso..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="starts_at">Início</Label>
                <Input
                  id="starts_at"
                  type="datetime-local"
                  value={formData.starts_at}
                  onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ends_at">Término</Label>
                <Input
                  id="ends_at"
                  type="datetime-local"
                  value={formData.ends_at}
                  onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2 pt-8">
                <Switch
                  id="requires_confirmation"
                  checked={formData.requires_confirmation}
                  onCheckedChange={(v) => setFormData({ ...formData, requires_confirmation: v })}
                />
                <Label htmlFor="requires_confirmation">Requer confirmação de leitura</Label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                <Send className="h-4 w-4 mr-2" />
                {editingId ? 'Atualizar' : 'Enviar Aviso'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Avisos Enviados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active" className="gap-2">
                <Eye className="h-4 w-4" />
                Ativos ({activeNotices.length})
              </TabsTrigger>
              <TabsTrigger value="expired" className="gap-2">
                <Clock className="h-4 w-4" />
                Expirados ({expiredNotices.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              <ScrollArea className="h-[400px]">
                {activeNotices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum aviso ativo
                  </div>
                ) : (
                  <div className="space-y-3 pr-4">
                    {activeNotices.map((notice: any) => (
                      <NoticeCard
                        key={notice.id}
                        notice={notice}
                        onEdit={() => handleEdit(notice)}
                        onDelete={() => deleteMutation.mutate(notice.id)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="expired">
              <ScrollArea className="h-[400px]">
                {expiredNotices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum aviso expirado
                  </div>
                ) : (
                  <div className="space-y-3 pr-4 opacity-70">
                    {expiredNotices.map((notice: any) => (
                      <NoticeCard
                        key={notice.id}
                        notice={notice}
                        onEdit={() => handleEdit(notice)}
                        onDelete={() => deleteMutation.mutate(notice.id)}
                        expired
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

const NoticeCard: React.FC<{
  notice: any;
  onEdit: () => void;
  onDelete: () => void;
  expired?: boolean;
}> = ({ notice, onEdit, onDelete, expired }) => {
  const CategoryIcon = categoryOptions.find(c => c.value === notice.category)?.icon || Info;
  const priorityOption = priorityOptions.find(p => p.value === notice.priority);

  return (
    <div className="p-4 border rounded-lg bg-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 rounded-full bg-muted">
            <CategoryIcon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium truncate">{notice.title}</h4>
              <Badge variant="outline" className="text-xs">
                {categoryOptions.find(c => c.value === notice.category)?.label}
              </Badge>
              <div className={`w-2 h-2 rounded-full ${priorityOption?.color}`} />
              {notice.requires_confirmation && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Confirmação
                </Badge>
              )}
            </div>
            {notice.content && (
              <p className="text-sm text-muted-foreground line-clamp-2">{notice.content}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(notice.starts_at), "d MMM", { locale: ptBR })} - {format(new Date(notice.ends_at), "d MMM", { locale: ptBR })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={onEdit} className="h-8 w-8">
            <Edit className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8 text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
