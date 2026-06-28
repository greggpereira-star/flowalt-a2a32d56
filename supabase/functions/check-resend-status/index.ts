// Temporary diagnostic endpoint to check Resend domains and last sent emails
const RESEND_API_KEY = Deno.env.get("RESEND_FLOWALT") || Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const headers = { Authorization: `Bearer ${RESEND_API_KEY}` };

    const [domainsRes, apiKeysRes] = await Promise.all([
      fetch("https://api.resend.com/domains", { headers }),
      fetch("https://api.resend.com/api-keys", { headers }),
    ]);

    const domains = await domainsRes.json();
    const apiKeyStatus = apiKeysRes.status;

    return new Response(
      JSON.stringify({
        resend_api_key_present: !!RESEND_API_KEY,
        api_keys_endpoint_status: apiKeyStatus,
        domains,
        from_env: {
          RESEND_FROM_EMAIL_FLOW: Deno.env.get("RESEND_FROM_EMAIL_FLOW"),
          RESEND_FROM_EMAIL: Deno.env.get("RESEND_FROM_EMAIL"),
        },
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
