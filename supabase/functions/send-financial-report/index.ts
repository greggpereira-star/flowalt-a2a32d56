import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_FLOWALT") || Deno.env.get("RESEND_API_KEY");
const REPORT_BUCKET = "financial-reports";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Papéis com acesso financeiro — mesmo critério de hasFinanceAccess em usePermissions.ts
const FINANCE_ROLES = ["owner", "finance", "super_admin"];

const getSender = () => {
  const env = Deno.env.toObject();
  const flow = env["RESEND_FROM_EMAIL_FLOW"];
  const fallback = env["RESEND_FROM_EMAIL"];
  const isEmail = (str?: string) => !!str && str.includes("@") && str.includes(".");
  if (isEmail(flow)) return flow;
  if (isEmail(fallback)) return fallback;
  return "Flowalt <onboarding@resend.dev>";
};

interface ReportRequest {
  workspace_id: string;
  storage_path: string;
  filters_summary?: string;
  generated_at?: string;
  analysis_type?: string | null;
}

function createLogger(correlationId: string, workspaceId?: string) {
  const log = (level: string, message: string, context: Record<string, unknown> = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: "send-financial-report",
      correlationId,
      workspaceId,
      message,
      ...context,
    }));
  };
  return {
    info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
  };
}

function buildEmailHtml(opts: {
  workspaceName: string;
  filtersSummary?: string;
  generatedAt?: string;
  analysisType?: string | null;
}) {
  const { workspaceName, filtersSummary, generatedAt, analysisType } = opts;
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:40px 20px;">
          <table role="presentation" style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%);padding:32px 40px;text-align:center;">
                <h1 style="margin:0;color:white;font-size:28px;font-weight:700;">Flowalt</h1>
              </td>
            </tr>
            <tr><td style="padding:40px;">
              <h2 style="margin:0 0 16px 0;color:#111827;font-size:22px;font-weight:600;">Relatório Executivo — ${workspaceName}</h2>
              <p style="margin:0 0 16px 0;color:#4b5563;font-size:15px;line-height:1.6;">
                Segue em anexo o PDF do Painel Executivo, com indicadores, fluxo mensal e projeção de caixa.
              </p>
              ${filtersSummary ? `<p style="margin:0 0 8px 0;color:#374151;font-size:14px;"><strong>Filtros aplicados:</strong> ${filtersSummary}</p>` : ""}
              ${generatedAt ? `<p style="margin:0 0 8px 0;color:#374151;font-size:14px;"><strong>Gerado em:</strong> ${generatedAt}</p>` : ""}
              ${analysisType ? `<p style="margin:0 0 8px 0;color:#374151;font-size:14px;"><strong>Análise incluída:</strong> ${analysisType}</p>` : ""}
              <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">Este é um email automático do Flowalt. Por favor, não responda diretamente.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

async function sendEmail(to: string, subject: string, html: string, attachment: { filename: string; content: string }, logger: ReturnType<typeof createLogger>) {
  const trySend = async (from: string) => {
    return await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from, to: [to], subject, html, attachments: [attachment] }),
    });
  };

  const rawSender = getSender();
  const sender = rawSender.includes("<") ? rawSender : `Flowalt <${rawSender}>`;
  let response = await trySend(sender);

  if (response.status === 403) {
    const errorText = await response.clone().text();
    if (errorText.includes("not verified") && sender !== "Flowalt <onboarding@resend.dev>") {
      logger.warn("Custom domain not verified, falling back to default sender", { failedEmail: sender });
      response = await trySend("Flowalt <onboarding@resend.dev>");
    }
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }
  return response.json();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  let logger = createLogger(correlationId);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const requesterToken = authHeader.replace(/^Bearer\s+/i, "");
    const { data: requesterData, error: requesterError } = await supabase.auth.getUser(requesterToken);
    if (requesterError || !requesterData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const requesterId = requesterData.user.id;

    const { workspace_id, storage_path, filters_summary, generated_at, analysis_type }: ReportRequest = await req.json();
    logger = createLogger(correlationId, workspace_id);

    if (!workspace_id || !storage_path) {
      return new Response(JSON.stringify({ error: "workspace_id e storage_path são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Só quem já tem acesso financeiro pode disparar o envio.
    const { data: requesterRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterId)
      .eq("workspace_id", workspace_id)
      .maybeSingle();
    if (!requesterRole || !FINANCE_ROLES.includes(requesterRole.role)) {
      logger.warn("Requester without finance access tried to send report", { requesterId });
      return new Response(JSON.stringify({ error: "Sem permissão para enviar relatórios financeiros" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: workspace } = await supabase.from("workspaces").select("name").eq("id", workspace_id).maybeSingle();
    const workspaceName = workspace?.name || "seu workspace";

    // Destinatários: membros com acesso financeiro (owner, finance, super_admin).
    const { data: roleRows, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("workspace_id", workspace_id)
      .in("role", FINANCE_ROLES);
    if (rolesError) throw rolesError;

    const userIds = Array.from(new Set((roleRows || []).map((r) => r.user_id)));
    if (userIds.length === 0) {
      logger.warn("No finance-role recipients found");
      return new Response(JSON.stringify({ error: "Nenhum destinatário com acesso financeiro encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);
    if (profilesError) throw profilesError;

    const recipients = (profiles || []).filter((p) => !!p.email);
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum destinatário com e-mail cadastrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Baixa o PDF já gerado e subido pelo cliente.
    const { data: pdfBlob, error: downloadError } = await supabase.storage
      .from(REPORT_BUCKET)
      .download(storage_path);
    if (downloadError || !pdfBlob) {
      throw new Error(`Falha ao baixar PDF do Storage: ${downloadError?.message}`);
    }
    const pdfBuffer = await pdfBlob.arrayBuffer();
    const pdfBase64 = arrayBufferToBase64(pdfBuffer);
    const filename = `relatorio-executivo-${new Date().toISOString().slice(0, 10)}.pdf`;

    const html = buildEmailHtml({ workspaceName, filtersSummary: filters_summary, generatedAt: generated_at, analysisType: analysis_type });
    const subject = `Relatório Executivo — ${workspaceName}`;

    const sentTo: { email: string; name: string | null }[] = [];
    const errors: { email: string; error: string }[] = [];

    for (const recipient of recipients) {
      try {
        const emailResponse = await sendEmail(recipient.email, subject, html, { filename, content: pdfBase64 }, logger);
        await supabase.from("email_notifications_log").insert({
          workspace_id,
          user_id: recipient.id,
          email: recipient.email,
          notification_type: "financial_report",
          subject,
          status: "sent",
          resend_id: emailResponse.id,
          correlation_id: correlationId,
          sent_at: new Date().toISOString(),
          metadata: {
            requested_by: requesterId,
            filters_summary,
            generated_at,
            analysis_type: analysis_type || null,
            storage_path,
          },
        });
        sentTo.push({ email: recipient.email, name: recipient.full_name });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("Failed to send to recipient", { email: recipient.email, error: message });
        await supabase.from("email_notifications_log").insert({
          workspace_id,
          user_id: recipient.id,
          email: recipient.email,
          notification_type: "financial_report",
          subject,
          status: "failed",
          error_message: message,
          correlation_id: correlationId,
          metadata: { requested_by: requesterId, filters_summary, generated_at, storage_path },
        });
        errors.push({ email: recipient.email, error: message });
      }
    }

    logger.info("Financial report send complete", { sentCount: sentTo.length, errorCount: errors.length });

    return new Response(
      JSON.stringify({ success: sentTo.length > 0, recipients: sentTo, errors, correlation_id: correlationId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Error sending financial report", { error: message });
    return new Response(JSON.stringify({ error: message, correlation_id: correlationId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
