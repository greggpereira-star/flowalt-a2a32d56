import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_FLOWALT") || Deno.env.get("RESEND_API_KEY");

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

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Campos internos que nunca voltam para o cliente público
const INTERNAL_FIELDS = ["workspace_id", "created_by", "client_id", "contract_id", "onboarding_card_id"];
function sanitize(doc: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const k of Object.keys(doc)) {
    if (!INTERNAL_FIELDS.includes(k)) out[k] = doc[k];
  }
  return out;
}

const ONBOARDING_CHECKLIST = [
  "Enviar boas-vindas e apresentar o time responsável",
  "Coletar acessos e materiais de marca (logo, guidelines, senhas)",
  "Agendar reunião de kickoff",
  "Configurar ferramentas e calendário editorial",
  "Confirmar primeira entrega com o cliente",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { token, action } = body;
    if (!token) {
      return json({ error: "Token ausente." }, 400);
    }

    const { data: doc, error: fetchErr } = await supabase
      .from("altcontrol_proposal_docs")
      .select("*")
      .eq("public_token", token)
      .maybeSingle();

    if (fetchErr || !doc) {
      return json({ error: "Proposta não encontrada." }, 404);
    }

    const isExpired = doc.valid_until && new Date(doc.valid_until).getTime() < Date.now();
    if (isExpired && doc.status !== "expired" && doc.status !== "signed") {
      await supabase.from("altcontrol_proposal_docs").update({ status: "expired" }).eq("id", doc.id);
      doc.status = "expired";
    }

    const ip = clientIp(req);
    const userAgent = req.headers.get("user-agent") || "unknown";

    // ================= action: get / view =================
    if (!action || action === "get") {
      const updates: Record<string, any> = {
        last_viewed_at: new Date().toISOString(),
        view_count: (doc.view_count || 0) + 1,
      };
      if (!doc.first_viewed_at) updates.first_viewed_at = updates.last_viewed_at;
      if (doc.status === "sent") updates.status = "viewed";

      const { data: updated } = await supabase
        .from("altcontrol_proposal_docs")
        .update(updates)
        .eq("id", doc.id)
        .select("*")
        .single();

      await supabase.from("altcontrol_proposal_doc_events").insert({
        proposal_doc_id: doc.id, type: "viewed", ip, user_agent: userAgent,
      });

      return json({ proposal: sanitize(updated || { ...doc, ...updates }) });
    }

    if (isExpired) {
      return json({ error: "Esta proposta expirou." }, 410);
    }
    if (doc.status === "signed" && action !== "get") {
      return json({ error: "Esta proposta já foi assinada." }, 409);
    }

    // ================= action: select_option =================
    if (action === "select_option") {
      const { optionId } = body;
      const { data: updated, error } = await supabase
        .from("altcontrol_proposal_docs")
        .update({ selected_option_id: optionId })
        .eq("id", doc.id)
        .select("*")
        .single();
      if (error) throw error;

      await supabase.from("altcontrol_proposal_doc_events").insert({
        proposal_doc_id: doc.id, type: "option_selected", ip, user_agent: userAgent, metadata: { optionId },
      });

      return json({ proposal: sanitize(updated) });
    }

    // ================= action: sign =================
    if (action === "sign") {
      const { signerName, signerDocument, signerEmail, signatureImage, optionId } = body;
      if (!signerName || !signatureImage) {
        return json({ error: "Nome e assinatura são obrigatórios." }, 400);
      }

      const selectedOptionId = optionId || doc.selected_option_id;
      const documentModel = doc.document || {};
      const hash = await sha256Hex(JSON.stringify(documentModel));
      const signedAt = new Date().toISOString();

      const signUpdates = {
        status: "signed",
        signed_at: signedAt,
        signer_name: signerName,
        signer_document: signerDocument || null,
        signer_email: signerEmail || null,
        signature_image: signatureImage,
        signature_ip: ip,
        signature_user_agent: userAgent,
        document_hash: hash,
        selected_option_id: selectedOptionId,
      };

      const { data: signedDoc, error: signErr } = await supabase
        .from("altcontrol_proposal_docs")
        .update(signUpdates)
        .eq("id", doc.id)
        .select("*")
        .single();
      if (signErr) throw signErr;

      await supabase.from("altcontrol_proposal_doc_events").insert({
        proposal_doc_id: doc.id, type: "signed", ip, user_agent: userAgent,
        metadata: { signerName, selectedOptionId },
      });

      // ============ Integrações (best-effort; não bloqueiam a assinatura) ============
      let integrationError: string | null = null;
      try {
        await runApprovalIntegrations(supabase, doc, documentModel, selectedOptionId);
      } catch (e: any) {
        console.error("Integration error", e);
        integrationError = e?.message || String(e);
      }

      // Confirmação por email ao cliente
      const publicUrl = `${req.headers.get("origin") || "https://app.flowalt.com.br"}/p/${token}`;
      if (signerEmail || doc.client_email) {
        await sendEmail(
          signerEmail || doc.client_email,
          `Proposta assinada — ${doc.client_name}`,
          `<div style="font-family:sans-serif;max-width:560px;margin:auto">
            <h2>Proposta assinada com sucesso!</h2>
            <p>Olá ${signerName}, confirmamos a assinatura da proposta <b>${doc.title || doc.client_name}</b>.</p>
            <p>Você pode acessar e baixar o PDF assinado a qualquer momento pelo link abaixo:</p>
            <p><a href="${publicUrl}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:6px">Ver proposta assinada</a></p>
          </div>`
        );
      }

      // Aviso ao vendedor
      const { data: creatorProfile } = await supabase
        .from("profiles").select("email, full_name").eq("id", doc.created_by).maybeSingle();
      if (creatorProfile?.email) {
        await sendEmail(
          creatorProfile.email,
          `✅ ${doc.client_name} assinou a proposta`,
          `<div style="font-family:sans-serif;max-width:560px;margin:auto">
            <h2>Proposta assinada! 🎉</h2>
            <p><b>${doc.client_name}</b> assinou a proposta em ${new Date(signedAt).toLocaleString("pt-BR")}.</p>
            <p>O cliente já foi cadastrado e o card de onboarding foi criado automaticamente.</p>
          </div>`
        );
      }

      return json({ proposal: sanitize(signedDoc), integrationError });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e: any) {
    console.error("public-proposal error", e);
    return json({ error: e?.message || "Erro interno." }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function runApprovalIntegrations(
  supabase: ReturnType<typeof createClient>,
  doc: Record<string, any>,
  documentModel: Record<string, any>,
  selectedOptionId: string | null
) {
  const workspaceId = doc.workspace_id as string;
  const createdBy = doc.created_by as string;

  // 1) Cliente — encontra ou cria
  let clientId: string | null = doc.client_id || null;
  if (!clientId) {
    const { data: existing } = await supabase
      .from("client_cards")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("name", doc.client_name)
      .maybeSingle();

    if (existing?.id) {
      clientId = existing.id as string;
    } else {
      const { data: created, error } = await supabase
        .from("client_cards")
        .insert({ workspace_id: workspaceId, name: doc.client_name, status: "active", created_by: createdBy })
        .select("id")
        .single();
      if (error) throw error;
      clientId = created.id as string;
    }
  }

  // 2) Espaço + pasta de onboarding — encontra ou cria
  let { data: space } = await supabase
    .from("spaces")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("name", "Onboarding de Clientes")
    .maybeSingle();

  let spaceId = space?.id as string | undefined;
  if (!spaceId) {
    const { data: createdSpace, error } = await supabase
      .from("spaces")
      .insert({
        workspace_id: workspaceId, name: "Onboarding de Clientes", type: "custom",
        icon: "user-plus", color: "#22c55e",
      })
      .select("id")
      .single();
    if (error) throw error;
    spaceId = createdSpace.id as string;
  }

  let { data: folder } = await supabase
    .from("folders")
    .select("id")
    .eq("space_id", spaceId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  let folderId = folder?.id as string | undefined;
  if (!folderId) {
    const { data: createdFolder, error } = await supabase
      .from("folders")
      .insert({ workspace_id: workspaceId, space_id: spaceId, name: "Novos Clientes", icon: "list", color: "#22c55e" })
      .select("id")
      .single();
    if (error) throw error;
    folderId = createdFolder.id as string;
  }

  // 3) Card de onboarding
  const optionTitle = (documentModel.options || []).find((o: any) => o.id === selectedOptionId)?.title
    || (documentModel.options || [])[0]?.title || "Proposta";

  const { data: card, error: cardErr } = await supabase
    .from("cards")
    .insert({
      workspace_id: workspaceId,
      space_id: spaceId,
      title: `Onboarding — ${doc.client_name}`,
      description: `Proposta "${optionTitle}" aprovada e assinada por ${doc.signer_name || doc.client_name}.`,
      status: "backlog",
      urgency: "medium",
      client_id: clientId,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (cardErr) throw cardErr;
  const cardId = card.id as string;

  await supabase.from("card_spaces").insert({ card_id: cardId, space_id: spaceId });
  await supabase.from("card_folders").insert({ card_id: cardId, folder_id: folderId });
  await supabase.from("card_members").insert({ card_id: cardId, user_id: createdBy, is_owner: false });
  await supabase.from("checklists").insert(
    ONBOARDING_CHECKLIST.map((title, i) => ({ card_id: cardId, title, sort_order: i }))
  );

  // 4) Contrato + MRR
  const selectedOption = (documentModel.options || []).find((o: any) => o.id === selectedOptionId);
  const monthlyValue = selectedOption?.priceKind === "monthly" ? (selectedOption.priceValue || 0) : 0;

  const { data: contract, error: contractErr } = await supabase
    .from("altcontrol_contracts")
    .insert({
      workspace_id: workspaceId,
      client_id: clientId,
      client_name: doc.client_name,
      contracted_hours: 0,
      monthly_value: monthlyValue,
      start_date: new Date().toISOString().slice(0, 10),
      status: "active",
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (contractErr) throw contractErr;

  await supabase
    .from("altcontrol_proposal_docs")
    .update({ client_id: clientId, onboarding_card_id: cardId, contract_id: contract.id })
    .eq("id", doc.id);
}
