import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DisclosureRequestPayload {
  vault_id: string;
  service_address: string;
  service_name: string;
  requested_fields: string[];
  justification: string;
  category: string;
  expires_in_days?: number;
}

const VALID_CATEGORIES = ["payment", "identity", "credentials", "health", "preferences"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const action = pathSegments[pathSegments.length - 1];

    if (req.method === "POST" && (action === "reverse-disclosure" || action === "request")) {
      const body: DisclosureRequestPayload = await req.json();

      if (!body.vault_id || !body.service_address || !body.category || !body.requested_fields?.length) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: vault_id, service_address, category, requested_fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!VALID_CATEGORIES.includes(body.category)) {
        return new Response(
          JSON.stringify({ error: "Invalid category", valid: VALID_CATEGORIES }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: vault } = await supabase
        .from("vaults")
        .select("id, owner_address")
        .eq("id", body.vault_id)
        .maybeSingle();

      if (!vault) {
        return new Response(
          JSON.stringify({ error: "Vault not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify the authenticated user owns this vault
      if (vault.owner_address.toLowerCase() !== user.id.toLowerCase()) {
        return new Response(
          JSON.stringify({ error: "Forbidden: You do not own this vault" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const expiresInDays = body.expires_in_days || 7;
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

      const { data: request, error: insertError } = await supabase
        .from("reverse_disclosure_requests")
        .insert({
          vault_id: body.vault_id,
          service_address: body.service_address.toLowerCase(),
          service_name: body.service_name || "",
          requested_fields: body.requested_fields,
          justification: body.justification || "",
          category: body.category,
          status: "pending",
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Failed to create request", details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          status: "pending",
          request_id: request.id,
          expires_at: request.expires_at,
          message: "Request submitted. The vault owner will review and approve/deny specific fields.",
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "GET") {
      const requestId = url.searchParams.get("request_id");

      if (!requestId) {
        return new Response(
          JSON.stringify({ error: "Missing request_id query parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: request, error: fetchError } = await supabase
        .from("reverse_disclosure_requests")
        .select("id, status, response_fields, responded_at, expires_at, created_at")
        .eq("id", requestId)
        .maybeSingle();

      if (fetchError || !request) {
        return new Response(
          JSON.stringify({ error: "Request not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isExpired = new Date(request.expires_at) <= new Date() && request.status === "pending";

      return new Response(
        JSON.stringify({
          request_id: request.id,
          status: isExpired ? "expired" : request.status,
          approved_fields: request.status === "approved" ? request.response_fields : [],
          responded_at: request.responded_at,
          expires_at: request.expires_at,
          created_at: request.created_at,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Reverse disclosure error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
