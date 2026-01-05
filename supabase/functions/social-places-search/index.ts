import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlaceResult {
  id: string;
  name: string;
  location?: {
    city?: string;
    country?: string;
    state?: string;
    street?: string;
    zip?: string;
    latitude?: number;
    longitude?: number;
  };
}

// Simple decryption for tokens (must match the encryption used in other social functions)
function decryptToken(encrypted: string): string {
  const key = Deno.env.get("TOKEN_ENCRYPTION_KEY") || "default-key-change-me";
  const decoded = atob(encrypted);
  const bytes = new Uint8Array([...decoded].map((c) => c.charCodeAt(0)));
  const keyBytes = new TextEncoder().encode(key);
  const decrypted = bytes.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, workspaceId } = await req.json();

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ places: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[social-places-search] Searching for: "${query}"`);

    // Get Supabase client to fetch access token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get a valid Facebook access token from any connected platform
    const { data: platforms, error: platformError } = await supabase
      .from("social_platforms")
      .select("access_token_encrypted, asset_token_encrypted, platform")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .in("platform", ["facebook", "instagram"])
      .limit(1);

    if (platformError) {
      console.error("[social-places-search] DB error reading social_platforms:", platformError);
      return new Response(
        JSON.stringify({ places: [], error: "DB_ERROR", errorCode: "DB_ERROR" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!platforms || platforms.length === 0) {
      console.log("[social-places-search] No connected Facebook/Instagram accounts found");
      return new Response(
        JSON.stringify({ places: [], error: "NO_SOCIAL_ACCOUNTS", errorCode: "NO_SOCIAL_ACCOUNTS" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenEncrypted = platforms[0].asset_token_encrypted || platforms[0].access_token_encrypted;

    if (!tokenEncrypted) {
      console.log("[social-places-search] Token not found for connected platform");
      return new Response(
        JSON.stringify({ places: [], error: "TOKEN_MISSING", errorCode: "TOKEN_MISSING" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const accessToken = decryptToken(tokenEncrypted);
    const searchUrl = new URL("https://graph.facebook.com/v18.0/pages/search");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("fields", "id,name,location,link");
    searchUrl.searchParams.set("access_token", accessToken);
    searchUrl.searchParams.set("limit", "10");

    console.log(`[social-places-search] Calling Facebook API...`);

    const fbResponse = await fetch(searchUrl.toString());
    const fbData = await fbResponse.json();

    if (fbData.error) {
      console.error("[social-places-search] Facebook API error:", fbData.error);
      return new Response(
        JSON.stringify({ places: [], error: "FB_API_ERROR", errorCode: "FB_API_ERROR", details: fbData.error.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform results
    const places: PlaceResult[] = (fbData.data || []).map((page: any) => ({
      id: page.id,
      name: page.name,
      location: page.location || null,
    }));

    console.log(`[social-places-search] Found ${places.length} places`);

    return new Response(
      JSON.stringify({ places }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("[social-places-search] Error:", errorMessage);
    return new Response(
      JSON.stringify({ places: [], error: "NETWORK_ERROR", errorCode: "NETWORK_ERROR", details: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
