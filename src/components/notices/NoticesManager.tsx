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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNoticeConfirmations, useNoticeStats } from '@/hooks/useNoticesModule';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Send, Bell, AlertTriangle, PartyPopper, Calendar, Info, Wrench, FileText, 
  Trash2, Edit, Eye, Clock, Users, CheckCircle2, Shield, ChevronRight,
  UserCheck, Percent
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
  const [selectedNotice, setSelectedNotice] = useState<any | null>(null);

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
        status: 'active',
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

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-500" />
                  Confirmação Obrigatória
                </Label>
                <div className="flex items-center gap-3 pt-2">
                  <Switch
                    id="requires_confirmation"
                    checked={formData.requires_confirmation}
                    onCheckedChange={(v) => setFormData({ ...formData, requires_confirmation: v })}
                  />
                  <Label htmlFor="requires_confirmation" className="text-sm text-muted-foreground">
                    {formData.requires_confirmation ? 'Ativada' : 'Desativada'}
                  </Label>
                </div>
              </div>
            </div>

            {formData.requires_confirmation && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-700 dark:text-amber-400">
                      Confirmação obrigatória ativada
                    </p>
                    <p className="text-muted-foreground mt-1">
                      O aviso aparecerá em tela cheia e só poderá ser fechado após o usuário confirmar a leitura. 
                      Você poderá acompanhar quem já confirmou.
                    </p>
                  </div>
                </div>
              </div>
            )}

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
                        onViewConfirmations={() => setSelectedNotice(notice)}
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
                        onViewConfirmations={() => setSelectedNotice(notice)}
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

      {/* Confirmations Sheet */}
      <ConfirmationsSheet 
        notice={selectedNotice} 
        onClose={() => setSelectedNotice(null)} 
      />
    </div>
  );
};

const NoticeCard: React.FC<{
  notice: any;
  onEdit: () => void;
  onDelete: () => void;
  onViewConfirmations: () => void;
  expired?: boolean;
}> = ({ notice, onEdit, onDelete, onViewConfirmations, expired }) => {
  const CategoryIcon = categoryOptions.find(c => c.value === notice.category)?.icon || Info;
  const priorityOption = priorityOptions.find(p => p.value === notice.priority);
  const { data: stats } = useNoticeStats(notice.id);

  return (
    <div className="p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 rounded-full bg-muted">
            <CategoryIcon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-medium">{notice.title}</h4>
              <Badge variant="outline" className="text-xs">
                {categoryOptions.find(c => c.value === notice.category)?.label}
              </Badge>
              <div className={`w-2 h-2 rounded-full ${priorityOption?.color}`} />
              {notice.requires_confirmation && (
                <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600">
                  <Shield className="h-3 w-3 mr-1" />
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
              
              {notice.requires_confirmation && stats && (
                <button 
                  onClick={onViewConfirmations}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <UserCheck className="h-3 w-3" />
                  {stats.confirmations}/{stats.totalMembers} confirmaram ({stats.percentage}%)
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
            
            {notice.requires_confirmation && stats && (
              <div className="mt-2">
                <Progress value={stats.percentage} className="h-1.5" />
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {notice.requires_confirmation && (
            <Button size="icon" variant="ghost" onClick={onViewConfirmations} className="h-8 w-8" title="Ver confirmações">
              <Users className="h-4 w-4" />
            </Button>
          )}
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

const ConfirmationsSheet: React.FC<{
  notice: any | null;
  onClose: () => void;
}> = ({ notice, onClose }) => {
  const { data: confirmations, isLoading } = useNoticeConfirmations(notice?.id || '');
  const { data: stats } = useNoticeStats(notice?.id || '');

  if (!notice) return null;

  return (
    <Sheet open={!!notice} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Confirmações de Leitura
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Notice Info */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h3 className="font-medium mb-1">{notice.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{notice.content}</p>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="text-2xl font-bold">{stats.totalMembers}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.confirmations}</div>
                <div className="text-xs text-muted-foreground">Confirmaram</div>
              </div>
              <div className="text-center p-4 bg-amber-500/10 rounded-lg">
                <div className="text-2xl font-bold text-amber-600">{stats.totalMembers - stats.confirmations}</div>
                <div className="text-xs text-muted-foreground">Pendentes</div>
              </div>
            </div>
          )}

          {/* Progress */}
          {stats && (
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{stats.percentage}%</span>
              </div>
              <Progress value={stats.percentage} className="h-2" />
            </div>
          )}

          {/* Confirmations List */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Quem confirmou ({confirmations?.length || 0})
            </h4>
            <ScrollArea className="h-[300px]">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : confirmations && confirmations.length > 0 ? (
                <div className="space-y-3 pr-4">
                  {confirmations.map((conf) => (
                    <div key={conf.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-green-500/10 text-green-600">
                          {conf.user_email?.charAt(0).toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{conf.user_email}</p>
                        <p className="text-xs text-muted-foreground">
                          Confirmou em {format(new Date(conf.confirmed_at), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma confirmação ainda</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
