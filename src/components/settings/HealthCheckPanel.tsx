import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Database,
  Globe,
  Server,
  Zap,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'checking';
  latency?: number;
  lastCheck?: string;
  details?: string;
}

export function HealthCheckPanel() {
  const [services, setServices] = useState<ServiceHealth[]>([
    { name: 'Database', status: 'checking' },
    { name: 'Edge Functions', status: 'checking' },
    { name: 'Storage', status: 'checking' },
    { name: 'Auth', status: 'checking' },
  ]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastFullCheck, setLastFullCheck] = useState<string | null>(null);

  const checkDatabase = async (): Promise<ServiceHealth> => {
    const start = Date.now();
    try {
      const { error } = await supabase.from('workspaces').select('id').limit(1);
      const latency = Date.now() - start;
      
      if (error) {
        return { 
          name: 'Database', 
          status: 'unhealthy', 
          latency,
          lastCheck: new Date().toISOString(),
          details: error.message 
        };
      }
      
      return { 
        name: 'Database', 
        status: latency > 1000 ? 'degraded' : 'healthy', 
        latency,
        lastCheck: new Date().toISOString(),
        details: latency > 1000 ? 'High latency detected' : 'Operational'
      };
    } catch (e) {
      return { 
        name: 'Database', 
        status: 'unhealthy', 
        latency: Date.now() - start,
        lastCheck: new Date().toISOString(),
        details: e instanceof Error ? e.message : 'Connection failed' 
      };
    }
  };

  const checkEdgeFunctions = async (): Promise<ServiceHealth> => {
    const start = Date.now();
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api/status`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const latency = Date.now() - start;
      
      if (!response.ok) {
        return { 
          name: 'Edge Functions', 
          status: 'degraded', 
          latency,
          lastCheck: new Date().toISOString(),
          details: `Status: ${response.status}` 
        };
      }
      
      const data = await response.json();
      return { 
        name: 'Edge Functions', 
        status: data.status === 'healthy' ? 'healthy' : 'degraded', 
        latency,
        lastCheck: new Date().toISOString(),
        details: `API v${data.version || '1.0.0'}`
      };
    } catch (e) {
      return { 
        name: 'Edge Functions', 
        status: 'unhealthy', 
        latency: Date.now() - start,
        lastCheck: new Date().toISOString(),
        details: e instanceof Error ? e.message : 'Connection failed' 
      };
    }
  };

  const checkStorage = async (): Promise<ServiceHealth> => {
    const start = Date.now();
    try {
      const { data, error } = await supabase.storage.listBuckets();
      const latency = Date.now() - start;
      
      if (error) {
        return { 
          name: 'Storage', 
          status: 'degraded', 
          latency,
          lastCheck: new Date().toISOString(),
          details: error.message 
        };
      }
      
      return { 
        name: 'Storage', 
        status: 'healthy', 
        latency,
        lastCheck: new Date().toISOString(),
        details: `${data?.length || 0} buckets available`
      };
    } catch (e) {
      return { 
        name: 'Storage', 
        status: 'unhealthy', 
        latency: Date.now() - start,
        lastCheck: new Date().toISOString(),
        details: e instanceof Error ? e.message : 'Connection failed' 
      };
    }
  };

  const checkAuth = async (): Promise<ServiceHealth> => {
    const start = Date.now();
    try {
      const { data, error } = await supabase.auth.getSession();
      const latency = Date.now() - start;
      
      if (error) {
        return { 
          name: 'Auth', 
          status: 'degraded', 
          latency,
          lastCheck: new Date().toISOString(),
          details: error.message 
        };
      }
      
      return { 
        name: 'Auth', 
        status: 'healthy', 
        latency,
        lastCheck: new Date().toISOString(),
        details: data.session ? 'Session active' : 'No active session'
      };
    } catch (e) {
      return { 
        name: 'Auth', 
        status: 'unhealthy', 
        latency: Date.now() - start,
        lastCheck: new Date().toISOString(),
        details: e instanceof Error ? e.message : 'Connection failed' 
      };
    }
  };

  const runHealthCheck = async () => {
    setIsChecking(true);
    
    try {
      const [db, edge, storage, auth] = await Promise.all([
        checkDatabase(),
        checkEdgeFunctions(),
        checkStorage(),
        checkAuth()
      ]);
      
      setServices([db, edge, storage, auth]);
      setLastFullCheck(new Date().toISOString());
      
      const unhealthyCount = [db, edge, storage, auth].filter(s => s.status === 'unhealthy').length;
      const degradedCount = [db, edge, storage, auth].filter(s => s.status === 'degraded').length;
      
      if (unhealthyCount > 0) {
        toast.error(`${unhealthyCount} serviço(s) com problemas`);
      } else if (degradedCount > 0) {
        toast.warning(`${degradedCount} serviço(s) degradado(s)`);
      } else {
        toast.success('Todos os serviços operacionais');
      }
    } catch (e) {
      toast.error('Erro ao verificar serviços');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
    
    // Auto-check every 5 minutes
    const interval = setInterval(runHealthCheck, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: ServiceHealth['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-muted-foreground animate-pulse" />;
    }
  };

  const getStatusBadge = (status: ServiceHealth['status']) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Operacional</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Degradado</Badge>;
      case 'unhealthy':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/30">Indisponível</Badge>;
      default:
        return <Badge variant="outline">Verificando...</Badge>;
    }
  };

  const getServiceIcon = (name: string) => {
    switch (name) {
      case 'Database':
        return <Database className="h-5 w-5" />;
      case 'Edge Functions':
        return <Zap className="h-5 w-5" />;
      case 'Storage':
        return <Server className="h-5 w-5" />;
      case 'Auth':
        return <Globe className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const overallStatus = services.some(s => s.status === 'unhealthy') 
    ? 'unhealthy' 
    : services.some(s => s.status === 'degraded') 
      ? 'degraded' 
      : services.every(s => s.status === 'healthy')
        ? 'healthy'
        : 'checking';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Health Check
            </CardTitle>
            <CardDescription>
              Status dos serviços da plataforma
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(overallStatus)}
            <Button 
              variant="outline" 
              size="sm"
              onClick={runHealthCheck}
              disabled={isChecking}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
              Verificar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  {getServiceIcon(service.name)}
                </div>
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {service.details || 'Verificando...'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {service.latency !== undefined && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {service.latency}ms
                  </div>
                )}
                {getStatusIcon(service.status)}
              </div>
            </div>
          ))}
        </div>

        {lastFullCheck && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Última verificação: {new Date(lastFullCheck).toLocaleString('pt-BR')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
