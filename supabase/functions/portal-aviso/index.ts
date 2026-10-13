// Aviso por e-mail de que ha pedidos de aprovacao esperando no PORTAL do cliente.
//
// Duas acoes, ambas de um membro logado do Flowalt:
//  - guardar: logo que a equipe gera o link do portal, o navegador entrega o token em claro; esta funcao confere o hash e
//    guarda uma copia cifrada (client_portal_access.token_enc). E o unico lugar onde o token em claro chega ao servidor.
//  - avisar: manda ao cliente um e-mail com o botao "Abrir portal" e a lista dos pedidos pendentes. Usa a copia cifrada,
//    entao a equipe nao precisa ter o link na mao. O token nunca e registrado em log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_FLOWALT") || Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://flowalt.com.br";
const MAX_AVISOS_POR_PEDIDO = 5;
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{40,128}$/;

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

// Mesma cifra do approval-send-email e do approval-reminders (AES-GCM, chave derivada da chave de servico).
async function chaveDeCifra(usos: KeyUsage[]): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode("flowalt-approval-token-v1") },
    base, { name: "AES-GCM", length: 256 }, false, usos,
  );
}

async function cifrar(token: string): Promise<string | null> {
  try {
    const chave = await chaveDeCifra(["encrypt"]);
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

async function decifrar(enc: string): Promise<string | null> {
  try {
    const chave = await chaveDeCifra(["decrypt"]);
    const bin = atob(enc);
    const bytes = new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
    const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, chave, bytes.slice(12));
    return new TextDecoder().decode(plano);
  } catch {
    return null;
  }
}

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
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await supabase.auth.getUser(jwt);
    const usuario = auth?.user;
    if (!usuario) return json({ error: "Sessão expirada. Entre novamente." }, 401);

    const body = await req.json().catch(() => ({}));
    const acao = body.action;
    const clientId = typeof body.client_id === "string" ? body.client_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(clientId) || (acao !== "guardar" && acao !== "avisar")) return json({ error: "Dados incompletos." }, 400);

    const { data: acesso } = await supabase
      .from("client_portal_access").select("id, workspace_id, client_id, token_hash, token_enc, revoked_at").eq("client_id", clientId).maybeSingle();
    if (!acesso) return json({ error: "Este cliente ainda não tem portal." }, 404);

    const { data: vinculo } = await supabase
      .from("workspace_members").select("user_id").eq("workspace_id", acesso.workspace_id).eq("user_id", usuario.id).maybeSingle();
    if (!vinculo) return json({ error: "Sem permissão para este cliente." }, 403);

    // ---- guardar a copia cifrada do link recem gerado ----
    if (acao === "guardar") {
      const token = typeof body.portal_token === "string" ? body.portal_token : "";
      if (!TOKEN_RE.test(token)) return json({ error: "Dados incompletos." }, 400);
      if ((await sha256Hex(token)) !== acesso.token_hash) return json({ error: "Este link foi substituído por um mais novo." }, 409);
      const enc = await cifrar(token);
      if (!enc) return json({ error: "Não foi possível guardar o aviso agora." }, 500);
      await supabase.from("client_portal_access").update({ token_enc: enc }).eq("id", acesso.id);
      return json({ ok: true });
    }

    // ---- avisar o cliente por e-mail ----
    const para = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(para) || para.length > 200) return json({ error: "Informe um e-mail válido." }, 400);
    if (acesso.revoked_at) return json({ error: "O portal deste cliente está desativado." }, 409);
    if (!acesso.token_enc) return json({ error: "Para avisar por e-mail, gere o link do portal de novo na aba Portal do cliente." }, 409);
    if (!RESEND_API_KEY) return json({ error: "O envio de e-mail não está configurado no servidor." }, 503);

    const token = await decifrar(acesso.token_enc);
    if (!token || (await sha256Hex(token)) !== acesso.token_hash) {
      return json({ error: "O link do portal mudou. Gere o link do portal de novo na aba Portal do cliente." }, 409);
    }

    // pedidos pendentes do cliente (os indicados, ou todos)
    const ids: string[] = Array.isArray(body.request_ids) ? body.request_ids.filter((x: unknown) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x as string)).slice(0, 20) : [];
    let consulta = supabase.from("approval_requests").select("id, title, expires_at, client_name")
      .eq("workspace_id", acesso.workspace_id).eq("client_id", acesso.client_id).eq("status", "pending").gt("expires_at", new Date().toISOString());
    if (ids.length) consulta = consulta.in("id", ids);
    const { data: pendentes } = await consulta.order("created_at", { ascending: true }).limit(20);
    if (!pendentes || pendentes.length === 0) return json({ error: "Não há pedidos abertos para este cliente." }, 409);

    // limite de avisos por pedido
    for (const p of pendentes) {
      const { count } = await supabase.from("approval_events").select("id", { count: "exact", head: true })
        .eq("request_id", p.id).eq("type", "sent").contains("payload", { channel: "portal_email" });
      if ((count ?? 0) >= MAX_AVISOS_POR_PEDIDO) return json({ error: "Limite de avisos de um dos pedidos atingido." }, 429);
    }

    const [{ data: ws }, { data: perfil }, { data: cli }] = await Promise.all([
      supabase.from("workspaces").select("name, settings").eq("id", acesso.workspace_id).maybeSingle(),
      supabase.from("profiles").select("full_name, email").eq("id", usuario.id).maybeSingle(),
      supabase.from("client_cards").select("name").eq("id", acesso.client_id).maybeSingle(),
    ]);
    const agencia = (ws?.name || "Equipe").replace(/[<>",]/g, "").slice(0, 60);
    const marca = marcaDoEmail(ws?.settings);
    const remetenteNome = (perfil?.full_name || "").replace(/[<>",]/g, "").slice(0, 60);
    const link = `${APP_URL}/portal/${token}`;
    const nome = pendentes[0].client_name || cli?.name || "";
    const saudacao = nome ? `Olá, ${esc(nome)}!` : "Olá!";
    const n = pendentes.length;
    const lista = pendentes.slice(0, 8).map((p) => `<li style="margin:0 0 6px">${esc(p.title)}</li>`).join("");
    const mais = n > 8 ? `<li style="margin:0;color:#666">e mais ${n - 8}</li>` : "";

    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;padding:24px;color:#111">
      <p style="font-size:13px;color:#666;margin:0 0 16px">${esc(agencia)}</p>
      <h2 style="margin:0 0 12px;font-size:20px">${saudacao}</h2>
      <p style="margin:0 0 12px;line-height:1.5">${remetenteNome ? esc(remetenteNome) + " deixou" : "Deixamos"} ${n === 1 ? "um conteúdo" : n + " conteúdos"} aguardando a sua aprovação no seu portal:</p>
      <ul style="margin:0 0 16px;padding:12px 14px 12px 32px;background:#f4f4f6;border-radius:10px;font-weight:600">${lista}${mais}</ul>
      <p style="margin:24px 0"><a href="${link}" style="display:inline-block;padding:14px 28px;background:${marca.fundo};color:${marca.texto};text-decoration:none;border-radius:10px;font-weight:600">Abrir meu portal</a></p>
      <p style="font-size:13px;color:#666;line-height:1.5;margin:0 0 6px">Você não precisa criar conta. No portal você vê o calendário, aprova ou pede ajustes. Guarde este e-mail: o endereço do portal é sempre o mesmo.</p>
      <p style="font-size:12px;color:#999;margin:16px 0 0;word-break:break-all">Se o botão não abrir, copie este endereço no navegador:<br>${link}</p>
    </div>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${agencia} (via Flowalt) <${enderecoRemetente()}>`,
        to: [para],
        reply_to: perfil?.email || undefined,
        subject: (n === 1 ? `Conteúdo aguardando sua aprovação: ${pendentes[0].title}` : `${n} conteúdos aguardando sua aprovação`).slice(0, 150),
        html,
      }),
    });
    if (!resp.ok) {
      console.error("resend error", resp.status, (await resp.text()).slice(0, 300));
      return json({ error: "Não foi possível enviar o e-mail agora. O pedido continua no portal." }, 502);
    }

    for (const p of pendentes) {
      await supabase.from("approval_requests").update({ client_email: para }).eq("id", p.id);
      await supabase.from("approval_events").insert({
        request_id: p.id, workspace_id: acesso.workspace_id, type: "sent", actor_kind: "member",
        actor_label: perfil?.email ?? usuario.email ?? null, payload: { channel: "portal_email", to: para },
      });
    }
    return json({ ok: true, to: para, pedidos: n });
  } catch (e) {
    console.error("portal-aviso error", e);
    return json({ error: "Não foi possível processar agora. Tente novamente." }, 500);
  }
});
