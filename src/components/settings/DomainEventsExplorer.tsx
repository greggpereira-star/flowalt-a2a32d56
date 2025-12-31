import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  Box,
  CreditCard,
  RefreshCw,
  Search,
  Wrench,
  Eye,
  CheckCircle2,
  Clock,
  TrendingDown,
} from "lucide-react";
import { useDomainEvents, useEventStats, type AggregateType, type DomainEvent } from "@/hooks/useDomainEvents";

const aggregateIcons: Record<string, React.ReactNode> = {
  InventoryItem: <Box className="h-4 w-4" />,
  InventoryMovement: <RefreshCw className="h-4 w-4" />,
  MaintenanceRecord: <Wrench className="h-4 w-4" />,
  Transaction: <CreditCard className="h-4 w-4" />,
  DepreciationSchedule: <TrendingDown className="h-4 w-4" />,
};

const eventTypeColors: Record<string, string> = {
  Created: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Updated: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Deleted: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  Cancelled: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  Resolved: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  Changed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

function getEventColor(eventType: string): string {
  for (const [key, color] of Object.entries(eventTypeColors)) {
    if (eventType.includes(key)) return color;
  }
  return "bg-muted text-muted-foreground";
}

function EventDetailDialog({ event }: { event: DomainEvent }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {aggregateIcons[event.aggregate_type]}
            {event.event_type}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Aggregate ID</p>
              <p className="font-mono text-xs">{event.aggregate_id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Version</p>
              <p>{event.version}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Correlation ID</p>
              <p className="font-mono text-xs">{event.correlation_id || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <Badge variant={event.is_processed ? "default" : "secondary"}>
                {event.is_processed ? "Processado" : "Pendente"}
              </Badge>
            </div>
          </div>
          
          <div>
            <p className="text-muted-foreground mb-2">Payload</p>
            <ScrollArea className="h-[200px] rounded-md border p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </ScrollArea>
          </div>

          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div>
              <p className="text-muted-foreground mb-2">Metadata</p>
              <ScrollArea className="h-[100px] rounded-md border p-4">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DomainEventsExplorer() {
  const [aggregateFilter, setAggregateFilter] = useState<AggregateType | 'all'>('all');
  const [search, setSearch] = useState("");
  
  const { data: events = [], isLoading, refetch } = useDomainEvents({
    aggregateType: aggregateFilter === 'all' ? undefined : aggregateFilter,
    limit: 100,
  });
  
  const { data: stats } = useEventStats();

  const filteredEvents = events.filter(event => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      event.event_type.toLowerCase().includes(searchLower) ||
      event.aggregate_id.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Total de Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Processados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats?.processed || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{stats?.unprocessed || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tipos de Evento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{Object.keys(stats?.byType || {}).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Eventos de Domínio (EDA)</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por tipo ou ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={aggregateFilter}
              onValueChange={(v) => setAggregateFilter(v as AggregateType | 'all')}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por agregado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="InventoryItem">Itens de Inventário</SelectItem>
                <SelectItem value="InventoryMovement">Movimentações</SelectItem>
                <SelectItem value="MaintenanceRecord">Manutenções</SelectItem>
                <SelectItem value="Transaction">Transações</SelectItem>
                <SelectItem value="DepreciationSchedule">Depreciação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando eventos...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum evento encontrado
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Tipo</TableHead>
                    <TableHead>Agregado</TableHead>
                    <TableHead className="w-[80px]">Versão</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead className="w-[150px]">Data</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Badge className={getEventColor(event.event_type)} variant="secondary">
                          {event.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {aggregateIcons[event.aggregate_type] || <Activity className="h-4 w-4" />}
                          <span className="text-sm">{event.aggregate_type}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {event.aggregate_id.slice(0, 8)}...
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">v{event.version}</Badge>
                      </TableCell>
                      <TableCell>
                        {event.is_processed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-orange-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(event.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <EventDetailDialog event={event} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
