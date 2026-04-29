import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChecklistPanel } from '../ChecklistPanel';
import { TimeTrackingPanel } from '../TimeTrackingPanel';
import { AttachmentsPanel } from '../AttachmentsPanel';
import { CardExecutionAssistantWrapper } from '../CardExecutionAssistantWrapper';
import { TagManagerWrapper } from '../TagManagerWrapper';
import { CardFinancialTab } from '../CardFinancialTab';
import { CardKitTab } from '../CardKitTab';
import { CardInvitePanel } from '../CardInvitePanel';
import { SocialPostButton } from '@/components/social-media/SocialPostButton';
import {
  CheckSquare,
  Clock,
  Paperclip,
  Sparkles,
  DollarSign,
  Package,
  UserPlus,
  Share2,
  Tags,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardResourceTabsProps {
  cardId: string;
  clientId: string | null;
  checklistCompleted: number;
  checklistTotal: number;
  attachmentsCount: number;
  hasSocialPublish: boolean;
  socialPostsCount: number;
  value?: string;
  onValueChange?: (v: string) => void;
}

const TAB_META: Record<string, { label: string; description: string; icon: React.ComponentType<{ className?: string }>; accent: string }> = {
  checklist: { label: 'Tarefas & Checklist', description: 'Quebre a demanda em subtarefas e acompanhe o progresso.', icon: CheckSquare, accent: 'from-emerald-500/70 to-emerald-500/0' },
  tags: { label: 'Tags', description: 'Organize e categorize esta demanda com etiquetas.', icon: Tags, accent: 'from-violet-500/70 to-violet-500/0' },
  time: { label: 'Tempo trabalhado', description: 'Histórico de horas e apontamentos do time.', icon: Clock, accent: 'from-blue-500/70 to-blue-500/0' },
  attachments: { label: 'Arquivos & Anexos', description: 'Documentos, imagens e referências da demanda.', icon: Paperclip, accent: 'from-amber-500/70 to-amber-500/0' },
  financial: { label: 'Financeiro', description: 'Custos, receitas e impacto financeiro do card.', icon: DollarSign, accent: 'from-green-500/70 to-green-500/0' },
  kit: { label: 'Equipamentos', description: 'Kits e itens de inventário alocados.', icon: Package, accent: 'from-orange-500/70 to-orange-500/0' },
  invites: { label: 'Convites & Vínculos', description: 'Convide pessoas ou vincule itens relacionados.', icon: UserPlus, accent: 'from-pink-500/70 to-pink-500/0' },
  assistant: { label: 'Assistente IA', description: 'Sugestões inteligentes para acelerar a execução.', icon: Sparkles, accent: 'from-primary/70 to-primary/0' },
  social: { label: 'Social Media', description: 'Postagens vinculadas e publicações.', icon: Share2, accent: 'from-fuchsia-500/70 to-fuchsia-500/0' },
};

export const CardResourceTabs = React.forwardRef<HTMLDivElement, CardResourceTabsProps>(({
  cardId,
  clientId,
  checklistCompleted,
  checklistTotal,
  attachmentsCount,
  hasSocialPublish,
  socialPostsCount,
  value,
  onValueChange,
}, ref) => {
  const [internal, setInternal] = React.useState('checklist');
  const active = value ?? internal;
  const setActive = onValueChange ?? setInternal;
  const meta = TAB_META[active] ?? TAB_META.checklist;
  const ActiveIcon = meta.icon;

  return (
    <div
      ref={ref}
      className="relative rounded-xl border border-border/60 bg-gradient-to-b from-muted/20 to-transparent shadow-[0_1px_0_0_hsl(var(--border)/0.6)] overflow-hidden scroll-mt-4"
    >
      {/* Accent top bar */}
      <div className={cn('h-[2px] w-full bg-gradient-to-r', meta.accent)} />

      {/* Section header — gives clear context that the tool is open/active */}
      <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/15">
            <ActiveIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-foreground tracking-tight truncate">
                {meta.label}
              </h3>
              <span className="text-[10px] font-medium uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                Ativo
              </span>
            </div>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug">
              {meta.description}
            </p>
          </div>
        </div>
      </div>

      {/* Subtle divider before tabs strip */}
      <div className="h-px bg-border/50 mx-4" />

    <Tabs value={active} onValueChange={setActive} className="w-full px-3 pt-3 pb-3">
      <TabsList className="w-full h-auto bg-muted/40 p-1 rounded-lg flex flex-wrap gap-1 justify-start">
        <TabsTrigger
          value="checklist"
          className="h-8 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
        >
          <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
          Tarefas
          {checklistTotal > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px] bg-primary/10 text-primary">
              {checklistCompleted}/{checklistTotal}
            </Badge>
          )}
        </TabsTrigger>
        
        <TabsTrigger
          value="tags"
          className="h-8 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
        >
          <Tags className="h-3.5 w-3.5 mr-1.5" />
          Tags
        </TabsTrigger>
        
        <TabsTrigger
          value="time"
          className="h-8 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
        >
          <Clock className="h-3.5 w-3.5 mr-1.5" />
          Tempo
        </TabsTrigger>
        
        <TabsTrigger
          value="attachments"
          className="h-8 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
        >
          <Paperclip className="h-3.5 w-3.5 mr-1.5" />
          Arquivos
          {attachmentsCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px] bg-primary/10 text-primary">
              {attachmentsCount}
            </Badge>
          )}
        </TabsTrigger>
        
        <TabsTrigger
          value="financial"
          className="h-8 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
        >
          <DollarSign className="h-3.5 w-3.5 mr-1.5" />
          Financeiro
        </TabsTrigger>
        
        <TabsTrigger
          value="kit"
          className="h-8 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
        >
          <Package className="h-3.5 w-3.5 mr-1.5" />
          Equipamentos
        </TabsTrigger>
        
        <TabsTrigger
          value="invites"
          className="h-8 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
        >
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          Convites
        </TabsTrigger>
        
        <TabsTrigger
          value="assistant"
          className="h-8 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          IA
        </TabsTrigger>
        
        {hasSocialPublish && (
          <TabsTrigger
            value="social"
            className="h-8 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
          >
            <Share2 className="h-3.5 w-3.5 mr-1.5" />
            Social
          </TabsTrigger>
        )}
      </TabsList>

      <div className="mt-4">
        <TabsContent value="checklist" className="m-0">
          <ChecklistPanel cardId={cardId} />
        </TabsContent>
        
        <TabsContent value="tags" className="m-0">
          <TagManagerWrapper cardId={cardId} />
        </TabsContent>
        
        <TabsContent value="time" className="m-0">
          <TimeTrackingPanel cardId={cardId} />
        </TabsContent>
        
        <TabsContent value="attachments" className="m-0">
          <AttachmentsPanel cardId={cardId} />
        </TabsContent>
        
        <TabsContent value="financial" className="m-0">
          <CardFinancialTab cardId={cardId} />
        </TabsContent>
        
        <TabsContent value="kit" className="m-0">
          <CardKitTab cardId={cardId} />
        </TabsContent>
        
        <TabsContent value="invites" className="m-0">
          <CardInvitePanel cardId={cardId} />
        </TabsContent>
        
        <TabsContent value="assistant" className="m-0">
          <CardExecutionAssistantWrapper cardId={cardId} />
        </TabsContent>
        
        {hasSocialPublish && (
          <TabsContent value="social" className="m-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Postagens Social Media</h3>
                <SocialPostButton cardId={cardId} clientId={clientId} />
              </div>
              {socialPostsCount > 0 ? (
                <div className="text-sm text-muted-foreground">
                  {socialPostsCount} postagem(ns) vinculada(s)
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <Share2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Nenhuma postagem criada</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Clique em "Gerar Postagem" para criar
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </div>
    </Tabs>
    </div>
  );
});
CardResourceTabs.displayName = 'CardResourceTabs';

