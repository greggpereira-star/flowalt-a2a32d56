import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { MacroProcess } from "./types";
import ProcessStepNode from "./ProcessStepNode";
import { ProcessNodeEditSheet } from "./ProcessNodeEditSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, FileDown, GitBranch, Undo2, Redo2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STORAGE_KEY = "flowalt_process_macros";

const DEFAULT_MACROS: MacroProcess[] = [
  {
    id: "comercial",
    name: "Comercial",
    icon: "💼",
    nodes: [
      { id: "n1", type: "processStep", position: { x: 300, y: 60 }, data: { stepNumber: 1, title: "Receber Lead", description: "Triagem inicial do lead recebido via canal de aquisição." } },
      { id: "n2", type: "processStep", position: { x: 150, y: 220 }, data: { stepNumber: 2, title: "Qualificação", description: "Verificar se o lead atende aos critérios mínimos." } },
      { id: "n3", type: "processStep", position: { x: 450, y: 220 }, data: { stepNumber: 3, title: "Proposta Enviada", description: "Elaborar e enviar proposta comercial." } },
    ],
    edges: [
      { id: "e1-2", source: "n1", target: "n2", label: "Qualificado", type: "smoothstep", animated: false, style: { stroke: "#3b4252" }, labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#3b4252" } },
      { id: "e1-3", source: "n1", target: "n3", label: "Direto", type: "smoothstep", animated: false, style: { stroke: "#3b4252" }, labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#3b4252" } },
    ],
  },
  {
    id: "financeiro",
    name: "Financeiro",
    icon: "💰",
    nodes: [
      { id: "f1", type: "processStep", position: { x: 300, y: 60 }, data: { stepNumber: 1, title: "Receber Fatura", description: "Entrada de fatura no sistema financeiro." } },
      { id: "f2", type: "processStep", position: { x: 150, y: 220 }, data: { stepNumber: 2, title: "Validar Dados", description: "Conferir dados fiscais e valores." } },
      { id: "f3", type: "processStep", position: { x: 450, y: 220 }, data: { stepNumber: 3, title: "Agendar Pagamento", description: "Registrar no calendário de pagamentos." } },
    ],
    edges: [
      { id: "ef1-2", source: "f1", target: "f2", label: "Aprovado", type: "smoothstep", style: { stroke: "#3b4252" }, labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#3b4252" } },
      { id: "ef2-3", source: "f2", target: "f3", label: "Validado", type: "smoothstep", style: { stroke: "#3b4252" }, labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#3b4252" } },
    ],
  },
  {
    id: "onboarding",
    name: "Onboarding",
    icon: "🚀",
    nodes: [
      { id: "o1", type: "processStep", position: { x: 300, y: 60 }, data: { stepNumber: 1, title: "Kick-off", description: "Reunião inicial com o cliente." } },
      { id: "o2", type: "processStep", position: { x: 300, y: 220 }, data: { stepNumber: 2, title: "Setup Ferramentas", description: "Configurar acessos e integrações." } },
      { id: "o3", type: "processStep", position: { x: 300, y: 380 }, data: { stepNumber: 3, title: "Entrega Inicial", description: "Primeira entrega ao cliente." } },
    ],
    edges: [
      { id: "eo1-2", source: "o1", target: "o2", label: "Concluído", type: "smoothstep", style: { stroke: "#3b4252" }, labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#3b4252" } },
      { id: "eo2-3", source: "o2", target: "o3", label: "Configurado", type: "smoothstep", style: { stroke: "#3b4252" }, labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#3b4252" } },
    ],
  },
];

function loadMacros(): MacroProcess[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_MACROS;
}

function saveMacros(macros: MacroProcess[]) {
  try {
    const clean = macros.map((m) => ({
      ...m,
      nodes: m.nodes.map((n: any) => ({ ...n, data: { ...n.data, onNodeClick: undefined } })),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch { /* ignore */ }
}

// Strip onNodeClick before comparing/storing
function stripCallbacks(nodes: Node[]): Node[] {
  return nodes.map((n) => ({ ...n, data: { ...n.data, onNodeClick: undefined } }));
}

export function ProcessMappingCanvas() {
  const initialMacros = useMemo(() => loadMacros(), []);
  const [macros, setMacros] = useState<MacroProcess[]>(initialMacros);
  const [activeMacroId, setActiveMacroId] = useState(initialMacros[0].id);
  const [newMacroName, setNewMacroName] = useState("");
  const [showNewInput, setShowNewInput] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const activeMacro = macros.find((m) => m.id === activeMacroId)!;

  // Refs to always have current node/edge values (fixes stale closure bug)
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  const injectClickHandler = useCallback(
    (nodes: Node[]) =>
      nodes.map((n) => ({
        ...n,
        data: { ...n.data, onNodeClick: (id: string) => setEditingNodeId(id) },
      })),
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(injectClickHandler(activeMacro.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(activeMacro.edges);

  // Keep refs in sync
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const editingNode = editingNodeId ? nodes.find((n) => n.id === editingNodeId) : null;

  const nodeTypes = useMemo(() => ({ processStep: ProcessStepNode }), []);

  // Undo/Redo history
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const pushHistory = useCallback(() => {
    const snapshot = { nodes: stripCallbacks(nodesRef.current), edges: [...edgesRef.current] };
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const next = [...trimmed, snapshot];
      if (next.length > 30) next.shift(); // cap
      return next;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 29));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    setNodes(injectClickHandler(prev.nodes) as any);
    setEdges(prev.edges);
    setHistoryIndex((i) => i - 1);
  }, [history, historyIndex, setNodes, setEdges, injectClickHandler]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setNodes(injectClickHandler(next.nodes) as any);
    setEdges(next.edges);
    setHistoryIndex((i) => i + 1);
  }, [history, historyIndex, setNodes, setEdges, injectClickHandler]);

  // FIX: Use refs to always persist current state (avoids stale closure)
  const persistCurrentState = useCallback(() => {
    const currentNodes = stripCallbacks(nodesRef.current);
    const currentEdges = [...edgesRef.current];
    setMacros((prev) => {
      const updated = prev.map((m) =>
        m.id === activeMacroId ? { ...m, nodes: currentNodes, edges: currentEdges } : m
      );
      saveMacros(updated);
      return updated;
    });
  }, [activeMacroId]);

  // Auto-save on changes (debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistCurrentState();
    }, 1000);
    return () => clearTimeout(saveTimerRef.current);
  }, [nodes, edges, persistCurrentState]);

  const switchMacro = (id: string) => {
    persistCurrentState();
    setActiveMacroId(id);
    const target = macros.find((m) => m.id === id)!;
    setNodes(injectClickHandler(target.nodes) as any);
    setEdges(target.edges);
    setHistory([]);
    setHistoryIndex(-1);
  };

  const onConnect = useCallback(
    (params: Connection) => {
      pushHistory();
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            style: { stroke: "#3b4252" },
            labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#3b4252" },
          },
          eds
        )
      );
    },
    [setEdges, pushHistory]
  );

  const addNode = () => {
    pushHistory();
    const stepNumber = nodes.length + 1;
    const newNode = {
      id: crypto.randomUUID(),
      type: "processStep" as const,
      position: { x: 300, y: stepNumber * 160 },
      data: {
        stepNumber,
        title: `Etapa ${stepNumber}`,
        description: "",
        onNodeClick: (id: string) => setEditingNodeId(id),
      },
    };
    setNodes((prev) => [...prev, newNode] as typeof prev);
  };

  const deleteNode = useCallback((nodeId: string) => {
    pushHistory();
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setEditingNodeId(null);
    toast.success("Etapa removida.");
  }, [setNodes, setEdges, pushHistory]);

  // FIX: Memoize existingPaths to avoid regenerating UUIDs every render
  const existingPaths = useMemo(() => {
    if (!editingNodeId) return [];
    return edges
      .filter((e) => e.source === editingNodeId)
      .map((e) => ({ id: e.id, label: (e.label as string) || "" }));
  }, [editingNodeId, edges]);

  const handleSaveNode = (data: { title: string; description: string; paths: { id: string; label: string }[] }) => {
    if (!editingNodeId) return;
    pushHistory();

    setNodes((prev) =>
      prev.map((n) =>
        n.id === editingNodeId ? { ...n, data: { ...n.data, title: data.title, description: data.description } } : n
      )
    );

    // Update existing edge labels
    const existingEdgeIds = new Set(edges.filter((e) => e.source === editingNodeId).map((e) => e.id));
    const updatedPathIds = new Set(data.paths.map((p) => p.id));

    // Update labels on existing edges
    setEdges((prev) =>
      prev.map((e) => {
        if (e.source === editingNodeId) {
          const matchingPath = data.paths.find((p) => p.id === e.id);
          if (matchingPath) {
            return { ...e, label: matchingPath.label };
          }
        }
        return e;
      })
    );

    // Create child nodes for genuinely new paths (not existing edge IDs)
    const parentNode = nodes.find((n) => n.id === editingNodeId);
    const baseX = parentNode?.position?.x ?? 300;
    const baseY = (parentNode?.position?.y ?? 200) + 180;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    data.paths.forEach((path, i) => {
      if (existingEdgeIds.has(path.id)) return; // already exists

      const childId = crypto.randomUUID();
      const offset = (i - (data.paths.length - 1) / 2) * 220;

      newNodes.push({
        id: childId,
        type: "processStep",
        position: { x: baseX + offset, y: baseY },
        data: {
          stepNumber: nodes.length + newNodes.length + 1,
          title: path.label,
          description: "",
          onNodeClick: (id: string) => setEditingNodeId(id),
        },
      });

      newEdges.push({
        id: `e-${editingNodeId}-${childId}`,
        source: editingNodeId,
        target: childId,
        label: path.label,
        type: "smoothstep",
        style: { stroke: "#3b4252" },
        labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b4252" },
      });
    });

    if (newNodes.length) setNodes((prev) => [...prev, ...newNodes] as typeof prev);
    if (newEdges.length) setEdges((prev) => [...prev, ...newEdges]);

    setEditingNodeId(null);
  };

  const createMacro = () => {
    if (!newMacroName.trim()) return;
    const newMacro: MacroProcess = {
      id: crypto.randomUUID(),
      name: newMacroName.trim(),
      icon: "📋",
      nodes: [],
      edges: [],
    };
    persistCurrentState();
    setMacros((prev) => {
      const updated = [...prev, newMacro];
      saveMacros(updated);
      return updated;
    });
    setActiveMacroId(newMacro.id);
    setNodes([]);
    setEdges([]);
    setNewMacroName("");
    setShowNewInput(false);
    setHistory([]);
    setHistoryIndex(-1);
    toast.success("Processo criado!");
  };

  const confirmDeleteMacro = () => {
    if (!deleteConfirmId) return;
    if (macros.length <= 1) {
      toast.error("É necessário manter pelo menos um processo.");
      setDeleteConfirmId(null);
      return;
    }
    const remaining = macros.filter((m) => m.id !== deleteConfirmId);
    setMacros(remaining);
    saveMacros(remaining);
    if (activeMacroId === deleteConfirmId) {
      setActiveMacroId(remaining[0].id);
      setNodes(injectClickHandler(remaining[0].nodes) as any);
      setEdges(remaining[0].edges);
    }
    setDeleteConfirmId(null);
    toast.success("Processo removido.");
  };

  const exportPDF = () => {
    toast.info("Funcionalidade de exportação PDF será implementada em breve.");
  };

  return (
    <div className="flex h-[calc(100vh-220px)] rounded-xl overflow-hidden" style={{ border: "1px solid #22262d" }}>
      {/* Sidebar */}
      <div
        className="w-64 shrink-0 flex flex-col overflow-y-auto"
        style={{ background: "#0d0f12", borderRight: "1px solid #22262d" }}
      >
        <div className="p-4 flex items-center gap-2" style={{ borderBottom: "1px solid #22262d" }}>
          <GitBranch className="w-4 h-4" style={{ color: "#00aeff" }} />
          <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>
            Macroprocessos
          </span>
        </div>

        <div className="flex-1 p-2 space-y-1">
          {macros.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors group"
              style={{
                background: m.id === activeMacroId ? "#0055ff15" : "transparent",
                border: m.id === activeMacroId ? "1px solid #0055ff30" : "1px solid transparent",
              }}
              onClick={() => switchMacro(m.id)}
            >
              <span className="text-base">{m.icon}</span>
              <span
                className="text-sm flex-1 truncate"
                style={{ color: m.id === activeMacroId ? "#e2e8f0" : "#94a3b8" }}
              >
                {m.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirmId(m.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          ))}
        </div>

        <div className="p-3" style={{ borderTop: "1px solid #22262d" }}>
          {showNewInput ? (
            <div className="flex gap-2">
              <Input
                value={newMacroName}
                onChange={(e) => setNewMacroName(e.target.value)}
                placeholder="Nome do processo"
                className="h-8 text-xs border-[#22262d] bg-[#121418] text-[#e2e8f0] placeholder:text-[#4b5563] focus-visible:ring-[#0055ff]"
                onKeyDown={(e) => e.key === "Enter" && createMacro()}
                autoFocus
              />
              <Button size="sm" className="h-8 px-2 shrink-0" style={{ background: "#0055ff" }} onClick={createMacro}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-2 text-xs justify-start"
              style={{ color: "#00aeff" }}
              onClick={() => setShowNewInput(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              Criar Novo Processo
            </Button>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col" style={{ background: "#0a0a0c" }}>
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: "1px solid #22262d", background: "#0d0f12" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-base">{activeMacro.icon}</span>
            <h2 className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>
              {activeMacro.name}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1a1e24", color: "#6b7280" }}>
              {nodes.length} etapas · {edges.length} conexões
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              style={{ color: historyIndex > 0 ? "#94a3b8" : "#3b4252" }}
              onClick={undo}
              disabled={historyIndex <= 0}
              title="Desfazer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              style={{ color: historyIndex < history.length - 1 ? "#94a3b8" : "#3b4252" }}
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              title="Refazer"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs"
              style={{ color: "#94a3b8" }}
              onClick={addNode}
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Etapa
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs"
              style={{ color: "#94a3b8" }}
              onClick={exportPDF}
            >
              <FileDown className="w-3.5 h-3.5" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            style={{ background: "#0a0a0c" }}
            defaultEdgeOptions={{
              type: "smoothstep",
              style: { stroke: "#3b4252", strokeWidth: 1.5 },
              labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#3b4252" },
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1a1e24" />
            <Controls
              style={{ background: "#121418", border: "1px solid #22262d", borderRadius: 8 }}
              showInteractive={false}
            />
          </ReactFlow>
        </div>
      </div>

      {/* Edit sheet */}
      <ProcessNodeEditSheet
        open={!!editingNodeId}
        onOpenChange={(open) => !open && setEditingNodeId(null)}
        nodeId={editingNodeId}
        title={(editingNode?.data as any)?.title || ""}
        description={(editingNode?.data as any)?.description || ""}
        paths={existingPaths}
        onSave={handleSaveNode}
        onDelete={editingNodeId ? () => deleteNode(editingNodeId) : undefined}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent style={{ background: "#0f1114", borderColor: "#22262d", color: "#e2e8f0" }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir macroprocesso?</AlertDialogTitle>
            <AlertDialogDescription style={{ color: "#94a3b8" }}>
              Todas as etapas e conexões serão removidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#22262d] text-[#94a3b8] hover:bg-[#1a1e24]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteMacro}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
