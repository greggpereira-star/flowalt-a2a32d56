import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: "overdue_card" | "webhook_failure" | "goal_completed" | "level_up" | "custom";
  workspace_id: string;
  user_id?: string;
  email?: string;
  subject?: string;
  data: Record<string, any>;
}

// Structured logging helper
function createLogger(correlationId: string, workspaceId?: string) {
  const log = (level: string, message: string, context: Record<string, unknown> = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'send-email-notification',
      correlationId,
      workspaceId,
      message,
      ...context
    }
    if (level === 'error') {
      console.error(JSON.stringify(entry))
    } else if (level === 'warn') {
      console.warn(JSON.stringify(entry))
    } else {
      console.log(JSON.stringify(entry))
    }
  }

  return {
    info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
    debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
  }
}

const EMAIL_TEMPLATES = {
  overdue_card: (data: any) => ({
    subject: `⚠️ Card atrasado: ${data.card_title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ef4444;">⚠️ Alerta: Card Atrasado</h1>
        <p>O card <strong>"${data.card_title}"</strong> está atrasado.</p>
        <p><strong>Data de vencimento:</strong> ${data.due_date}</p>
        <p><strong>Dias de atraso:</strong> ${data.days_overdue}</p>
        ${data.assignee ? `<p><strong>Responsável:</strong> ${data.assignee}</p>` : ''}
        <a href="${data.card_url}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
          Ver Card
        </a>
      </div>
    `,
  }),
  webhook_failure: (data: any) => ({
    subject: `🚨 Webhook falhando: ${data.webhook_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ef4444;">🚨 Falha em Webhook</h1>
        <p>O webhook <strong>"${data.webhook_name}"</strong> está falhando repetidamente.</p>
        <p><strong>URL:</strong> ${data.webhook_url}</p>
        <p><strong>Falhas consecutivas:</strong> ${data.failure_count}</p>
        <p><strong>Último erro:</strong> ${data.last_error}</p>
        <p style="color: #6b7280; font-size: 14px;">
          Verifique se o endpoint está acessível e retornando status 2xx.
        </p>
      </div>
    `,
  }),
  goal_completed: (data: any) => ({
    subject: `🎉 Meta semanal concluída: ${data.goal_title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #22c55e;">🎉 Parabéns!</h1>
        <p>Você completou a meta <strong>"${data.goal_title}"</strong>!</p>
        <p><strong>Pontos ganhos:</strong> +${data.points} pts</p>
        ${data.badge ? `<p><strong>Badge desbloqueada:</strong> ${data.badge}</p>` : ''}
        <p style="color: #6b7280;">Continue assim! 💪</p>
      </div>
    `,
  }),
  level_up: (data: any) => ({
    subject: `🆙 Você subiu de nível: ${data.new_level_name}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #8b5cf6;">🆙 Level Up!</h1>
        <p>Parabéns! Você alcançou o nível <strong>${data.new_level}</strong>!</p>
        <p style="font-size: 48px; text-align: center;">${data.level_icon}</p>
        <p style="text-align: center; font-size: 24px; font-weight: bold; color: #8b5cf6;">
          ${data.new_level_name}
        </p>
        <p><strong>Pontuação total:</strong> ${data.total_score} pts</p>
        <p style="color: #6b7280;">Continue evoluindo! 🚀</p>
      </div>
    `,
  }),
  custom: (data: any) => ({
    subject: data.subject || "Notificação",
    html: data.html || `<p>${data.message}</p>`,
  }),
};

async function sendEmail(to: string, subject: string, html: string, logger: ReturnType<typeof createLogger>) {
  logger.debug('Sending email via Resend', { to, subject });
  
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "TaskFlow <notifications@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Resend API error', { status: response.status, error });
    throw new Error(`Resend API error: ${error}`);
  }

  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
  const startTime = Date.now();
  let logger = createLogger(correlationId);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, workspace_id, user_id, email, subject, data }: EmailRequest = await req.json();
    
    // Update logger with workspace context
    logger = createLogger(correlationId, workspace_id);
    logger.info('Processing email notification request', { type, userId: user_id, hasEmail: !!email });

    // Get recipient email
    let recipientEmail = email;
    if (!recipientEmail && user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user_id)
        .single();
      recipientEmail = profile?.email;
      logger.debug('Fetched email from profile', { userId: user_id, found: !!recipientEmail });
    }

    if (!recipientEmail) {
      logger.warn('No recipient email provided');
      return new Response(
        JSON.stringify({ error: "No recipient email provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Correlation-ID": correlationId } }
      );
    }

    // Get email content from template
    const template = EMAIL_TEMPLATES[type];
    if (!template) {
      logger.warn('Invalid email type', { type });
      return new Response(
        JSON.stringify({ error: "Invalid email type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Correlation-ID": correlationId } }
      );
    }

    const emailContent = template(data);
    const finalSubject = subject || emailContent.subject;

    // Send email via Resend
    const emailResponse = await sendEmail(recipientEmail, finalSubject, emailContent.html, logger);

    // Log the notification
    await supabase.from("email_notifications").insert({
      workspace_id,
      user_id,
      email: recipientEmail,
      subject: finalSubject,
      type,
      status: "sent",
      sent_at: new Date().toISOString(),
      metadata: { data, resend_id: emailResponse.id, correlation_id: correlationId },
    });

    const duration = Date.now() - startTime;
    logger.info('Email sent successfully', { 
      resendId: emailResponse.id, 
      recipient: recipientEmail,
      type,
      durationMs: duration 
    });

    return new Response(
      JSON.stringify({ success: true, id: emailResponse.id, correlation_id: correlationId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Correlation-ID": correlationId } }
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Error sending email', { error: error.message, durationMs: duration });

    return new Response(
      JSON.stringify({ error: error.message, correlation_id: correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Correlation-ID": correlationId } }
    );
  }
});
