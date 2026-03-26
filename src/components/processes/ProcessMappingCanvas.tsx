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

const EDGE_STYLE = { stroke: "#3b4252" };
const EDGE_LABEL_STYLE = { fill: "#94a3b8", fontSize: 11, fontWeight: 500 };
const EDGE_MARKER = { type: MarkerType.ArrowClosed as const, color: "#3b4252" };

function makeEdge(id: string, source: string, target: string, label?: string): Edge {
  return {
    id,
    source,
    target,
    label,
    type: "smoothstep",
    style: EDGE_STYLE,
    labelStyle: EDGE_LABEL_STYLE,
    markerEnd: EDGE_MARKER,
  };
}

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
      makeEdge("e1-2", "n1", "n2", "Qualificado"),
      makeEdge("e1-3", "n1", "n3", "Direto"),
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
      makeEdge("ef1-2", "f1", "f2", "Aprovado"),
      makeEdge("ef2-3", "f2", "f3", "Validado"),
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
      makeEdge("eo1-2", "o1", "o2", "Concluído"),
      makeEdge("eo2-3", "o2", "o3", "Configurado"),
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

function stripCallbacks(nodes: Node[]): Node[] {
  return nodes.map((n) => ({ ...n, data: { ...n.data, onNodeClick: undefined } }));
}

// Recalculate step numbers based on position (top to bottom, left to right)
function recalcStepNumbers(nodes: Node[]): Node[] {
  const sorted = [...nodes].sort((a, b) => {
    const dy = a.position.y - b.position.y;
    return Math.abs(dy) > 40 ? dy : a.position.x - b.position.x;
  });
  return sorted.map((n, i) => ({
    ...n,
    data: { ...n.data, stepNumber: i + 1 },
  }));
}

type HistorySnapshot = { nodes: Node[]; edges: Edge[] };

export function ProcessMappingCanvas() {
  const initialMacros = useMemo(() => loadMacros(), []);
  const [macros, setMacros] = useState<MacroProcess[]>(initialMacros);
  const [activeMacroId, setActiveMacroId] = useState(initialMacros[0].id);
  const [newMacroName, setNewMacroName] = useState("");
  const [showNewInput, setShowNewInput] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const activeMacro = macros.find((m) => m.id === activeMacroId)!;

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

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const editingNode = editingNodeId ? nodes.find((n) => n.id === editingNodeId) : null;

  const nodeTypes = useMemo(() => ({ processStep: ProcessStepNode }), []);

  // -- Undo/Redo (FIX: use refs to avoid stale closure) --
  const historyRef = useRef<HistorySnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const [, forceRender] = useState(0);

  const pushHistory = useCallback(() => {
    const snapshot: HistorySnapshot = {
      nodes: stripCallbacks(nodesRef.current),
      edges: [...edgesRef.current],
    };
    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
    trimmed.push(snapshot);
    if (trimmed.length > 30) trimmed.shift();
    historyRef.current = trimmed;
    historyIndexRef.current = trimmed.length - 1;
    forceRender((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const snap = historyRef.current[historyIndexRef.current];
    setNodes(injectClickHandler(snap.nodes) as any);
    setEdges(snap.edges);
    forceRender((v) => v + 1);
  }, [setNodes, setEdges, injectClickHandler]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snap = historyRef.current[historyIndexRef.current];
    setNodes(injectClickHandler(snap.nodes) as any);
    setEdges(snap.edges);
    forceRender((v) => v + 1);
  }, [setNodes, setEdges, injectClickHandler]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // FIX: persist uses refs (no stale closure)
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

  // Auto-save debounced
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(persistCurrentState, 1000);
    return () => clearTimeout(saveTimerRef.current);
  }, [nodes, edges, persistCurrentState]);

  // FIX: switchMacro uses functional setMacros to get fresh state
  const switchMacro = (id: string) => {
    persistCurrentState();
    setActiveMacroId(id);
    // Use setTimeout to ensure macros state is updated before reading
    setMacros((currentMacros) => {
      const target = currentMacros.find((m) => m.id === id);
      if (target) {
        setNodes(injectClickHandler(target.nodes) as any);
        setEdges(target.edges);
      }
      return currentMacros;
    });
    historyRef.current = [];
    historyIndexRef.current = -1;
    forceRender((v) => v + 1);
  };

  const onConnect = useCallback(
    (params: Connection) => {
      pushHistory();
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            style: EDGE_STYLE,
            labelStyle: EDGE_LABEL_STYLE,
            markerEnd: EDGE_MARKER,
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

  // FIX: delete node + recalculate step numbers
  const deleteNode = useCallback((nodeId: string) => {
    pushHistory();
    setNodes((prev) => {
      const filtered = prev.filter((n) => n.id !== nodeId);
      return recalcStepNumbers(filtered) as typeof prev;
    });
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setEditingNodeId(null);
    toast.success("Etapa removida.");
  }, [setNodes, setEdges, pushHistory]);

  const existingPaths = useMemo(() => {
    if (!editingNodeId) return [];
    return edges
      .filter((e) => e.source === editingNodeId)
      .map((e) => ({ id: e.id, label: (e.label as string) || "" }));
  }, [editingNodeId, edges]);

  // FIX: handleSaveNode also removes edges whose paths were deleted
  const handleSaveNode = (data: { title: string; description: string; paths: { id: string; label: string }[] }) => {
    if (!editingNodeId) return;
    pushHistory();

    setNodes((prev) =>
      prev.map((n) =>
        n.id === editingNodeId ? { ...n, data: { ...n.data, title: data.title, description: data.description } } : n
      )
    );

    const currentEdgesFromNode = edges.filter((e) => e.source === editingNodeId);
    const keptPathIds = new Set(data.paths.map((p) => p.id));

    // Remove edges + orphan target nodes for deleted paths
    const edgesToRemove = currentEdgesFromNode.filter((e) => !keptPathIds.has(e.id));
    const orphanTargets = new Set(edgesToRemove.map((e) => e.target));

    // Only remove target nodes if they have no other incoming edges
    const safeOrphans = new Set<string>();
    orphanTargets.forEach((targetId) => {
      const otherIncoming = edges.filter((e) => e.target === targetId && e.source !== editingNodeId);
      if (otherIncoming.length === 0) safeOrphans.add(targetId);
    });

    // Update labels on kept edges
    setEdges((prev) => {
      const updated = prev
        .filter((e) => !(e.source === editingNodeId && !keptPathIds.has(e.id)))
        .map((e) => {
          if (e.source === editingNodeId) {
            const match = data.paths.find((p) => p.id === e.id);
            if (match) return { ...e, label: match.label };
          }
          return e;
        });
      return updated;
    });

    // Remove orphan nodes
    if (safeOrphans.size > 0) {
      setNodes((prev) => {
        const filtered = prev.filter((n) => !safeOrphans.has(n.id));
        return recalcStepNumbers(filtered) as typeof prev;
      });
      // Also remove edges connected to orphans
      setEdges((prev) => prev.filter((e) => !safeOrphans.has(e.source) && !safeOrphans.has(e.target)));
    }

    // Create new child nodes for new paths
    const existingEdgeIds = new Set(currentEdgesFromNode.map((e) => e.id));
    const parentNode = nodes.find((n) => n.id === editingNodeId);
    const baseX = parentNode?.position?.x ?? 300;
    const baseY = (parentNode?.position?.y ?? 200) + 180;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    data.paths.forEach((path, i) => {
      if (existingEdgeIds.has(path.id)) return;

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

      newEdges.push(makeEdge(`e-${editingNodeId}-${childId}`, editingNodeId, childId, path.label));
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
    historyRef.current = [];
    historyIndexRef.current = -1;
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

  const handleRename = (id: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    setMacros((prev) => {
      const updated = prev.map((m) => m.id === id ? { ...m, name: renameValue.trim() } : m);
      saveMacros(updated);
      return updated;
    });
    setRenamingId(null);
    toast.success("Nome atualizado.");
  };

  const exportPDF = () => {
    toast.info("Funcionalidade de exportação PDF será implementada em breve.");
  };

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

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
              {renamingId === m.id ? (
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRename(m.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(m.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-6 text-xs border-[#22262d] bg-[#121418] text-[#e2e8f0] px-1 py-0"
                  autoFocus
                />
              ) : (
                <span
                  className="text-sm flex-1 truncate"
                  style={{ color: m.id === activeMacroId ? "#e2e8f0" : "#94a3b8" }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(m.id);
                    setRenameValue(m.name);
                  }}
                  title="Duplo clique para renomear"
                >
                  {m.name}
                </span>
              )}
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
              style={{ color: canUndo ? "#94a3b8" : "#3b4252" }}
              onClick={undo}
              disabled={!canUndo}
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              style={{ color: canRedo ? "#94a3b8" : "#3b4252" }}
              onClick={redo}
              disabled={!canRedo}
              title="Refazer (Ctrl+Y)"
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
              labelStyle: EDGE_LABEL_STYLE,
              markerEnd: EDGE_MARKER,
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
