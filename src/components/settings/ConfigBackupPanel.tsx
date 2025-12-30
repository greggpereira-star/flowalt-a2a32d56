import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Upload, 
  Archive, 
  Clock,
  CheckCircle,
  AlertTriangle,
  FileJson
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

interface BackupItem {
  name: string;
  table: string;
  description: string;
}

const BACKUP_ITEMS: BackupItem[] = [
  { name: 'Automações', table: 'card_automations', description: 'Regras de automação de cards' },
  { name: 'Templates', table: 'process_templates', description: 'Templates de processos' },
  { name: 'Webhooks', table: 'webhook_subscriptions', description: 'Configurações de webhooks' },
  { name: 'Feature Flags', table: 'feature_flags', description: 'Flags de funcionalidades' },
  { name: 'Categorias Financeiras', table: 'financial_categories', description: 'Categorias de transações' },
];

export function ConfigBackupPanel() {
  const { currentWorkspace } = useWorkspace();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const exportConfiguration = async () => {
    if (!currentWorkspace?.id) {
      toast.error('Workspace não encontrado');
      return;
    }

    setIsExporting(true);

    try {
      const backupData: Record<string, any> = {
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        workspace_id: currentWorkspace.id,
        data: {}
      };

      for (const item of BACKUP_ITEMS) {
        // Use type assertion to handle dynamic table names
        const { data, error } = await (supabase
          .from(item.table as any)
          .select('*')
          .eq('workspace_id', currentWorkspace.id) as any);

        if (error) {
          console.error(`Error exporting ${item.table}:`, error);
          backupData.data[item.table] = { error: error.message };
        } else {
          backupData.data[item.table] = data || [];
        }
      }

      // Create download
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `config-backup-${currentWorkspace.id.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastBackup(new Date().toISOString());
      toast.success('Configurações exportadas com sucesso');
    } catch (e) {
      toast.error('Erro ao exportar configurações');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentWorkspace?.id) return;

    setIsImporting(true);

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      if (!backupData.version || !backupData.data) {
        toast.error('Arquivo de backup inválido');
        return;
      }

      let importedCount = 0;
      let errorCount = 0;

      for (const item of BACKUP_ITEMS) {
        const tableData = backupData.data[item.table];
        if (!tableData || tableData.error || !Array.isArray(tableData) || tableData.length === 0) {
          continue;
        }

        // Prepare data for import (update workspace_id)
        const preparedData = tableData.map((row: any) => ({
          ...row,
          id: undefined, // Let DB generate new IDs
          workspace_id: currentWorkspace.id,
          created_at: undefined,
          updated_at: undefined
        }));

        const { error } = await (supabase
          .from(item.table as any)
          .upsert(preparedData, { onConflict: 'id' }) as any);

        if (error) {
          console.error(`Error importing ${item.table}:`, error);
          errorCount++;
        } else {
          importedCount++;
        }
      }

      if (errorCount > 0) {
        toast.warning(`Importado com ${errorCount} erro(s)`);
      } else {
        toast.success(`${importedCount} configurações importadas`);
      }
    } catch (e) {
      toast.error('Erro ao importar arquivo');
    } finally {
      setIsImporting(false);
      // Reset input
      event.target.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          Backup de Configurações
        </CardTitle>
        <CardDescription>
          Exporte e importe configurações do workspace
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export Section */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium">Exportar Configurações</h3>
              <p className="text-sm text-muted-foreground">
                Faça download de todas as configurações
              </p>
            </div>
            <Button onClick={exportConfiguration} disabled={isExporting}>
              <Download className={`h-4 w-4 mr-2 ${isExporting ? 'animate-pulse' : ''}`} />
              {isExporting ? 'Exportando...' : 'Exportar'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {BACKUP_ITEMS.map((item) => (
              <Badge key={item.table} variant="outline" className="text-xs">
                {item.name}
              </Badge>
            ))}
          </div>

          {lastBackup && (
            <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3 text-green-500" />
              Último backup: {new Date(lastBackup).toLocaleString('pt-BR')}
            </div>
          )}
        </div>

        {/* Import Section */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium">Importar Configurações</h3>
              <p className="text-sm text-muted-foreground">
                Restaure configurações de um backup
              </p>
            </div>
            <div>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
                id="backup-import"
                disabled={isImporting}
              />
              <label htmlFor="backup-import">
                <Button asChild variant="outline" disabled={isImporting}>
                  <span>
                    <Upload className={`h-4 w-4 mr-2 ${isImporting ? 'animate-pulse' : ''}`} />
                    {isImporting ? 'Importando...' : 'Importar'}
                  </span>
                </Button>
              </label>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-600">
              A importação pode sobrescrever configurações existentes. Faça um backup antes de importar.
            </p>
          </div>
        </div>

        {/* Backup Items List */}
        <div>
          <h3 className="text-sm font-medium mb-3">Itens incluídos no backup</h3>
          <div className="space-y-2">
            {BACKUP_ITEMS.map((item) => (
              <div
                key={item.table}
                className="flex items-center gap-3 p-3 rounded-lg border"
              >
                <FileJson className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
