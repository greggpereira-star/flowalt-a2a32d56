// Envia por e-mail ao cliente o link da Sala de Aprovacao.
//
// Quem chama e um membro logado do Flowalt: o token em claro so existe no navegador de quem criou o pedido
// (no banco ha apenas o hash), entao o navegador o entrega a esta funcao, que confere o hash, o workspace e o
// estado do pedido antes de enviar. O token nao e gravado nem registrado em log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_FLOWALT") || Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://flowalt.com.br";
const MAX_ENVIOS_POR_PEDIDO = 5;
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Guarda o token cifrado (AES-GCM, chave derivada da chave de servico) so quando o pedido e enviado por e-mail,
// para a rotina de lembretes reenviar o MESMO link. O banco sozinho nao revela o token.
async function cifrar(token: string): Promise<string | null> {
  try {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), "HKDF", false, ["deriveKey"]);
    const chave = await crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode("flowalt-approval-token-v1") },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt"],
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, new TextEncoder().encode(token)));
    const junto = new Uint8Array(iv.length + cifrado.length);
    junto.set(iv); junto.set(cifrado, iv.length);
    let bin = "";
    junto.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  } catch (e) {
    console.error("cifrar falhou", e);
    return null;
  }
}


// Cor da marca da agencia (workspaces.settings.brand_color) para o botao dos e-mails ao cliente, com texto claro ou
// escuro conforme a luminancia.
function marcaDoEmail(settings: any): { fundo: string; texto: string } {
  const hex = typeof settings?.brand_color === "string" && /^#[0-9a-fA-F]{6}$/.test(settings.brand_color) ? settings.brand_color : "#3947df";
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { fundo: hex, texto: lum > 0.55 ? "#111111" : "#ffffff" };
}

function enderecoRemetente(): string {
  const env = Deno.env.toObject();
  const isEmail = (str?: string) => !!str && str.includes("@") && str.includes(".");
  const raw = isEmail(env["RESEND_FROM_EMAIL_FLOW"]) ? env["RESEND_FROM_EMAIL_FLOW"]
    : isEmail(env["RESEND_FROM_EMAIL"]) ? env["RESEND_FROM_EMAIL"]
    : "onboarding@resend.dev";
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // 1) Quem chama: membro logado
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await supabase.auth.getUser(jwt);
    const usuario = auth?.user;
    if (!usuario) return json({ error: "Sessão expirada. Entre novamente." }, 401);

    const body = await req.json().catch(() => ({}));
    const requestId = typeof body.request_id === "string" ? body.request_id : "";
    const token = typeof body.token === "string" ? body.token : "";
    const para = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
    if (!requestId || !token) return json({ error: "Dados incompletos." }, 400);
    if (!EMAIL_RE.test(para) || para.length > 200) return json({ error: "Informe um e-mail válido." }, 400);

    // 2) Pedido: existe, e do workspace do usuario, o token confere e ainda esta aberto
    const { data: pedido } = await supabase.from("approval_requests").select("*").eq("id", requestId).maybeSingle();
    if (!pedido) return json({ error: "Pedido não encontrado." }, 404);

    const { data: vinculo } = await supabase
      .from("workspace_members").select("user_id").eq("workspace_id", pedido.workspace_id).eq("user_id", usuario.id).maybeSingle();
    if (!vinculo) return json({ error: "Sem permissão para este pedido." }, 403);

    if ((await sha256Hex(token)) !== pedido.token_hash) return json({ error: "Este link foi substituído por um mais novo. Gere o link de novo." }, 409);
    if (pedido.status !== "pending") return json({ error: "Este pedido não está mais aberto." }, 409);
    if (new Date(pedido.expires_at).getTime() < Date.now()) return json({ error: "Este pedido expirou." }, 409);

    // 3) Limite de envios por pedido
    const { count } = await supabase
      .from("approval_events").select("id", { count: "exact", head: true })
      .eq("request_id", pedido.id).eq("type", "sent").contains("payload", { channel: "email" });
    if ((count ?? 0) >= MAX_ENVIOS_POR_PEDIDO) return json({ error: "Limite de e-mails deste pedido atingido." }, 429);

    if (!RESEND_API_KEY) return json({ error: "O envio de e-mail não está configurado no servidor." }, 503);

    // 4) Monta e envia
    const [{ data: ws }, { data: perfil }, { data: card }] = await Promise.all([
      supabase.from("workspaces").select("name, settings").eq("id", pedido.workspace_id).maybeSingle(),
      supabase.from("profiles").select("full_name, email").eq("id", usuario.id).maybeSingle(),
      supabase.from("cards").select("title").eq("id", pedido.card_id).maybeSingle(),
    ]);
    const agencia = (ws?.name || "Equipe").replace(/[<>",]/g, "").slice(0, 60);
    const marca = marcaDoEmail(ws?.settings);
    const remetenteNome = (perfil?.full_name || "").replace(/[<>",]/g, "").slice(0, 60);
    const link = `${APP_URL}/aprovacao/${token}`;
    const valeAte = new Date(pedido.expires_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const saudacao = pedido.client_name ? `Olá, ${esc(pedido.client_name)}!` : "Olá!";

    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;padding:24px;color:#111">
      <p style="font-size:13px;color:#666;margin:0 0 16px">${esc(agencia)}</p>
      <h2 style="margin:0 0 12px;font-size:20px">${saudacao}</h2>
      <p style="margin:0 0 12px;line-height:1.5">${remetenteNome ? esc(remetenteNome) + " enviou" : "Enviamos"} um conteúdo para a sua aprovação:</p>
      <p style="margin:0 0 16px;padding:12px 14px;background:#f4f4f6;border-radius:10px;font-weight:600">${esc(pedido.title)}</p>
      ${pedido.message ? `<p style="margin:0 0 16px;line-height:1.5;white-space:pre-wrap">${esc(pedido.message)}</p>` : ""}
      <p style="margin:24px 0"><a href="${link}" style="display:inline-block;padding:14px 28px;background:${marca.fundo};color:${marca.texto};text-decoration:none;border-radius:10px;font-weight:600">Ver e aprovar</a></p>
      <p style="font-size:13px;color:#666;line-height:1.5;margin:0 0 6px">Você não precisa criar conta: é só abrir o link, ver a peça e aprovar ou pedir ajustes. O link vale até ${valeAte}.</p>
      <p style="font-size:12px;color:#999;margin:16px 0 0;word-break:break-all">Se o botão não abrir, copie este endereço no navegador:<br>${link}</p>
    </div>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${agencia} (via Flowalt) <${enderecoRemetente()}>`,
        to: [para],
        reply_to: perfil?.email || undefined,
        subject: `Aprovação de conteúdo: ${pedido.title}`.slice(0, 150),
        html,
      }),
    });
    if (!resp.ok) {
      console.error("resend error", resp.status, (await resp.text()).slice(0, 300));
      return json({ error: "Não foi possível enviar o e-mail agora. Copie o link e envie por outro canal." }, 502);
    }

    await supabase.from("approval_requests").update({ client_email: para, token_enc: await cifrar(token) }).eq("id", pedido.id);
    await supabase.from("approval_events").insert({
      request_id: pedido.id, workspace_id: pedido.workspace_id, type: "sent", actor_kind: "member",
      actor_label: perfil?.email ?? usuario.email ?? null, payload: { channel: "email", to: para, card_title: card?.title ?? null },
    });

    return json({ ok: true, to: para });
  } catch (e) {
    console.error("approval-send-email error", e);
    return json({ error: "Não foi possível processar agora. Tente novamente." }, 500);
  }
});
