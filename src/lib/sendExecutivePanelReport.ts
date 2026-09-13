import { supabase } from "@/integrations/supabase/client";
import { renderProposalPagesToPdfBlob } from "@/lib/exportProposalPdf";

export interface SendExecutivePanelReportParams {
  workspaceId: string;
  pageElements: HTMLElement[];
  filtersSummary?: string;
}

export interface SendExecutivePanelReportResult {
  recipients: { email: string; name: string | null }[];
  errors: { email: string; error: string }[];
}

/**
 * Gera o PDF do Painel Executivo no navegador (reaproveitando o rasterizador
 * de exportProposalPdf.ts), sobe pro Storage e aciona a edge function que
 * resolve os destinatários (papéis com acesso financeiro) e envia por e-mail.
 */
export async function sendExecutivePanelReport({
  workspaceId, pageElements, filtersSummary,
}: SendExecutivePanelReportParams): Promise<SendExecutivePanelReportResult> {
  // pixelRatio 1 — este é um relatório enviado por e-mail, não um documento
  // de impressão; pixelRatio 2 (padrão da proposta) gerava um PDF grande o
  // bastante para estourar o timeout do upload pro Storage.
  const pdfBlob = await renderProposalPagesToPdfBlob(pageElements, 1);
  const generatedAt = new Date();
  const storagePath = `${workspaceId}/${generatedAt.getTime()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("financial-reports")
    .upload(storagePath, pdfBlob, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw new Error(`Falha ao subir o PDF: ${uploadError.message}`);

  const { data, error } = await supabase.functions.invoke("send-financial-report", {
    body: {
      workspace_id: workspaceId,
      storage_path: storagePath,
      filters_summary: filtersSummary,
      generated_at: generatedAt.toLocaleString("pt-BR"),
    },
  });
  if (error) throw new Error(error.message || "Falha ao enviar o relatório.");
  if (!data || (!data.success && (!data.recipients || data.recipients.length === 0))) {
    const firstError = data?.errors?.[0]?.error;
    throw new Error(data?.error || firstError || "Falha ao enviar o relatório.");
  }

  return { recipients: data.recipients || [], errors: data.errors || [] };
}
