import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  ArrowLeftRight,
  Settings2,
  Package,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useItemMovementTimeline } from "@/hooks/useStockOperations";

interface Props {
  itemId: string;
  itemName?: string;
}

const movementConfig = {
  IN: { icon: ArrowDownLeft, label: 'Entrada', color: 'text-green-600', bg: 'bg-green-100' },
  OUT: { icon: ArrowUpRight, label: 'Saída', color: 'text-red-600', bg: 'bg-red-100' },
  RETURN: { icon: RefreshCw, label: 'Devolução', color: 'text-blue-600', bg: 'bg-blue-100' },
  TRANSFER: { icon: ArrowLeftRight, label: 'Transferência', color: 'text-purple-600', bg: 'bg-purple-100' },
  ADJUST: { icon: Settings2, label: 'Ajuste', color: 'text-gray-600', bg: 'bg-gray-100' },
};

export function ItemMovementTimeline({ itemId, itemName }: Props) {
  const { data: timeline = [], isLoading } = useItemMovementTimeline(itemId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Timeline de Movimentações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (timeline.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Timeline de Movimentações
            {itemName && <span className="text-muted-foreground font-normal">- {itemName}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhuma movimentação registrada para este item
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          Timeline de Movimentações
          {itemName && <span className="text-muted-foreground font-normal">- {itemName}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
            
            <div className="space-y-6">
              {timeline.map((entry, index) => {
                const config = movementConfig[entry.movement_type as keyof typeof movementConfig] || movementConfig.ADJUST;
                const Icon = config.icon;
                
                return (
                  <div key={entry.id} className="relative flex gap-4">
                    {/* Icon circle */}
                    <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full ${config.bg}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={config.color}>
                            {config.label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(entry.occurred_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        
                        {/* Stock delta */}
                        <div className="flex items-center gap-1">
                          {entry.stock_delta > 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : entry.stock_delta < 0 ? (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          ) : null}
                          <span className={`font-mono text-sm ${
                            entry.stock_delta > 0 ? 'text-green-600' : 
                            entry.stock_delta < 0 ? 'text-red-600' : ''
                          }`}>
                            {entry.stock_delta > 0 ? '+' : ''}{entry.stock_delta}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-1 space-y-1">
                        {entry.serial_number && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">S/N:</span>{' '}
                            <span className="font-mono">{entry.serial_number}</span>
                          </p>
                        )}
                        
                        {entry.card_title && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Card:</span>{' '}
                            {entry.card_title}
                          </p>
                        )}
                        
                        {entry.department_name && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Depto:</span>{' '}
                            {entry.department_name}
                          </p>
                        )}
                        
                        {entry.notes && (
                          <p className="text-sm text-muted-foreground">
                            {entry.notes}
                          </p>
                        )}
                        
                        {/* Running balance */}
                        <p className="text-xs text-muted-foreground mt-2">
                          Saldo após: <span className="font-mono">{entry.running_balance}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
