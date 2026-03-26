import { useState, useCallback, useMemo } from "react";
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
import { Plus, Trash2, FileDown, GitBranch } from "lucide-react";
import { toast } from "sonner";

const INITIAL_MACROS: MacroProcess[] = [
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

export function ProcessMappingCanvas() {
  const [macros, setMacros] = useState<MacroProcess[]>(INITIAL_MACROS);
  const [activeMacroId, setActiveMacroId] = useState(INITIAL_MACROS[0].id);
  const [newMacroName, setNewMacroName] = useState("");
  const [showNewInput, setShowNewInput] = useState(false);

  const activeMacro = macros.find((m) => m.id === activeMacroId)!;

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

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const editingNode = editingNodeId ? nodes.find((n) => n.id === editingNodeId) : null;

  const nodeTypes = useMemo(() => ({ processStep: ProcessStepNode }), []);

  // Sync macro state when nodes/edges change
  const persistCurrentState = useCallback(() => {
    setMacros((prev) =>
      prev.map((m) =>
        m.id === activeMacroId
          ? { ...m, nodes: nodes.map((n) => ({ ...n, data: { ...n.data, onNodeClick: undefined } })), edges }
          : m
      )
    );
  }, [activeMacroId, nodes, edges]);

  const switchMacro = (id: string) => {
    persistCurrentState();
    setActiveMacroId(id);
    const target = macros.find((m) => m.id === id)!;
    setNodes(injectClickHandler(target.nodes));
    setEdges(target.edges);
  };

  const onConnect = useCallback(
    (params: Connection) => {
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
    [setEdges]
  );

  const addNode = () => {
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

  const handleSaveNode = (data: { title: string; description: string; paths: { id: string; label: string }[] }) => {
    if (!editingNodeId) return;

    setNodes((prev) =>
      prev.map((n) =>
        n.id === editingNodeId ? { ...n, data: { ...n.data, title: data.title, description: data.description } } : n
      )
    );

    // Create child nodes for new paths
    const existingChildEdges = edges.filter((e) => e.source === editingNodeId);
    const existingTargets = new Set(existingChildEdges.map((e) => e.target));

    const parentNode = nodes.find((n) => n.id === editingNodeId);
    const baseX = parentNode?.position?.x ?? 300;
    const baseY = (parentNode?.position?.y ?? 200) + 180;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    data.paths.forEach((path, i) => {
      const alreadyLinked = existingChildEdges.find((e) => {
        const edge = e as Edge;
        return edge.label === path.label;
      });

      if (!alreadyLinked) {
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
      }
    });

    if (newNodes.length) setNodes((prev) => [...prev, ...newNodes]);
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
    setMacros((prev) => [...prev, newMacro]);
    setActiveMacroId(newMacro.id);
    setNodes([]);
    setEdges([]);
    setNewMacroName("");
    setShowNewInput(false);
    toast.success("Processo criado!");
  };

  const deleteMacro = (id: string) => {
    if (macros.length <= 1) {
      toast.error("É necessário manter pelo menos um processo.");
      return;
    }
    const remaining = macros.filter((m) => m.id !== id);
    setMacros(remaining);
    if (activeMacroId === id) {
      setActiveMacroId(remaining[0].id);
      setNodes(injectClickHandler(remaining[0].nodes));
      setEdges(remaining[0].edges);
    }
    toast.success("Processo removido.");
  };

  const existingPaths = editingNodeId
    ? edges
        .filter((e) => e.source === editingNodeId)
        .map((e) => ({ id: crypto.randomUUID(), label: (e.label as string) || "" }))
    : [];

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
                  deleteMacro(m.id);
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
          </div>
          <div className="flex items-center gap-2">
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
      />
    </div>
  );
}
