import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Search, 
  Filter, 
  Calendar as CalendarIcon,
  Code,
  Copy,
  Check,
  Zap,
  RefreshCw,
  ChevronRight,
  Activity
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface EventRecord {
  id: string;
  subscription_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  created_at: string;
  delivered_at: string | null;
  subscription?: {
    name: string;
    url: string;
  };
}

const EVENT_TYPES = [
  'card.created',
  'card.updated',
  'card.status_changed',
  'card.deleted',
  'comment.created',
  'time_entry.logged',
  'event.created',
  'checklist.item.completed',
  'attachment.uploaded',
  'attachment.deleted',
  'sprint.created',
  'sprint.updated',
  'sprint.completed',
];

export function EventExplorer() {
  const { currentWorkspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('__all__');
  const [statusFilter, setStatusFilter] = useState<string>('__all__');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['event-explorer', currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      // Get all subscriptions for the workspace (using safe view)
      const { data: subscriptions } = await supabase
        .from('webhook_subscriptions_safe')
        .select('id, name, url')
        .eq('workspace_id', currentWorkspace.id);

      if (!subscriptions?.length) return [];

      const subscriptionIds = subscriptions.map(s => s.id);
      const subscriptionMap = new Map(subscriptions.map(s => [s.id, s]));

      let query = supabase
        .from('webhook_deliveries')
        .select('*')
        .in('subscription_id', subscriptionIds)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (dateRange.from) {
        query = query.gte('created_at', startOfDay(dateRange.from).toISOString());
      }
      if (dateRange.to) {
        query = query.lte('created_at', endOfDay(dateRange.to).toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(d => ({
        ...d,
        subscription: subscriptionMap.get(d.subscription_id),
      })) as EventRecord[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const filteredEvents = useMemo(() => {
    if (!events) return [];

    return events.filter(event => {
      // Event type filter
      if (eventTypeFilter !== '__all__' && event.event_type !== eventTypeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'success' && (event.response_status === null || event.response_status >= 400)) {
        return false;
      }
      if (statusFilter === 'failed' && event.response_status !== null && event.response_status < 400) {
        return false;
      }
      if (statusFilter === 'pending' && event.response_status !== null) {
        return false;
      }

      // Search query
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const payloadStr = JSON.stringify(event.payload).toLowerCase();
        return (
          event.event_type.toLowerCase().includes(searchLower) ||
          event.id.toLowerCase().includes(searchLower) ||
          payloadStr.includes(searchLower)
        );
      }

      return true;
    });
  }, [events, eventTypeFilter, statusFilter, searchQuery]);

  const eventTypeCounts = useMemo(() => {
    if (!events) return new Map<string, number>();
    const counts = new Map<string, number>();
    events.forEach(e => {
      counts.set(e.event_type, (counts.get(e.event_type) || 0) + 1);
    });
    return counts;
  }, [events]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Copiado!', description: 'Payload copiado para a área de transferência' });
  };

  const getStatusBadge = (status: number | null) => {
    if (status === null) {
      return <Badge variant="secondary">Pendente</Badge>;
    }
    if (status >= 200 && status < 300) {
      return <Badge className="bg-green-500/20 text-green-600">Sucesso</Badge>;
    }
    return <Badge variant="destructive">{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-20 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Event Explorer</CardTitle>
                <CardDescription>
                  Pesquise e analise eventos históricos do sistema
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por ID, tipo ou payload..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <Zap className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo de evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os tipos</SelectItem>
                {EVENT_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {type} ({eventTypeCounts.get(type) || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="failed">Falha</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {dateRange.from && dateRange.to ? (
                    `${format(dateRange.from, 'dd/MM')} - ${format(dateRange.to, 'dd/MM')}`
                  ) : (
                    'Período'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{filteredEvents.length} eventos encontrados</span>
            {events && (
              <span>•</span>
            )}
            <span>{eventTypeCounts.size} tipos diferentes</span>
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardContent className="p-0">
          {filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum evento encontrado</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="divide-y">
                {filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant="outline" className="font-mono text-xs">
                          {event.event_type}
                        </Badge>
                        {getStatusBadge(event.response_status)}
                        <span className="text-sm text-muted-foreground truncate">
                          {event.subscription?.name || 'Webhook'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <p className="mt-2 text-xs font-mono text-muted-foreground truncate">
                      ID: {event.id}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Detalhes do Evento
            </DialogTitle>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <Badge variant="outline" className="ml-2">{selectedEvent.event_type}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <span className="ml-2">{getStatusBadge(selectedEvent.response_status)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Criado em:</span>
                  <span className="ml-2">
                    {format(new Date(selectedEvent.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Entregue em:</span>
                  <span className="ml-2">
                    {selectedEvent.delivered_at 
                      ? format(new Date(selectedEvent.delivered_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                      : '-'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Payload</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(selectedEvent.payload, null, 2), selectedEvent.id)}
                  >
                    {copiedId === selectedEvent.id ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto max-h-[300px]">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>

              {selectedEvent.subscription && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <span className="text-muted-foreground">Destino:</span>
                  <span className="ml-2 font-mono text-xs">{selectedEvent.subscription.url}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
