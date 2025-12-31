import React, { useEffect, useState } from 'react';
import { useDefaultWorkflow, useCreateDefaultWorkflow } from '@/hooks/useWorkflow';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Loader2 } from 'lucide-react';

interface WorkflowInitializerProps {
  children: React.ReactNode;
}

/**
 * Componente que garante que um workflow padrão existe para o workspace.
 * Se não existir, cria automaticamente.
 */
export const WorkflowInitializer: React.FC<WorkflowInitializerProps> = ({ children }) => {
  const { currentWorkspace } = useWorkspace();
  const { data: defaultWorkflow, isLoading: isLoadingWorkflow, refetch } = useDefaultWorkflow();
  const createDefaultWorkflow = useCreateDefaultWorkflow();
  const [isInitializing, setIsInitializing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initializeWorkflow = async () => {
      // Só inicializa se:
      // 1. Tem workspace
      // 2. Não está carregando
      // 3. Não existe workflow padrão
      // 4. Não está já inicializando
      // 5. Não foi inicializado nesta sessão
      if (
        currentWorkspace?.id && 
        !isLoadingWorkflow && 
        !defaultWorkflow && 
        !isInitializing &&
        !initialized
      ) {
        setIsInitializing(true);
        try {
          await createDefaultWorkflow.mutateAsync();
          await refetch();
          setInitialized(true);
          console.log('Workflow padrão criado com sucesso');
        } catch (error) {
          console.error('Erro ao criar workflow padrão:', error);
          // Marca como inicializado para evitar loop infinito
          setInitialized(true);
        } finally {
          setIsInitializing(false);
        }
      } else if (defaultWorkflow) {
        setInitialized(true);
      }
    };

    initializeWorkflow();
  }, [currentWorkspace?.id, isLoadingWorkflow, defaultWorkflow, isInitializing, initialized]);

  // Reset quando trocar de workspace
  useEffect(() => {
    setInitialized(false);
  }, [currentWorkspace?.id]);

  // Mostrar loading apenas na primeira vez
  if (isInitializing && !initialized) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Configurando workflow...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default WorkflowInitializer;
