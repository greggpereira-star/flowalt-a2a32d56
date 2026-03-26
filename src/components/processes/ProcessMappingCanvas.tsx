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
import {
  Plus, Trash2, FileDown, GitBranch, Undo2, Redo2, Link,
  Copy, SplitSquareHorizontal, CornerDownRight,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ───────── constants ───────── */
const STORAGE_KEY = "flowalt_process_macros";
const NODE_GAP_Y = 180;
const NODE_GAP_X = 220;

const EDGE_STYLE = { stroke: "#3b4252", strokeWidth: 1.5 };
const EDGE_LABEL_STYLE = { fill: "#94a3b8", fontSize: 11, fontWeight: 500 };
const EDGE_MARKER = { type: MarkerType.ArrowClosed as const, color: "#3b4252" };

/* ───────── helpers ───────── */
function makeEdge(id: string, source: string, target: string, label?: string): Edge {
  return {
    id,
    source,
    target,
    label: label || undefined,
    type: "smoothstep",
    style: EDGE_STYLE,
    labelStyle: EDGE_LABEL_STYLE,
    markerEnd: EDGE_MARKER,
  };
}

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

function getNextY(nodes: Node[]): number {
  if (nodes.length === 0) return 60;
  return Math.max(...nodes.map((n) => n.position.y)) + NODE_GAP_Y;
}

function stripCallbacks(nodes: Node[]): Node[] {
  return nodes.map((n) => ({
    ...n,
    data: { ...n.data, onNodeClick: undefined },
  }));
}

/** Find a free X position at a given Y level to avoid overlap */
function findFreeX(nodes: Node[], targetY: number, preferredX: number): number {
  const sameLevel = nodes.filter((n) => Math.abs(n.position.y - targetY) < 60);
  if (sameLevel.length === 0) return preferredX;
  const occupiedXs = sameLevel.map((n) => n.position.x);
  let x = preferredX;
  while (occupiedXs.some((ox) => Math.abs(ox - x) < 200)) {
    x += NODE_GAP_X;
  }
  return x;
}

/* ───────── defaults ───────── */
const DEFAULT_MACROS: MacroProcess[] = [
  {
    id: "comercial", name: "Comercial", icon: "💼",
    nodes: [
      { id: "n1", type: "processStep", position: { x: 300, y: 60 }, data: { stepNumber: 1, title: "Receber Lead", description: "Triagem inicial do lead recebido via canal de aquisição." } },
      { id: "n2", type: "processStep", position: { x: 150, y: 240 }, data: { stepNumber: 2, title: "Qualificação", description: "Verificar se o lead atende aos critérios mínimos." } },
      { id: "n3", type: "processStep", position: { x: 450, y: 240 }, data: { stepNumber: 3, title: "Proposta Enviada", description: "Elaborar e enviar proposta comercial." } },
    ],
    edges: [makeEdge("e1-2", "n1", "n2", "Qualificado"), makeEdge("e1-3", "n1", "n3", "Direto")],
  },
  {
    id: "financeiro", name: "Financeiro", icon: "💰",
    nodes: [
      { id: "f1", type: "processStep", position: { x: 300, y: 60 }, data: { stepNumber: 1, title: "Receber Fatura", description: "Entrada de fatura no sistema financeiro." } },
      { id: "f2", type: "processStep", position: { x: 150, y: 240 }, data: { stepNumber: 2, title: "Validar Dados", description: "Conferir dados fiscais e valores." } },
      { id: "f3", type: "processStep", position: { x: 450, y: 240 }, data: { stepNumber: 3, title: "Agendar Pagamento", description: "Registrar no calendário de pagamentos." } },
    ],
    edges: [makeEdge("ef1-2", "f1", "f2", "Aprovado"), makeEdge("ef2-3", "f2", "f3", "Validado")],
  },
  {
    id: "onboarding", name: "Onboarding", icon: "🚀",
    nodes: [
      { id: "o1", type: "processStep", position: { x: 300, y: 60 }, data: { stepNumber: 1, title: "Kick-off", description: "Reunião inicial com o cliente." } },
      { id: "o2", type: "processStep", position: { x: 300, y: 240 }, data: { stepNumber: 2, title: "Setup Ferramentas", description: "Configurar acessos e integrações." } },
      { id: "o3", type: "processStep", position: { x: 300, y: 420 }, data: { stepNumber: 3, title: "Entrega Inicial", description: "Primeira entrega ao cliente." } },
    ],
    edges: [makeEdge("eo1-2", "o1", "o2", "Concluído"), makeEdge("eo2-3", "o2", "o3", "Configurado")],
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

/* ───────── history ───────── */
type HistorySnapshot = { nodes: Node[]; edges: Edge[] };

/* ═══════════════════════════════════════════════════ */
export function ProcessMappingCanvas() {
  const initialMacros = useMemo(() => loadMacros(), []);
  const [macros, setMacros] = useState<MacroProcess[]>(initialMacros);
  const [activeMacroId, setActiveMacroId] = useState(initialMacros[0].id);
  const [newMacroName, setNewMacroName] = useState("");
  const [showNewInput, setShowNewInput] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const activeMacro = macros.find((m) => m.id === activeMacroId)!;

  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  /* click handler injection */
  const handleNodeClick = useCallback((id: string) => setEditingNodeId(id), []);

  const injectClickHandler = useCallback(
    (rawNodes: Node[]) =>
      rawNodes.map((n) => ({
        ...n,
        data: { ...n.data, onNodeClick: handleNodeClick },
      })),
    [handleNodeClick]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(injectClickHandler(activeMacro.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(activeMacro.edges);

  // Keep refs always in sync
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const editingNode = editingNodeId ? nodes.find((n) => n.id === editingNodeId) : null;

  const nodeTypes = useMemo(() => ({ processStep: ProcessStepNode }), []);

  /* ── Factory: create a node with proper handler ── */
  const createNode = useCallback(
    (pos: { x: number; y: number }, title: string, description = ""): Node => ({
      id: crypto.randomUUID(),
      type: "processStep",
      position: pos,
      data: {
        stepNumber: 0, // will be recalculated
        title,
        description,
        onNodeClick: handleNodeClick,
      },
    }),
    [handleNodeClick]
  );

  /* ── Undo / Redo ── */
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

  const applySnapshot = useCallback(
    (snap: HistorySnapshot) => {
      setNodes(injectClickHandler(snap.nodes) as any);
      setEdges(snap.edges);
      forceRender((v) => v + 1);
    },
    [setNodes, setEdges, injectClickHandler]
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    applySnapshot(historyRef.current[historyIndexRef.current]);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    applySnapshot(historyRef.current[historyIndexRef.current]);
  }, [applySnapshot]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  /* ── Persistence ── */
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

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(persistCurrentState, 1000);
    return () => clearTimeout(saveTimerRef.current);
  }, [nodes, edges, persistCurrentState]);

  /* ── Macro switching ── */
  const switchMacro = (id: string) => {
    if (id === activeMacroId) return;
    persistCurrentState();
    setActiveMacroId(id);
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
    setSelectedNodeId(null);
    forceRender((v) => v + 1);
  };

  /* ── Track selected node via ReactFlow selection ── */
  const handleSelectionChange = useCallback(({ nodes: sel }: { nodes: Node[] }) => {
    setSelectedNodeId(sel.length === 1 ? sel[0].id : null);
  }, []);

  /* ── Connection ── */
  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source === params.target) {
        toast.warning("Não é possível conectar um nó a si mesmo.");
        return;
      }
      const currentEdges = edgesRef.current;
      if (currentEdges.some((e) => e.source === params.source && e.target === params.target)) {
        toast.warning("Essa conexão já existe.");
        return;
      }
      pushHistory();
      setEdges((eds) =>
        addEdge(
          { ...params, type: "smoothstep", style: EDGE_STYLE, labelStyle: EDGE_LABEL_STYLE, markerEnd: EDGE_MARKER },
          eds
        )
      );
      toast.success("Conexão criada.");
    },
    [setEdges, pushHistory]
  );

  /* ── Add node (isolated) ── */
  const addNode = useCallback(() => {
    pushHistory();
    const cur = nodesRef.current;
    const y = getNextY(cur);
    const newNode = createNode({ x: 300, y }, `Etapa ${cur.length + 1}`);
    setNodes((prev) => recalcStepNumbers([...prev, newNode]) as typeof prev);
    toast.success("Nova etapa adicionada.");
  }, [pushHistory, setNodes, createNode]);

  /* ── Add node (connected to leaf) ── */
  const addNodeConnected = useCallback(() => {
    pushHistory();
    const cur = nodesRef.current;
    const curEdges = edgesRef.current;
    const y = getNextY(cur);
    const newNode = createNode({ x: 300, y }, `Etapa ${cur.length + 1}`);

    const sourcesWithOutgoing = new Set(curEdges.map((e) => e.source));
    const leafNodes = cur.filter((n) => !sourcesWithOutgoing.has(n.id));
    const connectFrom = leafNodes.length > 0
      ? leafNodes.reduce((a, b) => (a.position.y > b.position.y ? a : b))
      : cur.length > 0
        ? cur.reduce((a, b) => (a.position.y > b.position.y ? a : b))
        : null;

    const updatedNodes = recalcStepNumbers([...cur, newNode]);
    setNodes(injectClickHandler(updatedNodes) as any);

    if (connectFrom) {
      setEdges((prev) => [...prev, makeEdge(`e-${connectFrom.id}-${newNode.id}`, connectFrom.id, newNode.id)]);
    }
    toast.success("Etapa adicionada e conectada.");
  }, [pushHistory, setNodes, setEdges, createNode, injectClickHandler]);

  /* ── Add branch from selected node ── */
  const addBranchFromSelected = useCallback(() => {
    if (!selectedNodeId) {
      toast.info("Selecione uma etapa no canvas primeiro.");
      return;
    }
    pushHistory();
    const cur = nodesRef.current;
    const parentNode = cur.find((n) => n.id === selectedNodeId);
    if (!parentNode) return;

    const childY = parentNode.position.y + NODE_GAP_Y;
    const freeX = findFreeX(cur, childY, parentNode.position.x);
    const newNode = createNode({ x: freeX, y: childY }, `Ramificação`);

    const updatedNodes = recalcStepNumbers([...cur, newNode]);
    setNodes(injectClickHandler(updatedNodes) as any);
    setEdges((prev) => [...prev, makeEdge(`e-${selectedNodeId}-${newNode.id}`, selectedNodeId, newNode.id)]);
    toast.success("Ramificação criada.");
  }, [selectedNodeId, pushHistory, setNodes, setEdges, createNode, injectClickHandler]);

  /* ── Duplicate selected node ── */
  const duplicateSelectedNode = useCallback(() => {
    if (!selectedNodeId) {
      toast.info("Selecione uma etapa para duplicar.");
      return;
    }
    pushHistory();
    const cur = nodesRef.current;
    const source = cur.find((n) => n.id === selectedNodeId);
    if (!source) return;

    const newNode = createNode(
      { x: source.position.x + NODE_GAP_X, y: source.position.y },
      `${(source.data as any).title} (cópia)`,
      (source.data as any).description || ""
    );

    const updatedNodes = recalcStepNumbers([...cur, newNode]);
    setNodes(injectClickHandler(updatedNodes) as any);
    toast.success("Etapa duplicada.");
  }, [selectedNodeId, pushHistory, setNodes, createNode, injectClickHandler]);

  /* ── Insert node between two connected nodes ── */
  const insertBetweenNodes = useCallback(() => {
    if (!selectedNodeId) {
      toast.info("Selecione uma etapa de origem para inserir entre ela e seus destinos.");
      return;
    }
    pushHistory();
    const cur = nodesRef.current;
    const curEdges = edgesRef.current;
    const parentNode = cur.find((n) => n.id === selectedNodeId);
    if (!parentNode) return;

    // Find the first outgoing edge
    const outEdge = curEdges.find((e) => e.source === selectedNodeId);
    if (!outEdge) {
      toast.warning("Essa etapa não tem conexões de saída para inserir entre.");
      return;
    }

    const targetNode = cur.find((n) => n.id === outEdge.target);
    if (!targetNode) return;

    // Position in the middle
    const midX = (parentNode.position.x + targetNode.position.x) / 2;
    const midY = (parentNode.position.y + targetNode.position.y) / 2;

    // Push target node down to make room
    const newNode = createNode({ x: midX, y: midY }, "Nova Etapa Intermediária");

    // Remove old edge, create two new ones
    const edge1 = makeEdge(`e-${selectedNodeId}-${newNode.id}`, selectedNodeId, newNode.id, outEdge.label as string);
    const edge2 = makeEdge(`e-${newNode.id}-${outEdge.target}`, newNode.id, outEdge.target);

    // Push nodes below the insertion point downward
    const adjustedNodes = cur.map((n) => {
      if (n.position.y >= midY && n.id !== parentNode.id) {
        return { ...n, position: { ...n.position, y: n.position.y + NODE_GAP_Y / 2 } };
      }
      return n;
    });

    const updatedNodes = recalcStepNumbers([...adjustedNodes, newNode]);
    setNodes(injectClickHandler(updatedNodes) as any);
    setEdges((prev) => [...prev.filter((e) => e.id !== outEdge.id), edge1, edge2]);
    toast.success("Etapa intermediária inserida.");
  }, [selectedNodeId, pushHistory, setNodes, setEdges, createNode, injectClickHandler]);

  /* ── Delete node + orphan cleanup ── */
  const deleteNode = useCallback((nodeId: string) => {
    pushHistory();
    const curEdges = edgesRef.current;

    const childEdges = curEdges.filter((e) => e.source === nodeId);
    const orphanIds = new Set<string>();
    childEdges.forEach((ce) => {
      const otherIncoming = curEdges.filter((e) => e.target === ce.target && e.source !== nodeId);
      if (otherIncoming.length === 0) orphanIds.add(ce.target);
    });

    const allRemoved = new Set([nodeId, ...orphanIds]);

    setNodes((prev) => {
      const filtered = prev.filter((n) => !allRemoved.has(n.id));
      return recalcStepNumbers(filtered) as typeof prev;
    });
    setEdges((prev) => prev.filter((e) => !allRemoved.has(e.source) && !allRemoved.has(e.target)));
    setEditingNodeId(null);
    setSelectedNodeId(null);
    toast.success("Etapa removida.");
  }, [setNodes, setEdges, pushHistory]);

  /* ── Edit sheet: existing paths ── */
  const existingPaths = useMemo(() => {
    if (!editingNodeId) return [];
    return edgesRef.current
      .filter((e) => e.source === editingNodeId)
      .map((e) => ({ id: e.id, label: (e.label as string) || "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingNodeId, edges]);

  /* ── Save node (title, desc, paths → create children) ── */
  const handleSaveNode = useCallback(
    (data: { title: string; description: string; paths: { id: string; label: string }[] }) => {
      if (!editingNodeId) return;
      pushHistory();

      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      const parentNode = currentNodes.find((n) => n.id === editingNodeId);
      const baseX = parentNode?.position?.x ?? 300;

      // 1) Update node data
      const updatedNodeList = currentNodes.map((n) =>
        n.id === editingNodeId
          ? { ...n, data: { ...n.data, title: data.title, description: data.description } }
          : n
      );

      const edgesFromNode = currentEdges.filter((e) => e.source === editingNodeId);
      const keptPathIds = new Set(data.paths.map((p) => p.id));
      const existingEdgeIds = new Set(edgesFromNode.map((e) => e.id));

      // 2) Orphan detection for removed paths
      const edgesToRemove = edgesFromNode.filter((e) => !keptPathIds.has(e.id));
      const orphanIds = new Set<string>();
      edgesToRemove.forEach((re) => {
        const otherIncoming = currentEdges.filter((e) => e.target === re.target && e.source !== editingNodeId);
        if (otherIncoming.length === 0) orphanIds.add(re.target);
      });

      // 3) Create children for NEW paths (avoid overlap with findFreeX)
      const newPaths = data.paths.filter((p) => !existingEdgeIds.has(p.id));
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      // Calculate Y for new children: below the lowest existing child or parent+GAP
      const existingChildIds = edgesFromNode.filter((e) => keptPathIds.has(e.id)).map((e) => e.target);
      const existingChildren = currentNodes.filter((n) => existingChildIds.includes(n.id));
      const childY = existingChildren.length > 0
        ? Math.max(...existingChildren.map((c) => c.position.y))
        : (parentNode?.position?.y ?? 60) + NODE_GAP_Y;

      // Combine existing + new nodes for collision detection
      const allNodesForCollision = [...updatedNodeList.filter((n) => !orphanIds.has(n.id)), ...newNodes];

      newPaths.forEach((path, i) => {
        const totalNew = newPaths.length;
        const offset = (i - (totalNew - 1) / 2) * NODE_GAP_X;
        const preferredX = baseX + offset;
        const freeX = findFreeX([...allNodesForCollision, ...newNodes], childY, preferredX);

        const child = createNode({ x: freeX, y: childY }, path.label || "Nova Etapa");
        newNodes.push(child);
        newEdges.push(makeEdge(`e-${editingNodeId}-${child.id}`, editingNodeId, child.id, path.label));
      });

      // 4) Apply edges atomically
      setEdges(() => {
        let updated = currentEdges
          .filter((e) => !(e.source === editingNodeId && !keptPathIds.has(e.id)))
          .filter((e) => !orphanIds.has(e.source) && !orphanIds.has(e.target))
          .map((e) => {
            if (e.source === editingNodeId) {
              const match = data.paths.find((p) => p.id === e.id);
              if (match) return { ...e, label: match.label };
            }
            return e;
          });
        return [...updated, ...newEdges];
      });

      // 5) Apply nodes atomically
      const finalNodes = [...updatedNodeList.filter((n) => !orphanIds.has(n.id)), ...newNodes];
      setNodes(injectClickHandler(recalcStepNumbers(finalNodes)) as any);

      setEditingNodeId(null);
    },
    [editingNodeId, pushHistory, setNodes, setEdges, createNode, injectClickHandler]
  );

  /* ── Macro CRUD ── */
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
    if (!renameValue.trim()) { setRenamingId(null); return; }
    setMacros((prev) => {
      const updated = prev.map((m) => (m.id === id ? { ...m, name: renameValue.trim() } : m));
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

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="flex h-[calc(100vh-220px)] rounded-xl overflow-hidden" style={{ border: "1px solid #22262d" }}>
      {/* ── Sidebar ── */}
      <div className="w-64 shrink-0 flex flex-col overflow-y-auto" style={{ background: "#0d0f12", borderRight: "1px solid #22262d" }}>
        <div className="p-4 flex items-center gap-2" style={{ borderBottom: "1px solid #22262d" }}>
          <GitBranch className="w-4 h-4" style={{ color: "#00aeff" }} />
          <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>Macroprocessos</span>
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
                  onDoubleClick={(e) => { e.stopPropagation(); setRenamingId(m.id); setRenameValue(m.name); }}
                  title="Duplo clique para renomear"
                >
                  {m.name}
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(m.id); }}
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

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col" style={{ background: "#0a0a0c" }}>
        {/* Toolbar */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0 flex-wrap gap-2"
          style={{ borderBottom: "1px solid #22262d", background: "#0d0f12" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-base">{activeMacro.icon}</span>
            <h2 className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{activeMacro.name}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1a1e24", color: "#6b7280" }}>
              {nodes.length} etapas · {edges.length} conexões
            </span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {/* Undo / Redo */}
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" style={{ color: canUndo ? "#94a3b8" : "#3b4252" }} onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" style={{ color: canRedo ? "#94a3b8" : "#3b4252" }} onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Y)">
              <Redo2 className="w-3.5 h-3.5" />
            </Button>
            <div className="w-px h-5 mx-1" style={{ background: "#22262d" }} />

            {/* Add new nodes */}
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" style={{ color: "#94a3b8" }} onClick={addNode} title="Etapa isolada">
              <Plus className="w-3.5 h-3.5" /> Nova Etapa
            </Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" style={{ color: "#00aeff" }} onClick={addNodeConnected} title="Conectada ao último nó">
              <Link className="w-3.5 h-3.5" /> Etapa Conectada
            </Button>

            {/* Advanced add options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" style={{ color: "#94a3b8" }} title="Mais opções de adição">
                  <SplitSquareHorizontal className="w-3.5 h-3.5" /> Mais
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                style={{ background: "#0f1114", borderColor: "#22262d", color: "#e2e8f0" }}
                className="min-w-[200px]"
              >
                <DropdownMenuItem
                  onClick={addBranchFromSelected}
                  className="gap-2 text-xs cursor-pointer focus:bg-[#0055ff15] focus:text-[#e2e8f0]"
                >
                  <CornerDownRight className="w-3.5 h-3.5" style={{ color: "#00aeff" }} />
                  Ramificar da Selecionada
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={insertBetweenNodes}
                  className="gap-2 text-xs cursor-pointer focus:bg-[#0055ff15] focus:text-[#e2e8f0]"
                >
                  <SplitSquareHorizontal className="w-3.5 h-3.5" style={{ color: "#00aeff" }} />
                  Inserir Entre Etapas
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={duplicateSelectedNode}
                  className="gap-2 text-xs cursor-pointer focus:bg-[#0055ff15] focus:text-[#e2e8f0]"
                >
                  <Copy className="w-3.5 h-3.5" style={{ color: "#00aeff" }} />
                  Duplicar Selecionada
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-5 mx-1" style={{ background: "#22262d" }} />
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" style={{ color: "#94a3b8" }} onClick={exportPDF}>
              <FileDown className="w-3.5 h-3.5" /> Exportar
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <GitBranch className="w-10 h-10 mx-auto" style={{ color: "#22262d" }} />
              <p className="text-sm" style={{ color: "#4b5563" }}>Nenhuma etapa ainda. Comece adicionando sua primeira etapa.</p>
              <div className="flex gap-2 justify-center">
                <Button size="sm" onClick={addNode} className="gap-1.5 text-xs" style={{ background: "linear-gradient(135deg, #0055ff, #00aeff)", color: "#fff" }}>
                  <Plus className="w-3.5 h-3.5" /> Criar Primeira Etapa
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Canvas */}
        {nodes.length > 0 && (
          <div className="flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={handleSelectionChange}
              nodeTypes={nodeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
              style={{ background: "#0a0a0c" }}
              defaultEdgeOptions={{
                type: "smoothstep",
                style: EDGE_STYLE,
                labelStyle: EDGE_LABEL_STYLE,
                markerEnd: EDGE_MARKER,
              }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1a1e24" />
              <Controls style={{ background: "#121418", border: "1px solid #22262d", borderRadius: 8 }} showInteractive={false} />
            </ReactFlow>
          </div>
        )}
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

      {/* Delete macro confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent style={{ background: "#0f1114", borderColor: "#22262d", color: "#e2e8f0" }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir macroprocesso?</AlertDialogTitle>
            <AlertDialogDescription style={{ color: "#94a3b8" }}>
              Todas as etapas e conexões serão removidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#22262d] text-[#94a3b8] hover:bg-[#1a1e24]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteMacro} className="bg-red-600 hover:bg-red-700 text-white">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
