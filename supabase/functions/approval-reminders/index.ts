// Rotina da Sala de Aprovacao: expira pedidos vencidos e cobra o cliente.
//
// Roda por agendador (pg_cron + pg_net), de segunda a sexta, entre 9h e 18h de Sao Paulo.
//
// Regras (blueprint V3, secao 4.5):
//  - Lembretes escalonados em D+1, D+2 e D+4 depois do envio, no maximo 3 por pedido.
//  - So em dia util e em horario comercial.
//  - Para assim que o cliente responde (comentario, aprovacao ou pedido de ajustes).
//  - Se o pedido foi enviado por e-mail, o lembrete vai ao cliente com o MESMO link (o token fica guardado
//    cifrado, so quando o e-mail e enviado). Se foi so por WhatsApp ou link, o lembrete vai para quem enviou:
//    "o cliente ainda nao respondeu, reenvie".
//  - Pedido vencido vira "expirado" e a equipe e avisada.
//
// Protecao: exige a chave de servico no cabecalho Authorization. dry_run=1 so conta, nao envia nem grava.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_FLOWALT") || Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://flowalt.com.br";
const DIAS_DOS_LEMBRETES = [1, 2, 4];
const DIA_MS = 86_400_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function enderecoRemetente(): string {
  const env = Deno.env.toObject();
  const isEmail = (str?: string) => !!str && str.includes("@") && str.includes(".");
  const raw = isEmail(env["RESEND_FROM_EMAIL_FLOW"]) ? env["RESEND_FROM_EMAIL_FLOW"]
    : isEmail(env["RESEND_FROM_EMAIL"]) ? env["RESEND_FROM_EMAIL"] : "onboarding@resend.dev";
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim();
}

// Mesma cifra do approval-send-email (AES-GCM, chave derivada da chave de servico).
async function chaveDoToken(): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE_KEY), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode("flowalt-approval-token-v1") },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"],
  );
}
async function decifrar(valor: string): Promise<string | null> {
  try {
    const bin = Uint8Array.from(atob(valor), (c) => c.charCodeAt(0));
    const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bin.slice(0, 12) }, await chaveDoToken(), bin.slice(12));
    return new TextDecoder().decode(plano);
  } catch {
    return null;
  }
}

// Hora de Sao Paulo sem depender do fuso do servidor
function agoraEmSP() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", weekday: "short", hour: "numeric", hour12: false,
  }).formatToParts(new Date());
  const dia = partes.find((p) => p.type === "weekday")?.value ?? "";
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? 0) % 24;
  return { diaUtil: !["Sat", "Sun"].includes(dia), hora };
}

async function sendEmail(para: string, assunto: string, html: string, de: string, replyTo?: string) {
  if (!RESEND_API_KEY) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: de, to: [para], reply_to: replyTo, subject: assunto, html }),
  });
  if (!r.ok) console.error("resend error", r.status, (await r.text()).slice(0, 200));
  return r.ok;
}

Deno.serve(async (req) => {
  if ((req.headers.get("authorization") || "") !== `Bearer ${SERVICE_KEY}`) return json({ error: "Não autorizado." }, 401);

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const forcar = url.searchParams.get("force") === "1" && dryRun; // so o dry_run ignora o horario
  const sp = agoraEmSP();
  if (!forcar && (!sp.diaUtil || sp.hora < 9 || sp.hora >= 18)) return json({ skipped: "fora do dia útil ou do horário comercial" });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY);
  const agora = Date.now();
  const resumo = { expirados: 0, lembretes_cliente: 0, avisos_equipe: 0, ignorados_por_resposta: 0, erros: 0, dry_run: dryRun };

  const notificar = async (p: any, tipo: string, titulo: string, mensagem: string, destinos: Set<string>) => {
    if (dryRun || destinos.size === 0) return;
    const linhas = [...destinos].map((user_id) => ({
      user_id, workspace_id: p.workspace_id, type: tipo, title: titulo, message: mensagem,
      metadata: { card_id: p.card_id, approval_request_id: p.id, round: p.round },
    }));
    const { error } = await supabase.from("notifications").insert(linhas);
    if (error) { console.error("notificacao falhou", error.message); resumo.erros++; }
  };

  try {
    // 1) Expiracao
    const { data: vencidos } = await supabase
      .from("approval_requests").select("*").eq("status", "pending").lt("expires_at", new Date().toISOString());
    for (const p of vencidos ?? []) {
      resumo.expirados++;
      if (dryRun) continue;
      const { data: ok } = await supabase.from("approval_requests").update({ status: "expired" }).eq("id", p.id).eq("status", "pending").select("id").maybeSingle();
      if (!ok) continue;
      await supabase.from("approval_events").insert({ request_id: p.id, workspace_id: p.workspace_id, type: "expired", actor_kind: "system", payload: {} });
      await notificar(p, "approval_reminder", "Pedido de aprovação expirou", `O cliente não respondeu "${p.title}" (rodada ${p.round}) e o link expirou.`, new Set([p.requested_by]));
    }

    // 2) Lembretes
    const { data: abertos } = await supabase
      .from("approval_requests").select("*").eq("status", "pending").gt("expires_at", new Date().toISOString()).lt("reminder_count", DIAS_DOS_LEMBRETES.length);

    for (const p of abertos ?? []) {
      const n = p.reminder_count ?? 0;
      const devidoEm = new Date(p.created_at).getTime() + DIAS_DOS_LEMBRETES[n] * DIA_MS;
      if (agora < devidoEm) continue;
      // intervalo minimo entre lembretes (evita dois no mesmo dia se o agendador atrasar)
      if (p.reminded_at && agora - new Date(p.reminded_at).getTime() < 20 * 3600_000) continue;

      // cliente ja respondeu?
      const { count: respostas } = await supabase
        .from("approval_comments").select("id", { count: "exact", head: true }).eq("request_id", p.id).eq("author_kind", "client");
      if ((respostas ?? 0) > 0) { resumo.ignorados_por_resposta++; continue; }

      const ultimo = n + 1 === DIAS_DOS_LEMBRETES.length;
      let enviadoAoCliente = false;
      let motivoEquipe = "O cliente ainda não respondeu.";

      if (p.client_email && p.token_enc) {
        const token = await decifrar(p.token_enc);
        if (token && (await sha256Hex(token)) === p.token_hash) {
          if (dryRun) {
            enviadoAoCliente = true;
          } else {
            const [{ data: ws }, { data: quem }] = await Promise.all([
              supabase.from("workspaces").select("name").eq("id", p.workspace_id).maybeSingle(),
              supabase.from("profiles").select("email").eq("id", p.requested_by).maybeSingle(),
            ]);
            const agencia = (ws?.name || "Equipe").replace(/[<>",]/g, "").slice(0, 60);
            const link = `${APP_URL}/aprovacao/${token}`;
            const vale = new Date(p.expires_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
            const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;padding:24px;color:#111">
              <p style="font-size:13px;color:#666;margin:0 0 16px">${esc(agencia)}</p>
              <h2 style="margin:0 0 12px;font-size:20px">${p.client_name ? "Olá, " + esc(p.client_name) + "!" : "Olá!"}</h2>
              <p style="margin:0 0 12px;line-height:1.5">Este conteúdo ainda está aguardando a sua aprovação:</p>
              <p style="margin:0 0 16px;padding:12px 14px;background:#f4f4f6;border-radius:10px;font-weight:600">${esc(p.title)}</p>
              <p style="margin:24px 0"><a href="${link}" style="display:inline-block;padding:14px 28px;background:#3947df;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">Ver e aprovar</a></p>
              <p style="font-size:13px;color:#666;line-height:1.5">É rápido e não precisa de conta. O link vale até ${vale}.</p>
            </div>`;
            enviadoAoCliente = await sendEmail(
              p.client_email, `Lembrete: conteúdo aguardando sua aprovação (${p.title})`.slice(0, 150), html,
              `${agencia} (via Flowalt) <${enderecoRemetente()}>`, quem?.email || undefined,
            );
            if (!enviadoAoCliente) resumo.erros++;
          }
        } else {
          motivoEquipe = "O link original mudou, então não foi possível reenviar por e-mail.";
        }
      } else {
        motivoEquipe = p.client_email ? "O pedido foi enviado antes dos lembretes por e-mail." : "O pedido foi enviado sem e-mail do cliente.";
      }

      if (enviadoAoCliente) resumo.lembretes_cliente++;
      else resumo.avisos_equipe++;
      if (dryRun) continue;

      await supabase.from("approval_requests").update({ reminder_count: n + 1, reminded_at: new Date().toISOString() }).eq("id", p.id);
      await supabase.from("approval_events").insert({
        request_id: p.id, workspace_id: p.workspace_id, type: "reminder", actor_kind: "system",
        payload: { n: n + 1, channel: enviadoAoCliente ? "email" : "equipe", to: enviadoAoCliente ? p.client_email : null },
      });

      // A equipe sabe quando o cliente foi lembrado, e e cobrada quando o lembrete nao pode ir sozinho ou foi o ultimo.
      if (!enviadoAoCliente || ultimo) {
        const dias = Math.max(1, Math.floor((agora - new Date(p.created_at).getTime()) / DIA_MS));
        const msg = enviadoAoCliente
          ? `O cliente recebeu o último lembrete e ainda não respondeu "${p.title}" (rodada ${p.round}, enviado há ${dias} dias).`
          : `${motivoEquipe} "${p.title}" (rodada ${p.round}) está sem resposta há ${dias} ${dias === 1 ? "dia" : "dias"}. Vale reenviar o link ou ligar para o cliente.`;
        await notificar(p, "approval_reminder", "Cliente sem responder à aprovação", msg, new Set([p.requested_by]));
      }
    }

    return json({ ok: true, ...resumo });
  } catch (e) {
    console.error("approval-reminders error", e);
    return json({ error: "Falha na rotina.", ...resumo }, 500);
  }
});
