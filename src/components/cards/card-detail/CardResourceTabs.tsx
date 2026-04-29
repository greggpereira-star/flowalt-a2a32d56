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
  return (
    <div ref={ref}>
    <Tabs value={active} onValueChange={setActive} className="w-full">
      <TabsList className="w-full h-auto bg-muted/30 p-1 rounded-lg flex flex-wrap gap-1 justify-start">
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
  );
};
