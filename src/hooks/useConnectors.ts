import { useState, useCallback, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Connector {
  id: string;
  name: string;
  type: 'google_calendar' | 'google_drive' | 'open_finance' | 'slack' | 'zapier' | 'nf_emissor';
  icon: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  lastSync?: string;
  config?: Record<string, unknown>;
  errorMessage?: string;
}

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  errors: string[];
  duration: number;
}

export interface PredictiveSyncPattern {
  connectorType: string;
  avgSyncInterval: number;
  peakUsageHours: number[];
  suggestedSchedule: string;
  confidence: number;
}

// Base connectors (static list)
const baseConnectors: Omit<Connector, 'status' | 'lastSync'>[] = [
  {
    id: 'gc-1',
    name: 'Google Calendar',
    type: 'google_calendar',
    icon: 'Calendar',
  },
  {
    id: 'gd-1',
    name: 'Google Drive',
    type: 'google_drive',
    icon: 'HardDrive',
  },
  {
    id: 'of-1',
    name: 'Open Finance',
    type: 'open_finance',
    icon: 'Landmark',
  },
  {
    id: 'sl-1',
    name: 'Slack',
    type: 'slack',
    icon: 'MessageSquare',
  },
  {
    id: 'zp-1',
    name: 'Zapier',
    type: 'zapier',
    icon: 'Zap',
  },
  {
    id: 'nf-1',
    name: 'Emissor NF',
    type: 'nf_emissor',
    icon: 'FileText',
  },
];

// Map integration_credentials.integration_type to connector type
const integrationTypeToConnectorType: Record<string, string> = {
  pluggy: 'open_finance',
  espiao_nfe: 'nf_emissor',
  sicredi: 'open_finance', // Sicredi is also banking/open finance
};

export function useConnectors() {
  const { currentWorkspace } = useWorkspace();
  const [connectors, setConnectors] = useState<Connector[]>(
    baseConnectors.map(c => ({ ...c, status: 'disconnected' as const }))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [syncPatterns, setSyncPatterns] = useState<PredictiveSyncPattern[]>([]);

  // Fetch real integration statuses from database
  const fetchIntegrationStatuses = useCallback(async () => {
    if (!currentWorkspace?.id) return;

    try {
      const { data, error } = await supabase.functions.invoke('integration-manager', {
        body: {
          action: 'status',
          workspace_id: currentWorkspace.id,
        },
      });

      if (error) {
        console.error('Error fetching integration statuses:', error);
        return;
      }

      const statuses: Record<string, { is_active: boolean; last_sync_at?: string }> = data?.integrations || {};
      
      setConnectors(prev => prev.map(connector => {
        // Find matching integration status
        const matchingIntegrationType = Object.entries(integrationTypeToConnectorType)
          .find(([, connType]) => connType === connector.type)?.[0];
        
        const integrationStatus = matchingIntegrationType ? statuses[matchingIntegrationType] : null;
        
        if (integrationStatus?.is_active) {
          return {
            ...connector,
            status: 'connected' as const,
            lastSync: integrationStatus.last_sync_at || undefined,
          };
        }
        
        return {
          ...connector,
          status: 'disconnected' as const,
          lastSync: undefined,
        };
      }));
    } catch (error) {
      console.error('Error fetching integration statuses:', error);
    }
  }, [currentWorkspace?.id]);

  // Fetch statuses on mount and when workspace changes
  useEffect(() => {
    fetchIntegrationStatuses();
  }, [fetchIntegrationStatuses]);

  // Expose refresh function for external use (e.g., after wizard completion)
  const refreshStatuses = useCallback(() => {
    fetchIntegrationStatuses();
  }, [fetchIntegrationStatuses]);

  // Connect to a service (OAuth flow simulation for non-wizard connectors)
  const connect = useCallback(async (connectorId: string) => {
    setIsLoading(true);
    try {
      // In production, this would initiate OAuth flow
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setConnectors(prev => prev.map(c => 
        c.id === connectorId 
          ? { ...c, status: 'connected', lastSync: new Date().toISOString() }
          : c
      ));
      
      toast.success('Conectado com sucesso!');
      return true;
    } catch (error) {
      toast.error('Erro ao conectar');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Disconnect from a service
  const disconnect = useCallback(async (connectorId: string) => {
    if (!currentWorkspace?.id) return false;
    
    const connector = connectors.find(c => c.id === connectorId);
    if (!connector) return false;

    setIsLoading(true);
    try {
      // For wizard-managed connectors, call delete on the edge function
      const matchingIntegrationType = Object.entries(integrationTypeToConnectorType)
        .find(([, connType]) => connType === connector.type)?.[0];
      
      if (matchingIntegrationType) {
        const { error } = await supabase.functions.invoke('integration-manager', {
          body: {
            action: 'delete',
            workspace_id: currentWorkspace.id,
            integration_type: matchingIntegrationType,
          },
        });
        
        if (error) throw error;
      }
      
      setConnectors(prev => prev.map(c => 
        c.id === connectorId 
          ? { ...c, status: 'disconnected', lastSync: undefined }
          : c
      ));
      
      toast.success('Desconectado');
      return true;
    } catch (error) {
      toast.error('Erro ao desconectar');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [connectors, currentWorkspace?.id]);

  // Manual sync trigger
  const syncNow = useCallback(async (connectorId: string): Promise<SyncResult> => {
    const connector = connectors.find(c => c.id === connectorId);
    if (!connector || connector.status !== 'connected') {
      return { success: false, itemsSynced: 0, errors: ['Connector not connected'], duration: 0 };
    }

    setConnectors(prev => prev.map(c => 
      c.id === connectorId ? { ...c, status: 'syncing' } : c
    ));

    const startTime = Date.now();
    
    try {
      // Simulate sync operation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const itemsSynced = Math.floor(Math.random() * 50) + 10;
      
      setConnectors(prev => prev.map(c => 
        c.id === connectorId 
          ? { ...c, status: 'connected', lastSync: new Date().toISOString() }
          : c
      ));

      toast.success(`Sincronizado: ${itemsSynced} itens`);
      
      return {
        success: true,
        itemsSynced,
        errors: [],
        duration: Date.now() - startTime,
      };
    } catch (error) {
      setConnectors(prev => prev.map(c => 
        c.id === connectorId 
          ? { ...c, status: 'error', errorMessage: 'Sync failed' }
          : c
      ));
      
      return {
        success: false,
        itemsSynced: 0,
        errors: ['Sync failed'],
        duration: Date.now() - startTime,
      };
    }
  }, [connectors]);

  // Predictive sync analysis
  const analyzeSyncPatterns = useCallback(async (): Promise<PredictiveSyncPattern[]> => {
    const patterns: PredictiveSyncPattern[] = [
      {
        connectorType: 'google_calendar',
        avgSyncInterval: 15,
        peakUsageHours: [9, 10, 14, 15],
        suggestedSchedule: 'Sync every 15 minutes during business hours',
        confidence: 0.85,
      },
      {
        connectorType: 'google_drive',
        avgSyncInterval: 60,
        peakUsageHours: [10, 11, 16],
        suggestedSchedule: 'Sync hourly with real-time on file changes',
        confidence: 0.78,
      },
      {
        connectorType: 'open_finance',
        avgSyncInterval: 1440,
        peakUsageHours: [8, 17],
        suggestedSchedule: 'Daily sync at 8am for fresh financial data',
        confidence: 0.92,
      },
    ];
    
    setSyncPatterns(patterns);
    return patterns;
  }, []);

  // Google Calendar specific: Import events to Flowalt Agenda
  const importCalendarEvents = useCallback(async (startDate: Date, endDate: Date) => {
    if (!currentWorkspace?.id) return [];
    
    const mockEvents: Array<{
      title: string;
      start_time: string;
      end_time: string;
      description: string;
      event_type: 'meeting' | 'deadline' | 'milestone' | 'other' | 'recording';
    }> = [
      {
        title: 'Reunião de Alinhamento',
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 86400000 + 3600000).toISOString(),
        description: 'Importado do Google Calendar',
        event_type: 'meeting',
      },
      {
        title: 'Deadline Projeto X',
        start_time: new Date(Date.now() + 172800000).toISOString(),
        end_time: new Date(Date.now() + 172800000 + 3600000).toISOString(),
        description: 'Importado do Google Calendar',
        event_type: 'deadline',
      },
    ];

    const { data, error } = await supabase
      .from('events')
      .insert(mockEvents.map(e => ({
        ...e,
        workspace_id: currentWorkspace.id,
      })))
      .select();

    if (error) {
      toast.error('Erro ao importar eventos');
      return [];
    }

    toast.success(`${data?.length || 0} eventos importados`);
    return data || [];
  }, [currentWorkspace]);

  // Google Drive specific: Link attachments to cards
  const importDriveFiles = useCallback(async (cardId: string, fileIds: string[]) => {
    const mockFiles = fileIds.map((id, idx) => ({
      card_id: cardId,
      file_name: `documento_${idx + 1}.pdf`,
      file_url: `https://drive.google.com/file/d/${id}`,
      file_type: 'application/pdf',
      file_size: Math.floor(Math.random() * 1000000),
    }));

    toast.success(`${mockFiles.length} arquivos vinculados`);
    return mockFiles;
  }, []);

  // Open Finance specific: Import bank transactions
  const importBankTransactions = useCallback(async (accountId: string, startDate: Date, endDate: Date) => {
    if (!currentWorkspace?.id) return [];
    
    const mockTransactions = [
      {
        description: 'Pagamento Cliente ABC',
        amount: 5000,
        type: 'income' as const,
        due_date: new Date().toISOString().split('T')[0],
        status: 'paid' as const,
      },
      {
        description: 'Fornecedor XYZ',
        amount: 1500,
        type: 'expense' as const,
        due_date: new Date().toISOString().split('T')[0],
        status: 'paid' as const,
      },
    ];

    const { data, error } = await supabase
      .from('transactions')
      .insert(mockTransactions.map(t => ({
        ...t,
        workspace_id: currentWorkspace.id,
      })))
      .select();

    if (error) {
      toast.error('Erro ao importar transações');
      return [];
    }

    toast.success(`${data?.length || 0} transações importadas`);
    return data || [];
  }, [currentWorkspace]);

  // NF Emissor specific: Fetch and match invoices
  const fetchInvoices = useCallback(async (cnpj: string) => {
    const mockInvoices = [
      {
        number: 'NF-001234',
        value: 5000,
        issueDate: new Date().toISOString(),
        status: 'emitida',
        matchedTransactionId: null,
      },
      {
        number: 'NF-001235',
        value: 3500,
        issueDate: new Date().toISOString(),
        status: 'emitida',
        matchedTransactionId: null,
      },
    ];

    toast.info(`${mockInvoices.length} notas fiscais encontradas`);
    return mockInvoices;
  }, []);

  // Suggest transaction matches for reconciliation
  const suggestMatches = useCallback(async () => {
    if (!currentWorkspace?.id) return [];
    
    const suggestions = [
      {
        transactionId: 'tx-1',
        invoiceNumber: 'NF-001234',
        confidence: 0.95,
        reason: 'Same value and similar date',
      },
      {
        transactionId: 'tx-2',
        invoiceNumber: 'NF-001235',
        confidence: 0.87,
        reason: 'Client name match',
      },
    ];

    return suggestions;
  }, [currentWorkspace]);

  return {
    connectors,
    isLoading,
    syncPatterns,
    connect,
    disconnect,
    syncNow,
    analyzeSyncPatterns,
    importCalendarEvents,
    importDriveFiles,
    importBankTransactions,
    fetchInvoices,
    suggestMatches,
    refreshStatuses,
  };
}
