import { useMutation } from "@tanstack/react-query";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useToast } from "@/hooks/use-toast";
import { sendExecutivePanelReport } from "@/lib/sendExecutivePanelReport";

export function useSendFinancialReport() {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ pageElements, filtersSummary }: { pageElements: HTMLElement[]; filtersSummary?: string }) => {
      if (!currentWorkspace?.id) throw new Error("Nenhum workspace selecionado.");
      return sendExecutivePanelReport({ workspaceId: currentWorkspace.id, pageElements, filtersSummary });
    },
    onSuccess: (result) => {
      if (result.recipients.length === 0) {
        toast({
          title: "Nenhum destinatário",
          description: "Nenhum usuário com acesso financeiro recebeu o relatório.",
          variant: "destructive",
        });
        return;
      }
      const names = result.recipients.map((r) => r.name || r.email).join(", ");
      toast({ title: "Relatório enviado", description: `Enviado para: ${names}` });
      if (result.errors.length > 0) {
        toast({
          title: "Alguns envios falharam",
          description: result.errors.map((e) => e.email).join(", "),
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar relatório", description: error.message, variant: "destructive" });
    },
  });
}
