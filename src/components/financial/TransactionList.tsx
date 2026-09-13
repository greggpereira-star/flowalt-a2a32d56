import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  Clock,
  AlertCircle,
  Filter,
  Loader2,
  FolderTree,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileDown,
  User,
  X,
  ArrowUpDown,
  FileSpreadsheet,
  ChevronLeftCircle,
  ChevronRightCircle,
} from "lucide-react";
// @ts-ignore
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTransactions, useUpdateTransaction, useDeleteTransaction, useCategories } from "@/hooks/useFinancial";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TransactionListProps {
  onEdit?: (transaction: any) => void;
  filters?: {
    type?: "income" | "expense" | "transfer";
    status?: "pending" | "paid" | "cancelled" | "overdue";
  };
}

export function TransactionList({ onEdit, filters: initialFilters }: TransactionListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  
  const [filters, setFilters] = useState(() => {
    const monthParam = searchParams.get("month");
    let initialMonth: Date | null = null;
    if (monthParam) {
      const parsedDate = parseISO(monthParam);
      if (isValid(parsedDate)) {
        initialMonth = parsedDate;
      }
    }

    return {
      type: searchParams.get("type") || initialFilters?.type || "all",
      status: searchParams.get("status") || initialFilters?.status || "all",
      category: searchParams.get("category") || "all",
      costCenter: searchParams.get("costCenter") || "all",
      collaborator: searchParams.get("collaborator") || "all",
      month: initialMonth,
    };
  });

  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.type !== "all") params.type = filters.type;
    if (filters.status !== "all") params.status = filters.status;
    if (filters.category !== "all") params.category = filters.category;
    if (filters.costCenter !== "all") params.costCenter = filters.costCenter;
    if (filters.collaborator !== "all") params.collaborator = filters.collaborator;
    if (filters.month) params.month = filters.month.toISOString().split('T')[0];
    
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);
  
  const [assigningCostCenter, setAssigningCostCenter] = useState<string | null>(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const tabsListRef = useRef<HTMLDivElement>(null);


  
  const { data: allTransactions = [], isLoading } = useTransactions({
    startDate: filters.month ? startOfMonth(filters.month).toISOString().split("T")[0] : undefined,
    endDate: filters.month ? endOfMonth(filters.month).toISOString().split("T")[0] : undefined,
  });

  const { data: filteredTransactionsFromApi = [] } = useTransactions({
    type: filters.type === "all" ? undefined : filters.type as any,
    status: filters.status === "all" ? undefined : filters.status as any,
    categoryId: filters.category === "all" ? undefined : filters.category,
    costCenterId: filters.costCenter === "all" || filters.costCenter === "unassigned" ? undefined : filters.costCenter,
    collaboratorId: filters.collaborator === "all" || filters.collaborator === "unassigned" ? undefined : filters.collaborator,
    startDate: filters.month ? startOfMonth(filters.month).toISOString().split("T")[0] : undefined,
    endDate: filters.month ? endOfMonth(filters.month).toISOString().split("T")[0] : undefined,
  });
  const { data: categories = [] } = useCategories();
  const { data: costCenters = [] } = useCostCenters();
  const { data: members = [] } = useWorkspaceMembers();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const checkScroll = () => {
    if (tabsListRef.current) {
      const { scrollWidth, clientWidth } = tabsListRef.current;
      setShowScrollButtons(scrollWidth > clientWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [categories, allTransactions]);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsListRef.current) {
      const scrollAmount = 200;
      tabsListRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Ordem das abas de categoria (mesma logica usada para renderizar o TabsList abaixo)
  const categoryTabValues = useMemo(() => {
    const visibleCategories = categories.filter(cat => allTransactions.some(t => t.category_id === cat.id));
    return ["all", ...visibleCategories.map(cat => cat.id)];
  }, [categories, allTransactions]);

  // Mobile: arrastar horizontalmente na lista de lancamentos para navegar entre as abas de categoria
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const handleMobileTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleMobileTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const SWIPE_THRESHOLD = 60;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) {
      return;
    }

    const currentIndex = categoryTabValues.indexOf(filters.category);
    if (deltaX < 0 && currentIndex < categoryTabValues.length - 1) {
      setSwipeDirection('left');
      setFilters(prev => ({ ...prev, category: categoryTabValues[currentIndex + 1] }));
    } else if (deltaX > 0 && currentIndex > 0) {
      setSwipeDirection('right');
      setFilters(prev => ({ ...prev, category: categoryTabValues[currentIndex - 1] }));
    }
  };

  // Mantem a aba ativa visivel na barra rolavel ao trocar de categoria (via swipe ou clique)
  useEffect(() => {
    tabsListRef.current
      ?.querySelector('[data-state="active"]')
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [filters.category]);


  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedTransactions = useMemo(() => {
    const filtered = filteredTransactionsFromApi.filter((t) => {
      if (filters.costCenter === "unassigned" && t.cost_center_id) return false;
      if (filters.collaborator === "unassigned" && t.collaborator_id) return false;
      return true;
    });

    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      let aVal = a[sortConfig.key as keyof typeof a];
      let bVal = b[sortConfig.key as keyof typeof b];

      if (sortConfig.key === 'amount') {
        aVal = Number(aVal);
        bVal = Number(bVal);
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredTransactionsFromApi, filters.costCenter, filters.collaborator, sortConfig]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 whitespace-nowrap"><Check className="w-3 h-3 mr-1" /> Pago</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 whitespace-nowrap"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case "overdue":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 whitespace-nowrap"><AlertCircle className="w-3 h-3 mr-1" /> Vencido</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="whitespace-nowrap">Cancelado</Badge>;
      default:
        return <Badge variant="outline" className="whitespace-nowrap">{status}</Badge>;
    }
  };

  const handleMarkAsPaid = (id: string) => {
    updateTransaction.mutate({
      id,
      status: "paid",
      paid_date: new Date().toISOString().split("T")[0],
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este lançamento?")) {
      deleteTransaction.mutate(id);
    }
  };

  const handleAssignCostCenter = async (transactionId: string, costCenterId: string) => {
    setAssigningCostCenter(transactionId);
    try {
      await updateTransaction.mutateAsync({
        id: transactionId,
        cost_center_id: costCenterId === "none" ? null : costCenterId,
      });
      toast.success("Centro de custo atualizado!");
    } catch {
      toast.error("Erro ao atualizar centro de custo");
    } finally {
      setAssigningCostCenter(null);
    }
  };

  const filteredTransactions = useMemo(() => {
    return filteredTransactionsFromApi.filter((t) => {
      if (filters.costCenter === "unassigned" && t.cost_center_id) return false;
      if (filters.collaborator === "unassigned" && t.collaborator_id) return false;
      return true;
    });
  }, [filteredTransactionsFromApi, filters.costCenter, filters.collaborator]);

  // Get cost center name by id
  const getCostCenterById = (id: string | null) => {
    if (!id) return null;
    return costCenters.find((cc) => cc.id === id);
  };

  const handleExportExcel = () => {
    const dataToExport = sortedTransactions.map(t => ({
      'Tipo': t.type === 'income' ? 'Receita' : 'Despesa',
      'Descrição': t.description,
      'Categoria': t.category?.name || 'Sem categoria',
      'Centro de Custo': costCenters.find(cc => cc.id === t.cost_center_id)?.name || 'Nenhum',
      'Colaborador': t.collaborator?.profile?.full_name || t.collaborator?.profile?.email || 'Nenhum',
      'Vencimento': format(new Date(t.due_date), 'dd/MM/yyyy'),
      'Valor': t.amount,
      'Status': t.status === 'paid' ? 'Pago' : t.status === 'pending' ? 'Pendente' : t.status === 'overdue' ? 'Vencido' : 'Cancelado',
      'NF': t.invoice_number || '-',
      'Notas': t.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lançamentos");
    XLSX.writeFile(wb, `lancamentos_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
    toast.success("Arquivo gerado com sucesso!");
  };

  const clearFilters = () => {
    setFilters({
      type: "all",
      status: "all",
      category: "all",
      costCenter: "all",
      collaborator: "all",
      month: null,
    });
  };

  const hasActiveFilters = 
    filters.type !== "all" || 
    filters.status !== "all" || 
    filters.category !== "all" || 
    filters.costCenter !== "all" || 
    filters.collaborator !== "all" || 
    filters.month !== null;

  if (isLoading) {
    return <div className="text-muted-foreground p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
          <Select
            value={filters.type}
            onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
          >
            <SelectTrigger className="w-full md:w-[130px] bg-background">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="income">Receitas</SelectItem>
              <SelectItem value="expense">Despesas</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={filters.costCenter} 
            onValueChange={(value) => setFilters(prev => ({ ...prev, costCenter: value }))}
          >
            <SelectTrigger className="w-full md:w-[160px] bg-background">
              <FolderTree className="w-4 h-4 mr-2" />
              <SelectValue placeholder="C. Custo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Centros</SelectItem>
              <SelectItem value="unassigned">⚠️ Sem C. Custo</SelectItem>
              {costCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cc.color || "#3B82F6" }} />
                    {cc.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 border border-border rounded-md px-2 h-10 bg-background w-full md:w-auto overflow-hidden">
            <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-muted"
              onClick={() => setFilters(prev => ({ 
                ...prev, 
                month: prev.month ? subMonths(prev.month, 1) : subMonths(new Date(), 1) 
              }))}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, month: prev.month ? null : new Date() }))}
              className="text-xs font-medium min-w-[90px] text-center hover:text-primary transition-colors"
            >
              {filters.month
                ? format(filters.month, "MMM yyyy", { locale: ptBR })
                : "Todo período"}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-muted"
              onClick={() => setFilters(prev => ({ 
                ...prev, 
                month: prev.month ? addMonths(prev.month, 1) : addMonths(new Date(), 1) 
              }))}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="flex-1 md:flex-none">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Quick Status Filters */}
      <div className="flex flex-wrap gap-2 items-center bg-muted/30 p-2 rounded-lg border border-border/40">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2">Filtrar por Status:</span>
        <Button 
          variant={filters.status === "all" ? "default" : "ghost"} 
          size="sm" 
          onClick={() => setFilters(prev => ({ ...prev, status: "all" }))}
          className="h-7 rounded-full text-xs px-4"
        >
          Todos
        </Button>
        <Button 
          variant={filters.status === "paid" ? "default" : "ghost"} 
          size="sm" 
          onClick={() => setFilters(prev => ({ ...prev, status: "paid" }))}
          className={`h-7 rounded-full text-xs px-4 ${filters.status === "paid" ? "" : "text-green-600 hover:bg-green-50"}`}
        >
          Pagos
        </Button>
        <Button 
          variant={filters.status === "pending" ? "default" : "ghost"} 
          size="sm" 
          onClick={() => setFilters(prev => ({ ...prev, status: "pending" }))}
          className={`h-7 rounded-full text-xs px-4 ${filters.status === "pending" ? "" : "text-yellow-600 hover:bg-yellow-50"}`}
        >
          Pendentes
        </Button>
        <Button 
          variant={filters.status === "overdue" ? "default" : "ghost"} 
          size="sm" 
          onClick={() => setFilters(prev => ({ ...prev, status: "overdue" }))}
          className={`h-7 rounded-full text-xs px-4 ${filters.status === "overdue" ? "" : "text-red-600 hover:bg-red-50"}`}
        >
          Vencidos
        </Button>
      </div>

      {/* Reordered Active Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {filters.month && (
            <Badge className="gap-1 px-3 py-1 bg-primary text-primary-foreground font-semibold shadow-sm">
              <CalendarDays className="w-3 h-3" />
              {format(filters.month, "MMM yyyy", { locale: ptBR })}
              <X className="w-3.5 h-3.5 cursor-pointer ml-1 hover:bg-white/20 rounded-full" onClick={() => setFilters(prev => ({ ...prev, month: null }))} />
            </Badge>
          )}

          {filters.category !== "all" && (
            <Badge className="gap-1 px-3 py-1 bg-primary/90 text-primary-foreground font-semibold shadow-sm">
              <Filter className="w-3 h-3" />
              {categories.find(c => c.id === filters.category)?.name || "Categoria"}
              <X className="w-3.5 h-3.5 cursor-pointer ml-1 hover:bg-white/20 rounded-full" onClick={() => setFilters(prev => ({ ...prev, category: "all" }))} />
            </Badge>
          )}

          {filters.type !== "all" && (
            <Badge variant="outline" className="gap-1 px-2 py-1 bg-background border-primary/20 text-primary">
              {filters.type === "income" ? "Receitas" : "Despesas"}
              <X className="w-3 h-3 cursor-pointer ml-1 text-muted-foreground" onClick={() => setFilters(prev => ({ ...prev, type: "all" }))} />
            </Badge>
          )}

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="h-7 text-[10px] uppercase font-bold text-muted-foreground hover:text-destructive tracking-widest"
          >
            Limpar Filtros
          </Button>
        </div>
      )}

      {/* Abas de categoria — extraídas da tabela para continuarem visíveis
          também na visão em cards do mobile (antes viviam num truque de
          colSpan dentro do <thead>, e sumiam junto com a tabela). */}
      <div className="rounded-xl border border-border/50 bg-background overflow-hidden shadow-sm">
        <Tabs
          value={filters.category}
          onValueChange={(value) => {
            setFilters(prev => ({ ...prev, category: value }));
          }}
          className="w-full"
        >
          <div className="relative flex items-center group bg-muted/30">
            {/* Setas de rolagem: só no desktop (mouse/hover). No mobile o toque já
                arrasta a barra nativamente — as setas não são um padrão mobile e
                ficavam "grudadas" visíveis por causa do hover fantasma do touch. */}
            {showScrollButtons && (
              <button
                onClick={() => scrollTabs('left')}
                className="absolute left-0 z-10 bg-background/80 backdrop-blur-sm p-1 rounded-full shadow-md border border-border hidden md:group-hover:block hover:bg-background transition-all -ml-2"
              >
                <ChevronLeftCircle className="w-5 h-5 text-primary" />
              </button>
            )}

            <TabsList
              ref={tabsListRef}
              className="w-full justify-start h-10 bg-transparent rounded-none border-b border-border/50 p-0 gap-0 overflow-x-auto scrollbar-hide no-scrollbar"
            >
              <TabsTrigger
                value="all"
                className="h-10 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all font-medium text-xs text-muted-foreground whitespace-nowrap"
              >
                Todos
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px] bg-muted/50 text-muted-foreground border-none">
                  {allTransactions.length}
                </Badge>
              </TabsTrigger>
              {categories
                .filter(cat => allTransactions.some(t => t.category_id === cat.id))
                .map((cat) => (
                  <TabsTrigger
                    key={cat.id}
                    value={cat.id}
                    className="h-10 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all font-medium text-xs text-muted-foreground whitespace-nowrap"
                  >
                    {cat.name}
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px] bg-muted/50 text-muted-foreground border-none">
                      {allTransactions.filter(t => t.category_id === cat.id).length}
                    </Badge>
                  </TabsTrigger>
                ))}
            </TabsList>

            {showScrollButtons && (
              <button
                onClick={() => scrollTabs('right')}
                className="absolute right-0 z-10 bg-background/80 backdrop-blur-sm p-1 rounded-full shadow-md border border-border hidden md:group-hover:block hover:bg-background transition-all -mr-2"
              >
                <ChevronRightCircle className="w-5 h-5 text-primary" />
              </button>
            )}
            {/* Fade indicando "mais conteúdo" ao deslizar — a affordance mobile correta */}
            {showScrollButtons && (
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-muted/60 to-transparent md:hidden" />
            )}
          </div>
        </Tabs>

        {/* Mobile: lista em cards — sem colunas cortadas nem rolagem lateral forçada.
            Altura limitada com rolagem vertical nativa (arrastar o dedo), para a lista
            não empurrar o resto da página para baixo quando há muitos lançamentos.
            Arraste horizontal navega entre as abas de categoria (Todos/Clientes/Impostos/...). */}
        <div className="md:hidden relative">
          {categoryTabValues.indexOf(filters.category) > 0 && (
            <div className="pointer-events-none absolute left-0 top-1/2 z-10 -translate-y-1/2 opacity-30">
              <ChevronLeft className="h-5 w-5" />
            </div>
          )}
          {categoryTabValues.indexOf(filters.category) < categoryTabValues.length - 1 && (
            <div className="pointer-events-none absolute right-0 top-1/2 z-10 -translate-y-1/2 opacity-30">
              <ChevronRight className="h-5 w-5" />
            </div>
          )}
          <div
            key={filters.category}
            className={cn(
              "divide-y divide-border/40 max-h-[65vh] overflow-y-auto overscroll-contain touch-pan-y animate-in fade-in duration-200",
              swipeDirection === 'left' && "slide-in-from-right-8",
              swipeDirection === 'right' && "slide-in-from-left-8",
            )}
            onTouchStart={handleMobileTouchStart}
            onTouchEnd={handleMobileTouchEnd}
          >
          {sortedTransactions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              Nenhum lançamento encontrado
            </div>
          ) : (
            sortedTransactions.map((transaction) => {
              const costCenter = getCostCenterById(transaction.cost_center_id);
              const income = transaction.type === "income";
              return (
                <div key={transaction.id} className="p-3 active:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <div className={cn(
                      "shrink-0 mt-0.5 p-1.5 rounded-full",
                      income ? "bg-green-500/10" : "bg-red-500/10"
                    )}>
                      {income ? (
                        <ArrowUpCircle className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <ArrowDownCircle className="w-3.5 h-3.5 text-red-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug line-clamp-2">
                        {transaction.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1 text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">
                          {format(new Date(transaction.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        {costCenter && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1 min-w-0">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: costCenter.color || "#3B82F6" }}
                              />
                              <span className="truncate max-w-[140px]">{costCenter.name}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={cn(
                        "text-sm font-semibold tabular-nums whitespace-nowrap",
                        income ? "text-green-600" : "text-red-600"
                      )}>
                        {income ? "+" : "-"}{formatCurrency(transaction.amount)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {transaction.status === "pending" && (
                            <DropdownMenuItem onClick={() => handleMarkAsPaid(transaction.id)}>
                              <Check className="w-4 h-4 mr-2" />
                              Marcar como pago
                            </DropdownMenuItem>
                          )}
                          {onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(transaction)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(transaction.id)}
                            disabled={deleteTransaction.isPending}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="mt-2 ml-9">{getStatusBadge(transaction.status)}</div>
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* Desktop: tabela completa */}
        <div className="hidden md:block w-full overflow-hidden">
          <Table className="w-full border-collapse">
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-b border-border/50">
                <TableHead className="w-[60px] text-center font-semibold px-2 py-3">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('type')} className="h-8 font-semibold p-1 hover:bg-transparent -ml-1">
                    Tipo <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold px-4 py-3">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('description')} className="h-8 font-semibold p-1 -ml-1 hover:bg-transparent">
                    Descrição <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold px-4 py-3">Centro de Custo</TableHead>
                <TableHead className="w-[120px] font-semibold px-4 py-3">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('due_date')} className="h-8 font-semibold p-1 -ml-1 hover:bg-transparent">
                    Vencimento <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="w-[140px] font-semibold text-right px-4 py-3">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('amount')} className="h-8 font-semibold p-1 -mr-1 ml-auto hover:bg-transparent">
                    Valor <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="w-[110px] font-semibold px-4 py-3">Status</TableHead>
                <TableHead className="w-[50px] px-2 py-3"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum lançamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                sortedTransactions.map((transaction) => {
                  const costCenter = getCostCenterById(transaction.cost_center_id);
                  
                  return (
                    <TableRow key={transaction.id} className="hover:bg-muted/30 transition-colors border-b border-border/40 last:border-0 min-h-[56px]">
                      <TableCell className="text-center px-2 py-4">
                        {transaction.type === "income" ? (
                          <div className="flex justify-center">
                            <div className="p-2 rounded-full bg-green-500/10">
                              <ArrowUpCircle className="w-4 h-4 text-green-500" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <div className="p-2 rounded-full bg-red-500/10">
                              <ArrowDownCircle className="w-4 h-4 text-red-500" />
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-foreground py-4 px-4 max-w-[400px]">
                        <div className="truncate" title={transaction.description}>
                          {transaction.description}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Select
                            value={transaction.cost_center_id || "none"}
                            onValueChange={(value) => handleAssignCostCenter(transaction.id, value)}
                            disabled={assigningCostCenter === transaction.id}
                          >
                            <SelectTrigger className="h-8 text-xs w-[160px] bg-transparent border-none hover:bg-muted/50 transition-colors shadow-none px-2">
                              {assigningCostCenter === transaction.id ? (
                                <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                              ) : costCenter ? (
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <div
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: costCenter.color || "#3B82F6" }}
                                  />
                                  <span className="truncate">{costCenter.name}</span>
                                </div>
                              ) : (
                                <span className="text-amber-600 font-medium">Não atribuído</span>
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                <span className="text-muted-foreground">Nenhum</span>
                              </SelectItem>
                              {costCenters.map((cc) => (
                                <SelectItem key={cc.id} value={cc.id}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: cc.color || "#3B82F6" }}
                                    />
                                    {cc.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap px-4 py-4">
                        {format(new Date(transaction.due_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className={`text-right font-semibold whitespace-nowrap px-4 py-4 ${transaction.type === "income" ? "text-green-600" : "text-red-600"}`}>
                        {transaction.type === "income" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell className="px-4 py-4">{getStatusBadge(transaction.status)}</TableCell>
                      <TableCell className="px-2 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {transaction.status === "pending" && (
                              <DropdownMenuItem onClick={() => handleMarkAsPaid(transaction.id)}>
                                <Check className="w-4 h-4 mr-2" />
                                Marcar como pago
                              </DropdownMenuItem>
                            )}
                            {onEdit && (
                              <DropdownMenuItem onClick={() => onEdit(transaction)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(transaction.id)}
                              disabled={deleteTransaction.isPending}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
