import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useClientCard } from '@/hooks/useClientCards';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, Palette, MessageSquare, FileText } from 'lucide-react';

interface ClientCardSheetProps {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ClientCardSheet: React.FC<ClientCardSheetProps> = ({
  clientId,
  open,
  onOpenChange,
}) => {
  const { data: client, isLoading } = useClientCard(clientId || undefined);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : client ? (
          <>
            <SheetHeader className="pb-4 border-b">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: client.color || '#6366f1' }}
                >
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <SheetTitle className="text-xl">{client.name}</SheetTitle>
                  {client.segment && (
                    <p className="text-sm text-muted-foreground">{client.segment}</p>
                  )}
                </div>
                <Badge className="ml-auto">{client.status === 'active' ? 'Ativo' : client.status === 'paused' ? 'Pausado' : 'Encerrado'}</Badge>
              </div>
            </SheetHeader>

            <Tabs defaultValue="identity" className="mt-6">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="identity" className="gap-1.5">
                  <Building2 className="h-4 w-4" />
                  Identidade
                </TabsTrigger>
                <TabsTrigger value="onboarding" className="gap-1.5">
                  <Users className="h-4 w-4" />
                  Onboarding
                </TabsTrigger>
                <TabsTrigger value="branding" className="gap-1.5">
                  <Palette className="h-4 w-4" />
                  Branding
                </TabsTrigger>
                <TabsTrigger value="voice" className="gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  Voz
                </TabsTrigger>
                <TabsTrigger value="contract" className="gap-1.5">
                  <FileText className="h-4 w-4" />
                  Contrato
                </TabsTrigger>
              </TabsList>

              <TabsContent value="identity" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Segmento</p>
                    <p className="font-medium">{client.segment || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Início</p>
                    <p className="font-medium">{client.start_date || '-'}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="onboarding" className="mt-4 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Sobre o cliente</p>
                  <p className="text-sm">{client.about_client || 'Não preenchido'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Objetivos</p>
                  <p className="text-sm">{client.objectives || 'Não preenchido'}</p>
                </div>
              </TabsContent>

              <TabsContent value="branding" className="mt-4 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Posicionamento</p>
                  <p className="text-sm">{client.positioning || 'Não preenchido'}</p>
                </div>
              </TabsContent>

              <TabsContent value="voice" className="mt-4 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Estilo de linguagem</p>
                  <p className="text-sm">{client.language_style || 'Não preenchido'}</p>
                </div>
              </TabsContent>

              <TabsContent value="contract" className="mt-4 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Tipo de contrato</p>
                  <p className="text-sm">{client.contract_type || 'Não preenchido'}</p>
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Cliente não encontrado</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
