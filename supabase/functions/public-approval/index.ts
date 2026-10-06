// Sala de Aprovacao: funcao publica (sem login) para o cliente ver a peca, comentar, aprovar ou pedir ajustes.
//
// Seguranca (blueprint V3, secao 4.1):
//  - o token tem 32 bytes aleatorios e so o SHA-256 dele existe no banco;
//  - token invalido, expirado ou cancelado devolve a MESMA resposta (nao revela se o link existiu);
//  - esta funcao nunca le `comments` (comentarios internos do card): so approval_comments;
//  - arquivos saem por URL assinada de curta duracao, e so de caminhos que pertencem ao card do pedido;
//  - limite de tentativas por IP e trilha de auditoria (IP, agente) em approval_events.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_FLOWALT") || Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://flowalt.com.br";
const SIGNED_URL_TTL = 3600;
const NAO_DISPONIVEL = "Este link não está mais disponível. Peça um novo link a quem enviou.";

// ---- utilidades -----------------------------------------------------------------------------------------------
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getSender() {
  const env = Deno.env.toObject();
  const isEmail = (str?: string) => !!str && str.includes("@") && str.includes(".");
  const raw = isEmail(env["RESEND_FROM_EMAIL_FLOW"]) ? env["RESEND_FROM_EMAIL_FLOW"]
    : isEmail(env["RESEND_FROM_EMAIL"]) ? env["RESEND_FROM_EMAIL"]
    : "onboarding@resend.dev";
  return raw.includes("<") ? raw : `Flowalt <${raw}>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return;
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: getSender(), to: [to], subject, html }),
    });
    if (!resp.ok) console.error("resend error", await resp.text());
  } catch (e) {
    console.error("sendEmail failed", e);
  }
}

// Limite simples por IP (memoria da instancia): protege contra tentativa de adivinhar token.
const tentativas = new Map<string, { n: number; desde: number }>();
const JANELA_MS = 10 * 60 * 1000;
const LIMITE = 90;
function estourouLimite(ip: string): boolean {
  const agora = Date.now();
  const t = tentativas.get(ip);
  if (!t || agora - t.desde > JANELA_MS) {
    tentativas.set(ip, { n: 1, desde: agora });
    return false;
  }
  t.n += 1;
  return t.n > LIMITE;
}

const TOKEN_RE = /^[A-Za-z0-9_-]{40,128}$/;

// A URL assinada sai com o endereco INTERNO do servidor (http://kong:8000), que o navegador do cliente nao alcanca.
// Troca pelo endereco publico (SUPABASE_PUBLIC_URL) mantendo o caminho e o token.
function urlPublica(url: string | null | undefined): string | null {
  if (!url) return null;
  const interna = Deno.env.get("SUPABASE_URL");
  const publica = Deno.env.get("SUPABASE_PUBLIC_URL");
  if (interna && publica && url.startsWith(interna)) return publica.replace(/\/$/, "") + url.slice(interna.length);
  return url;
}

// ---- notificacao da equipe ------------------------------------------------------------------------------------
async function notificarEquipe(
  supabase: any,
  req: any,
  card: any,
  tipo: "approval_approved" | "approval_changes_requested" | "approval_comment",
  titulo: string,
  mensagem: string,
) {
  const destinos = new Set<string>();
  if (req.requested_by) destinos.add(req.requested_by);
  if (card?.owner_id) destinos.add(card.owner_id);
  const { data: membros } = await supabase.from("card_members").select("user_id").eq("card_id", req.card_id);
  (membros ?? []).forEach((m: any) => m.user_id && destinos.add(m.user_id));

  const linhas = [...destinos].map((user_id) => ({
    user_id,
    workspace_id: req.workspace_id,
    type: tipo,
    title: titulo,
    message: mensagem,
    metadata: { card_id: req.card_id, approval_request_id: req.id, round: req.round },
  }));
  if (linhas.length) {
    const { error } = await supabase.from("notifications").insert(linhas);
    if (error) console.error("notificacao falhou", error.message);
  }

  // E-mail so para quem enviou o pedido (os demais veem no Flowalt)
  if (tipo !== "approval_comment" && req.requested_by) {
    const { data: perfil } = await supabase.from("profiles").select("email, full_name").eq("id", req.requested_by).maybeSingle();
    if (perfil?.email) {
      const link = `${APP_URL}/space/${req.workspace_id}?card=${req.card_id}`;
      await sendEmail(
        perfil.email,
        titulo,
        `<div style="font-family:sans-serif;max-width:560px;margin:auto">
          <h2>${esc(titulo)}</h2>
          <p>${esc(mensagem)}</p>
          <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#3947df;color:#fff;text-decoration:none;border-radius:8px">Abrir o card</a></p>
        </div>`,
      );
    }
  }
}

async function registrarEvento(
  supabase: any,
  req: any,
  type: string,
  actorLabel: string | null,
  payload: Record<string, unknown>,
  ip: string,
  ua: string,
) {
  await supabase.from("approval_events").insert({
    request_id: req.id,
    workspace_id: req.workspace_id,
    type,
    actor_kind: "client",
    actor_label: actorLabel,
    payload,
    ip,
    ua,
  });
}

// Move o card (sem os gates do front: quem decidiu foi o cliente) e deixa rastro no historico de etapas.
async function moverCard(supabase: any, card: any, paraEtapa: string, status: string, motivo: string) {
  const { error } = await supabase
    .from("cards")
    .update({ current_stage: paraEtapa, stage_entered_at: new Date().toISOString(), status })
    .eq("id", card.id);
  if (error) {
    console.error("mover card falhou", error.message);
    return false;
  }
  if (card.workflow_id) {
    await supabase.from("card_stage_history").insert({
      card_id: card.id,
      workflow_id: card.workflow_id,
      from_stage: card.current_stage,
      to_stage: paraEtapa,
      transition_type: "normal",
      reason: motivo,
    });
  }
  return true;
}

// ---- servico ---------------------------------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const ip = clientIp(req);
  const ua = (req.headers.get("user-agent") || "unknown").slice(0, 300);
  if (estourouLimite(ip)) return json({ error: "Muitas tentativas. Aguarde alguns minutos." }, 429);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "get";

    // Dois modos de entrada: o link do pedido (token) ou o portal do cliente (portal_token + request_id). No portal, o
    // pedido so vale se pertencer a um card do mesmo cliente do link, no mesmo workspace.
    let pedido: any = null;
    if (typeof body.portal_token === "string") {
      const portalToken = body.portal_token;
      const requestId = typeof body.request_id === "string" ? body.request_id : "";
      if (!TOKEN_RE.test(portalToken) || !/^[0-9a-f-]{36}$/i.test(requestId)) return json({ error: NAO_DISPONIVEL }, 404);
      const { data: acesso } = await supabase
        .from("client_portal_access").select("client_id, workspace_id").eq("token_hash", await sha256Hex(portalToken)).is("revoked_at", null).maybeSingle();
      if (!acesso) return json({ error: NAO_DISPONIVEL }, 404);
      const { data: candidato } = await supabase
        .from("approval_requests").select("*").eq("id", requestId).eq("workspace_id", acesso.workspace_id).maybeSingle();
      if (!candidato) return json({ error: NAO_DISPONIVEL }, 404);
      const { data: cardDoPedido } = await supabase.from("cards").select("client_id").eq("id", candidato.card_id).maybeSingle();
      if (!cardDoPedido || cardDoPedido.client_id !== acesso.client_id) return json({ error: NAO_DISPONIVEL }, 404);
      pedido = candidato;
    } else {
      const token = typeof body.token === "string" ? body.token : "";
      if (!TOKEN_RE.test(token)) return json({ error: NAO_DISPONIVEL }, 404);
      const hash = await sha256Hex(token);
      const { data: porLink } = await supabase.from("approval_requests").select("*").eq("token_hash", hash).maybeSingle();
      pedido = porLink;
    }
    if (!pedido || pedido.status === "canceled") return json({ error: NAO_DISPONIVEL }, 404);

    // Expiracao: so vale para pedidos ainda abertos; decididos continuam consultaveis (somente leitura).
    if (pedido.status === "pending" && new Date(pedido.expires_at).getTime() < Date.now()) {
      await supabase.from("approval_requests").update({ status: "expired" }).eq("id", pedido.id);
      await supabase.from("approval_events").insert({
        request_id: pedido.id, workspace_id: pedido.workspace_id, type: "expired", actor_kind: "system", payload: {},
      });
      return json({ error: NAO_DISPONIVEL }, 404);
    }
    if (pedido.status === "expired") return json({ error: NAO_DISPONIVEL }, 404);

    const { data: card } = await supabase
      .from("cards")
      .select("id, title, owner_id, current_stage, workflow_id, workspace_id")
      .eq("id", pedido.card_id)
      .maybeSingle();

    // ===================== get =====================
    if (action === "get") {
      // Conta a visita no maximo uma vez a cada 10 minutos por pedido, para o numero nao inflar com atualizacoes de pagina.
      const agora = new Date();
      const ultima = pedido.last_viewed_at ? new Date(pedido.last_viewed_at).getTime() : 0;
      if (pedido.status === "pending" && agora.getTime() - ultima > 10 * 60 * 1000) {
        await supabase.from("approval_requests").update({
          view_count: (pedido.view_count || 0) + 1,
          last_viewed_at: agora.toISOString(),
          first_viewed_at: pedido.first_viewed_at ?? agora.toISOString(),
        }).eq("id", pedido.id);
        await registrarEvento(supabase, pedido, "viewed", null, {}, ip, ua);
      }

      const { data: itens } = await supabase
        .from("approval_items").select("*").eq("request_id", pedido.id).order("sort_order");

      const pecas = [];
      for (const it of itens ?? []) {
        const base = { id: it.id, kind: it.kind, caption: it.caption, file_name: it.file_name, body: it.body, url: null as string | null };
        if (it.bucket && it.storage_path) {
          // So assina caminhos do proprio card: impede expor outro arquivo do bucket por um item mal montado.
          if (it.storage_path.startsWith(`${pedido.card_id}/`)) {
            const { data: assinada } = await supabase.storage.from(it.bucket).createSignedUrl(it.storage_path, SIGNED_URL_TTL);
            base.url = urlPublica(assinada?.signedUrl);
          }
        }
        pecas.push(base);
      }

      const { data: conversa } = await supabase
        .from("approval_comments").select("id, author_kind, author_name, body, created_at")
        .eq("request_id", pedido.id).order("created_at");

      const { data: ws } = await supabase.from("workspaces").select("name, logo_url, settings").eq("id", pedido.workspace_id).maybeSingle();

      return json({
        approval: {
          status: pedido.status,
          round: pedido.round,
          title: pedido.title,
          message: pedido.message,
          client_name: pedido.client_name,
          expires_at: pedido.expires_at,
          decided_at: pedido.decided_at,
          decided_by_name: pedido.decided_by_name,
          workspace_name: ws?.name ?? null,
          workspace_logo: ws?.logo_url ?? null,
          brand_color: /^#[0-9a-fA-F]{6}$/.test(ws?.settings?.brand_color ?? "") ? ws.settings.brand_color : null,
          items: pecas,
          comments: conversa ?? [],
        },
      });
    }

    // As demais acoes so valem enquanto o pedido esta aberto.
    if (pedido.status !== "pending") {
      return json({ error: "Este pedido já foi respondido." }, 409);
    }

    const nome = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";

    // ===================== comment =====================
    if (action === "comment") {
      const texto = typeof body.message === "string" ? body.message.trim() : "";
      if (nome.length < 2) return json({ error: "Informe seu nome." }, 400);
      if (texto.length < 1 || texto.length > 2000) return json({ error: "Escreva uma mensagem de até 2000 caracteres." }, 400);

      await supabase.from("approval_comments").insert({
        request_id: pedido.id, workspace_id: pedido.workspace_id, author_kind: "client", author_name: nome, body: texto,
      });
      await registrarEvento(supabase, pedido, "commented", nome, { length: texto.length }, ip, ua);
      await notificarEquipe(supabase, pedido, card, "approval_comment", "Novo comentário do cliente", `${nome} comentou em "${pedido.title}".`);
      return json({ ok: true });
    }

    // ===================== approve =====================
    if (action === "approve") {
      if (nome.length < 2) return json({ error: "Informe seu nome para registrar a aprovação." }, 400);
      if (body.consent !== true) return json({ error: "Confirme a aprovação para continuar." }, 400);

      const decididoEm = new Date().toISOString();
      const { data: itens } = await supabase.from("approval_items").select("id, kind, storage_path, body, sort_order").eq("request_id", pedido.id).order("sort_order");
      const certificado = await sha256Hex(JSON.stringify({ id: pedido.id, round: pedido.round, itens, nome, email, decididoEm }));

      const { data: atualizado, error } = await supabase
        .from("approval_requests")
        .update({
          status: "approved", decided_at: decididoEm, decided_by_name: nome, decided_by_email: email || null,
          decision_ip: ip, decision_ua: ua, certificate_hash: certificado,
        })
        .eq("id", pedido.id).eq("status", "pending")
        .select("id").maybeSingle();
      if (error) throw error;
      if (!atualizado) return json({ error: "Este pedido já foi respondido." }, 409);

      await registrarEvento(supabase, pedido, "approved", nome, { certificate_hash: certificado }, ip, ua);

      // Aprovar leva o card a Concluido, mas so quando ele esta na etapa Aprovacao (nao salta etapas por conta propria).
      let moveu = false;
      if (card?.current_stage === "aprovacao") {
        moveu = await moverCard(supabase, card, "concluido", "delivered", `Aprovado pelo cliente (${nome}), rodada ${pedido.round}`);
      }

      await notificarEquipe(
        supabase, pedido, card, "approval_approved",
        "Cliente aprovou a entrega",
        `${nome} aprovou "${pedido.title}" (rodada ${pedido.round})${moveu ? ". O card foi para Concluído." : "."}`,
      );
      return json({ ok: true, decided_at: decididoEm });
    }

    // ===================== request_changes =====================
    if (action === "request_changes") {
      const texto = typeof body.message === "string" ? body.message.trim() : "";
      if (nome.length < 2) return json({ error: "Informe seu nome." }, 400);
      if (texto.length < 3 || texto.length > 2000) return json({ error: "Descreva o ajuste que você precisa (até 2000 caracteres)." }, 400);

      const decididoEm = new Date().toISOString();
      const { data: atualizado, error } = await supabase
        .from("approval_requests")
        .update({
          status: "changes_requested", decided_at: decididoEm, decided_by_name: nome, decided_by_email: email || null,
          decision_ip: ip, decision_ua: ua,
        })
        .eq("id", pedido.id).eq("status", "pending")
        .select("id").maybeSingle();
      if (error) throw error;
      if (!atualizado) return json({ error: "Este pedido já foi respondido." }, 409);

      await supabase.from("approval_comments").insert({
        request_id: pedido.id, workspace_id: pedido.workspace_id, author_kind: "client", author_name: nome, body: texto,
      });
      await registrarEvento(supabase, pedido, "changes_requested", nome, { length: texto.length }, ip, ua);

      // Ajuste volta o card para Em Producao (so se ele ainda nao foi concluido).
      let moveu = false;
      if (card && ["aprovacao", "revisao"].includes(card.current_stage)) {
        moveu = await moverCard(supabase, card, "em_producao", "in_progress", `Ajuste pedido pelo cliente (${nome}), rodada ${pedido.round}`);
      }

      await notificarEquipe(
        supabase, pedido, card, "approval_changes_requested",
        "Cliente pediu ajustes",
        `${nome} pediu ajustes em "${pedido.title}" (rodada ${pedido.round})${moveu ? ". O card voltou para Em Produção." : "."}`,
      );
      return json({ ok: true, decided_at: decididoEm });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    console.error("public-approval error", e);
    return json({ error: "Não foi possível processar agora. Tente novamente em instantes." }, 500);
  }
});
