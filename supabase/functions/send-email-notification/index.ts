import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_FLOWALT") || Deno.env.get("RESEND_API_KEY");

const getSender = () => {
  const env = Deno.env.toObject();
  const flow = env["RESEND_FROM_EMAIL_FLOW"];
  const fallback = env["RESEND_FROM_EMAIL"];
  
  // Use a heuristic to detect if it's a real email or a template string
  const isEmail = (str?: string) => str && str.includes("@") && str.includes(".");
  
  if (isEmail(flow)) return flow;
  if (isEmail(fallback)) return fallback;
  
  return "Flowalt <onboarding@resend.dev>";
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// TIPOS DE NOTIFICAÇÃO POR EMAIL
// ============================================================
type EmailNotificationType =
  // Autenticação
  | "welcome"
  | "email_confirmation"
  | "password_reset"
  | "password_changed"
  // Workspace
  | "workspace_invite"
  | "workspace_invite_accepted"
  | "workspace_invite_expired"
  | "workspace_invite_revoked"
  // Cards
  | "card_invite"
  | "card_invite_accepted"
  | "card_member_removed"
  // Governança
  | "role_changed"
  | "ownership_transferred"
  // Sistema
  | "time_alert"
  | "overdue_card"
  | "webhook_failure"
  | "goal_completed"
  | "level_up"
  | "custom";

// Mapeamento de tipo para categoria
const TYPE_TO_CATEGORY: Record<EmailNotificationType, string> = {
  welcome: "authentication",
  email_confirmation: "authentication",
  password_reset: "authentication",
  password_changed: "authentication",
  workspace_invite: "workspace",
  workspace_invite_accepted: "workspace",
  workspace_invite_expired: "workspace",
  workspace_invite_revoked: "workspace",
  card_invite: "cards",
  card_invite_accepted: "cards",
  card_member_removed: "cards",
  role_changed: "governance",
  ownership_transferred: "governance",
  time_alert: "system",
  overdue_card: "system",
  webhook_failure: "system",
  goal_completed: "gamification",
  level_up: "gamification",
  custom: "system",
};

// Tipos críticos que NUNCA podem ser desativados
const CRITICAL_TYPES: EmailNotificationType[] = [
  "email_confirmation",
  "password_reset",
  "password_changed",
];

interface EmailRequest {
  type: EmailNotificationType;
  workspace_id?: string;
  user_id?: string;
  email?: string;
  subject?: string;
  data: Record<string, any>;
  skip_preference_check?: boolean; // Para emails críticos de segurança
}

// ============================================================
// STRUCTURED LOGGING
// ============================================================
function createLogger(correlationId: string, workspaceId?: string) {
  const log = (level: string, message: string, context: Record<string, unknown> = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: "send-email-notification",
      correlationId,
      workspaceId,
      message,
      ...context,
    };
    if (level === "error") {
      console.error(JSON.stringify(entry));
    } else if (level === "warn") {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  };

  return {
    info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
    debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
  };
}

// ============================================================
// TEMPLATE BASE (HEADER E FOOTER)
// ============================================================
const EMAIL_BASE = {
  header: (title: string) => `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 32px 40px; text-align: center;">
                  <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Flowalt</h1>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
  `,
  footer: () => `
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; text-align: center;">
                    Este é um email automático do Flowalt. Por favor, não responda diretamente.
                  </p>
                  <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                    © ${new Date().getFullYear()} Flowalt. Todos os direitos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `,
};

// ============================================================
// COMPONENTES REUTILIZÁVEIS
// ============================================================
const EmailComponents = {
  heading: (text: string, color = "#111827") => `
    <h2 style="margin: 0 0 16px 0; color: ${color}; font-size: 24px; font-weight: 600; line-height: 1.3;">
      ${text}
    </h2>
  `,
  paragraph: (text: string) => `
    <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
      ${text}
    </p>
  `,
  highlight: (label: string, value: string) => `
    <p style="margin: 0 0 12px 0; color: #374151; font-size: 15px;">
      <strong style="color: #111827;">${label}:</strong> ${value}
    </p>
  `,
  button: (text: string, url: string, color = "#3b82f6") => `
    <table role="presentation" style="margin: 24px 0;">
      <tr>
        <td style="background: ${color}; border-radius: 8px;">
          <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 32px; color: white; text-decoration: none; font-size: 16px; font-weight: 600;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `,
  divider: () => `
    <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
  `,
  infoBox: (content: string, bgColor = "#f0f9ff", borderColor = "#0ea5e9") => `
    <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 16px; margin: 16px 0; border-radius: 4px;">
      ${content}
    </div>
  `,
  warningBox: (content: string) => `
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0; border-radius: 4px;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        ⚠️ ${content}
      </p>
    </div>
  `,
};

// ============================================================
// TEMPLATES DE EMAIL
// ============================================================
const EMAIL_TEMPLATES: Record<EmailNotificationType, (data: any) => { subject: string; html: string }> = {
  // ======= AUTENTICAÇÃO =======
  welcome: (data) => ({
    subject: "Bem-vindo ao Flowalt! 🚀",
    html:
      EMAIL_BASE.header("Boas-vindas") +
      EmailComponents.heading("Sua jornada começa agora! 🚀") +
      EmailComponents.paragraph(`Olá ${data.name || "usuário"}, seja muito bem-vindo ao Flowalt.`) +
      EmailComponents.paragraph("Estamos animados para ajudar você e sua equipe a alcançarem novos níveis de produtividade e organização.") +
      EmailComponents.infoBox(`
        <p style="margin: 0; color: #1e40af;">Por onde começar?</p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #1e40af;">
          <li>Explore seus espaços de trabalho</li>
          <li>Crie seu primeiro card ou tarefa</li>
          <li>Convide sua equipe para colaborar</li>
        </ul>
      `) +
      (data.action_url ? EmailComponents.button("Acessar minha conta", data.action_url, "#3b82f6") : "") +
      EMAIL_BASE.footer(),
  }),

  email_confirmation: (data) => ({
    subject: "Confirme seu email no Flowalt",
    html:
      EMAIL_BASE.header("Confirmação de Email") +
      EmailComponents.heading("Bem-vindo ao Flowalt! 🎉") +
      EmailComponents.paragraph(`Olá${data.name ? `, ${data.name}` : ""}!`) +
      EmailComponents.paragraph("Estamos muito felizes em ter você conosco. Para começar a usar o Flowalt, confirme seu email clicando no botão abaixo.") +
      EmailComponents.button("Confirmar Email", data.confirmation_url, "#22c55e") +
      EmailComponents.divider() +
      EmailComponents.paragraph("Se você não criou uma conta no Flowalt, pode ignorar este email com segurança.") +
      EMAIL_BASE.footer(),
  }),

  password_reset: (data) => ({
    subject: "Redefinição de senha - Flowalt",
    html:
      EMAIL_BASE.header("Redefinição de Senha") +
      EmailComponents.heading("Redefinição de Senha 🔐") +
      EmailComponents.paragraph("Recebemos uma solicitação para redefinir a senha da sua conta no Flowalt.") +
      EmailComponents.button("Redefinir Senha", data.reset_url, "#3b82f6") +
      EmailComponents.warningBox("Este link expira em 1 hora. Se você não solicitou esta redefinição, ignore este email e sua senha permanecerá inalterada.") +
      EMAIL_BASE.footer(),
  }),

  password_changed: (data) => ({
    subject: "🔒 Sua senha foi alterada - Flowalt",
    html:
      EMAIL_BASE.header("Senha Alterada") +
      EmailComponents.heading("Sua senha foi alterada 🔒") +
      EmailComponents.paragraph("Sua senha do Flowalt foi alterada com sucesso.") +
      EmailComponents.highlight("Data", new Date().toLocaleString("pt-BR")) +
      (data.ip_address ? EmailComponents.highlight("IP", data.ip_address) : "") +
      EmailComponents.warningBox("Se você não realizou esta alteração, entre em contato conosco imediatamente e altere sua senha.") +
      EMAIL_BASE.footer(),
  }),

  // ======= WORKSPACE =======
  workspace_invite: (data) => ({
    subject: `🎉 Você foi convidado para ${data.workspace_name}`,
    html:
      EMAIL_BASE.header("Convite para Workspace") +
      EmailComponents.heading("Você foi convidado! 🎉") +
      EmailComponents.paragraph(`<strong>${data.inviter_name || "Alguém"}</strong> convidou você para participar do workspace <strong>"${data.workspace_name}"</strong> no Flowalt.`) +
      EmailComponents.infoBox(`
        ${EmailComponents.highlight("Workspace", data.workspace_name)}
        ${EmailComponents.highlight("Função", data.role_label || data.role)}
        ${data.expires_in ? EmailComponents.highlight("Expira em", data.expires_in) : ""}
      `) +
      EmailComponents.button("Aceitar Convite", data.invite_url, "#22c55e") +
      EmailComponents.divider() +
      EmailComponents.paragraph("Se você não esperava este convite, pode ignorá-lo com segurança.") +
      EMAIL_BASE.footer(),
  }),

  workspace_invite_accepted: (data) => ({
    subject: `✅ ${data.user_name} aceitou seu convite`,
    html:
      EMAIL_BASE.header("Convite Aceito") +
      EmailComponents.heading("Convite Aceito! ✅") +
      EmailComponents.paragraph(`<strong>${data.user_name}</strong> aceitou seu convite e agora faz parte do workspace <strong>"${data.workspace_name}"</strong>.`) +
      EmailComponents.highlight("Novo membro", data.user_name) +
      EmailComponents.highlight("Email", data.user_email) +
      EmailComponents.highlight("Função", data.role_label || data.role) +
      EmailComponents.button("Ver Equipe", data.team_url, "#3b82f6") +
      EMAIL_BASE.footer(),
  }),

  workspace_invite_expired: (data) => ({
    subject: `⏰ Convite expirado para ${data.workspace_name}`,
    html:
      EMAIL_BASE.header("Convite Expirado") +
      EmailComponents.heading("Convite Expirado ⏰") +
      EmailComponents.paragraph(`O convite para participar do workspace <strong>"${data.workspace_name}"</strong> expirou.`) +
      EmailComponents.paragraph("Se você ainda deseja participar, solicite um novo convite ao administrador do workspace.") +
      EMAIL_BASE.footer(),
  }),

  workspace_invite_revoked: (data) => ({
    subject: `Convite revogado para ${data.workspace_name}`,
    html:
      EMAIL_BASE.header("Convite Revogado") +
      EmailComponents.heading("Convite Revogado") +
      EmailComponents.paragraph(`O convite para participar do workspace <strong>"${data.workspace_name}"</strong> foi revogado pelo administrador.`) +
      EmailComponents.paragraph("Se você acredita que isso foi um erro, entre em contato com o administrador do workspace.") +
      EMAIL_BASE.footer(),
  }),

  // ======= CARDS =======
  card_invite: (data) => ({
    subject: `📋 Você foi convidado para colaborar em "${data.card_title}"`,
    html:
      EMAIL_BASE.header("Convite para Card") +
      EmailComponents.heading("Novo Convite de Colaboração 📋") +
      EmailComponents.paragraph(`Você foi convidado para colaborar no card <strong>"${data.card_title}"</strong>.`) +
      EmailComponents.infoBox(`
        ${EmailComponents.highlight("Card", data.card_title)}
        ${EmailComponents.highlight("Permissão", data.permission_label || data.permission)}
        ${data.inviter_name ? EmailComponents.highlight("Convidado por", data.inviter_name) : ""}
      `) +
      EmailComponents.button("Ver Card", data.card_url, "#8b5cf6") +
      EMAIL_BASE.footer(),
  }),

  card_invite_accepted: (data) => ({
    subject: `✅ ${data.user_name} aceitou seu convite para "${data.card_title}"`,
    html:
      EMAIL_BASE.header("Convite Aceito") +
      EmailComponents.heading("Colaborador Adicionado! ✅") +
      EmailComponents.paragraph(`<strong>${data.user_name}</strong> aceitou o convite para colaborar no card <strong>"${data.card_title}"</strong>.`) +
      EmailComponents.button("Ver Card", data.card_url, "#3b82f6") +
      EMAIL_BASE.footer(),
  }),

  card_member_removed: (data) => ({
    subject: `Você foi removido do card "${data.card_title}"`,
    html:
      EMAIL_BASE.header("Remoção de Card") +
      EmailComponents.heading("Acesso Removido") +
      EmailComponents.paragraph(`Você foi removido do card <strong>"${data.card_title}"</strong>.`) +
      EmailComponents.paragraph("Se você acredita que isso foi um erro, entre em contato com o responsável pelo card.") +
      EMAIL_BASE.footer(),
  }),

  // ======= GOVERNANÇA =======
  role_changed: (data) => ({
    subject: `🔄 Sua função foi alterada em ${data.workspace_name}`,
    html:
      EMAIL_BASE.header("Alteração de Função") +
      EmailComponents.heading("Sua Função Foi Alterada 🔄") +
      EmailComponents.paragraph(`Sua função no workspace <strong>"${data.workspace_name}"</strong> foi alterada.`) +
      EmailComponents.highlight("Função anterior", data.old_role_label || data.old_role) +
      EmailComponents.highlight("Nova função", data.new_role_label || data.new_role) +
      EmailComponents.button("Ver Workspace", data.workspace_url, "#3b82f6") +
      EMAIL_BASE.footer(),
  }),

  ownership_transferred: (data) => ({
    subject: `👑 Você é o novo proprietário de ${data.workspace_name}`,
    html:
      EMAIL_BASE.header("Transferência de Propriedade") +
      EmailComponents.heading("Você é o Novo Proprietário! 👑") +
      EmailComponents.paragraph(`A propriedade do workspace <strong>"${data.workspace_name}"</strong> foi transferida para você.`) +
      EmailComponents.infoBox(`
        <p style="margin: 0; color: #1e40af;">
          Como proprietário, você tem controle total sobre o workspace, incluindo:
        </p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #1e40af;">
          <li>Gerenciamento de membros</li>
          <li>Configurações do workspace</li>
          <li>Acesso financeiro completo</li>
          <li>Transferência de propriedade</li>
        </ul>
      `) +
      EmailComponents.button("Acessar Workspace", data.workspace_url, "#3b82f6") +
      EMAIL_BASE.footer(),
  }),

  // ======= SISTEMA =======
  time_alert: (data) => ({
    subject: `⏰ Alerta de Tempo: ${data.card_title || "Atividade"}`,
    html:
      EMAIL_BASE.header("Alerta de Tempo") +
      EmailComponents.heading("Alerta de Tempo ⏰", "#f59e0b") +
      EmailComponents.paragraph(`Este é um alerta sobre o tempo dedicado à atividade <strong>"${data.card_title || "Sem título"}"</strong>.`) +
      EmailComponents.infoBox(`
        ${EmailComponents.highlight("Tempo Estimado", data.estimated_time || "Não definido")}
        ${EmailComponents.highlight("Tempo Gasto", data.spent_time || "0h 0m")}
        ${data.percentage ? EmailComponents.highlight("Progresso", `${data.percentage}%`) : ""}
      `) +
      (data.percentage >= 100 
        ? EmailComponents.warningBox("O tempo gasto atingiu ou superou o tempo estimado originalmente.")
        : EmailComponents.paragraph("Você está se aproximando do limite de tempo definido para esta tarefa.")) +
      (data.card_url ? EmailComponents.button("Ver Atividade", data.card_url, "#f59e0b") : "") +
      EMAIL_BASE.footer(),
  }),

  overdue_card: (data) => ({
    subject: `⚠️ Card atrasado: ${data.card_title}`,
    html:
      EMAIL_BASE.header("Card Atrasado") +
      EmailComponents.heading("Card Atrasado ⚠️", "#ef4444") +
      EmailComponents.paragraph(`O card <strong>"${data.card_title}"</strong> está atrasado.`) +
      EmailComponents.highlight("Data de vencimento", data.due_date) +
      EmailComponents.highlight("Dias de atraso", data.days_overdue) +
      (data.assignee ? EmailComponents.highlight("Responsável", data.assignee) : "") +
      EmailComponents.button("Ver Card", data.card_url, "#ef4444") +
      EMAIL_BASE.footer(),
  }),

  webhook_failure: (data) => ({
    subject: `🚨 Webhook falhando: ${data.webhook_name}`,
    html:
      EMAIL_BASE.header("Falha de Webhook") +
      EmailComponents.heading("Falha em Webhook 🚨", "#ef4444") +
      EmailComponents.paragraph(`O webhook <strong>"${data.webhook_name}"</strong> está falhando repetidamente.`) +
      EmailComponents.highlight("URL", data.webhook_url) +
      EmailComponents.highlight("Falhas consecutivas", data.failure_count) +
      EmailComponents.highlight("Último erro", data.last_error) +
      EmailComponents.warningBox("Verifique se o endpoint está acessível e retornando status 2xx.") +
      EMAIL_BASE.footer(),
  }),

  goal_completed: (data) => ({
    subject: `🎉 Meta semanal concluída: ${data.goal_title}`,
    html:
      EMAIL_BASE.header("Meta Concluída") +
      EmailComponents.heading("Parabéns! 🎉", "#22c55e") +
      EmailComponents.paragraph(`Você completou a meta <strong>"${data.goal_title}"</strong>!`) +
      EmailComponents.highlight("Pontos ganhos", `+${data.points} pts`) +
      (data.badge ? EmailComponents.highlight("Badge desbloqueada", data.badge) : "") +
      EmailComponents.paragraph("Continue assim! 💪") +
      EMAIL_BASE.footer(),
  }),

  level_up: (data) => ({
    subject: `🆙 Você subiu de nível: ${data.new_level_name}!`,
    html:
      EMAIL_BASE.header("Level Up!") +
      EmailComponents.heading("Level Up! 🆙", "#8b5cf6") +
      EmailComponents.paragraph(`Parabéns! Você alcançou o nível <strong>${data.new_level}</strong>!`) +
      `<p style="font-size: 48px; text-align: center; margin: 16px 0;">${data.level_icon}</p>` +
      `<p style="text-align: center; font-size: 24px; font-weight: bold; color: #8b5cf6; margin: 0 0 16px 0;">
        ${data.new_level_name}
      </p>` +
      EmailComponents.highlight("Pontuação total", `${data.total_score} pts`) +
      EmailComponents.paragraph("Continue evoluindo! 🚀") +
      EMAIL_BASE.footer(),
  }),

  custom: (data) => ({
    subject: data.subject || "Notificação do Flowalt",
    html:
      EMAIL_BASE.header(data.subject || "Notificação") +
      (data.heading ? EmailComponents.heading(data.heading) : "") +
      (data.message ? EmailComponents.paragraph(data.message) : "") +
      (data.html || "") +
      (data.button_text && data.button_url
        ? EmailComponents.button(data.button_text, data.button_url)
        : "") +
      EMAIL_BASE.footer(),
  }),
};

// ============================================================
// ENVIO DE EMAIL VIA RESEND
// ============================================================
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  logger: ReturnType<typeof createLogger>
) {
  logger.debug("Sending email via Resend", { to, subject });

  const trySend = async (from: string) => {
    return await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    });
  };

  const sender = getSender();
  logger.info("Attempting to send email", { from: sender, to });
  let response = await trySend(sender);

  if (response.status === 403) {
    const errorText = await response.clone().text();
    if (errorText.includes("not verified") && sender !== "Flowalt <onboarding@resend.dev>") {
      logger.warn("Custom domain not verified, falling back to default sender", {
        failedEmail: sender
      });
      response = await trySend("Flowalt <onboarding@resend.dev>");
    }
  }

  if (!response.ok) {
    const error = await response.text();
    logger.error("Resend API error", { status: response.status, error });
    throw new Error(`Resend API error: ${error}`);
  }

  return response.json();
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  const startTime = Date.now();
  let logger = createLogger(correlationId);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      type,
      workspace_id,
      user_id,
      email,
      subject,
      data,
      skip_preference_check,
    }: EmailRequest = await req.json();

    // Update logger with workspace context
    logger = createLogger(correlationId, workspace_id);
    logger.info("Processing email notification request", {
      type,
      userId: user_id,
      hasEmail: !!email,
    });

    // Get recipient email
    let recipientEmail = email;
    let recipientUserId = user_id;

    if (!recipientEmail && user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user_id)
        .single();
      recipientEmail = profile?.email;
      logger.debug("Fetched email from profile", {
        userId: user_id,
        found: !!recipientEmail,
      });
    }

    if (!recipientEmail) {
      logger.warn("No recipient email provided");
      return new Response(
        JSON.stringify({ error: "No recipient email provided" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Correlation-ID": correlationId,
          },
        }
      );
    }

    // Check user preferences (unless it's a critical email or explicitly skipped)
    const isCritical = CRITICAL_TYPES.includes(type);
    if (!isCritical && !skip_preference_check && recipientUserId) {
      const category = TYPE_TO_CATEGORY[type] || "system";
      const { data: wantsNotification } = await supabase.rpc(
        "user_wants_notification",
        {
          p_user_id: recipientUserId,
          p_category: category,
        }
      );

      if (wantsNotification === false) {
        logger.info("User opted out of this notification category", {
          category,
          type,
        });

        // Log the skipped notification
        await supabase.from("email_notifications_log").insert({
          workspace_id,
          user_id: recipientUserId,
          email: recipientEmail,
          notification_type: type,
          subject: "Skipped - User preference",
          status: "skipped",
          correlation_id: correlationId,
          metadata: { category, reason: "user_preference" },
        });

        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: "user_preference",
            correlation_id: correlationId,
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "X-Correlation-ID": correlationId,
            },
          }
        );
      }
    }

    // Get email content from template
    const template = EMAIL_TEMPLATES[type];
    if (!template) {
      logger.warn("Invalid email type", { type });
      return new Response(JSON.stringify({ error: "Invalid email type" }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Correlation-ID": correlationId,
        },
      });
    }

    const emailContent = template(data);
    const finalSubject = subject || emailContent.subject;

    // Send email via Resend
    const emailResponse = await sendEmail(
      recipientEmail,
      finalSubject,
      emailContent.html,
      logger
    );

    // Log the notification
    await supabase.from("email_notifications_log").insert({
      workspace_id,
      user_id: recipientUserId,
      email: recipientEmail,
      notification_type: type,
      subject: finalSubject,
      status: "sent",
      resend_id: emailResponse.id,
      correlation_id: correlationId,
      sent_at: new Date().toISOString(),
      metadata: {
        data,
        category: TYPE_TO_CATEGORY[type],
        is_critical: isCritical,
      },
    });

    const duration = Date.now() - startTime;
    logger.info("Email sent successfully", {
      resendId: emailResponse.id,
      recipient: recipientEmail,
      type,
      durationMs: duration,
    });

    return new Response(
      JSON.stringify({
        success: true,
        id: emailResponse.id,
        correlation_id: correlationId,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Correlation-ID": correlationId,
        },
      }
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error("Error sending email", {
      error: error.message,
      durationMs: duration,
    });

    return new Response(
      JSON.stringify({ error: error.message, correlation_id: correlationId }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Correlation-ID": correlationId,
        },
      }
    );
  }
});
