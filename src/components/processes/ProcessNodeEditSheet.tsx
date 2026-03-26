import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";

interface DecisionPath {
  id: string;
  label: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId: string | null;
  title: string;
  description: string;
  paths: DecisionPath[];
  onSave: (data: { title: string; description: string; paths: DecisionPath[] }) => void;
}

export function ProcessNodeEditSheet({
  open,
  onOpenChange,
  nodeId,
  title: initialTitle,
  description: initialDesc,
  paths: initialPaths,
  onSave,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDesc);
  const [paths, setPaths] = useState<DecisionPath[]>(initialPaths);

  useEffect(() => {
    setTitle(initialTitle);
    setDescription(initialDesc);
    setPaths(initialPaths);
  }, [initialTitle, initialDesc, initialPaths, nodeId]);

  const addPath = () => {
    setPaths((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: "" },
    ]);
  };

  const removePath = (id: string) => {
    setPaths((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePathLabel = (id: string, label: string) => {
    setPaths((prev) => prev.map((p) => (p.id === id ? { ...p, label } : p)));
  };

  const handleSave = () => {
    onSave({ title, description, paths: paths.filter((p) => p.label.trim()) });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[420px] border-l overflow-y-auto"
        style={{
          background: "#0f1114",
          borderColor: "#22262d",
          color: "#e2e8f0",
        }}
      >
        <SheetHeader>
          <SheetTitle style={{ color: "#e2e8f0" }}>Editar Etapa</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          <div className="space-y-2">
            <Label style={{ color: "#94a3b8" }}>Título da Etapa</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Qualificação do Lead"
              className="border-[#22262d] bg-[#121418] text-[#e2e8f0] placeholder:text-[#4b5563] focus-visible:ring-[#0055ff]"
            />
          </div>

          <div className="space-y-2">
            <Label style={{ color: "#94a3b8" }}>Descrição / Checklist</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva os passos, critérios ou checklist desta etapa..."
              rows={5}
              className="border-[#22262d] bg-[#121418] text-[#e2e8f0] placeholder:text-[#4b5563] focus-visible:ring-[#0055ff] resize-none"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label style={{ color: "#94a3b8" }}>Próximos Passos / Decisões</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={addPath}
                className="h-7 text-xs gap-1 text-[#00aeff] hover:text-[#0055ff] hover:bg-[#0055ff10]"
              >
                <Plus className="w-3 h-3" />
                Adicionar
              </Button>
            </div>

            {paths.length === 0 && (
              <p className="text-xs" style={{ color: "#4b5563" }}>
                Nenhum caminho adicionado. Clique em "Adicionar" para criar ramificações.
              </p>
            )}

            {paths.map((path) => (
              <div key={path.id} className="flex items-center gap-2">
                <Input
                  value={path.label}
                  onChange={(e) => updatePathLabel(path.id, e.target.value)}
                  placeholder='Ex: "Sim", "Não", "Aprovado"'
                  className="flex-1 border-[#22262d] bg-[#121418] text-[#e2e8f0] placeholder:text-[#4b5563] focus-visible:ring-[#0055ff] h-9 text-sm"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removePath(path.id)}
                  className="h-9 w-9 text-[#6b7280] hover:text-red-400 hover:bg-red-400/10 shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            onClick={handleSave}
            className="w-full mt-4 font-medium"
            style={{
              background: "linear-gradient(135deg, #0055ff, #00aeff)",
              color: "#fff",
            }}
          >
            Salvar Alterações
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
