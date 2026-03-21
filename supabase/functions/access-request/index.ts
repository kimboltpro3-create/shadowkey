import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AccessRequestPayload {
  vault_id: string;
  agent_address: string;
  category: string;
  service_address: string;
  amount?: number;
}

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

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: AccessRequestPayload = await req.json();

    if (!body.vault_id || !body.agent_address || !body.category || !body.service_address) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: vault_id, agent_address, category, service_address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.amount !== undefined && (typeof body.amount !== 'number' || isNaN(body.amount) || body.amount < 0)) {
      return new Response(
        JSON.stringify({ error: "Amount must be a valid non-negative number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: vault, error: vaultError } = await supabase
      .from("vaults")
      .select("owner_address")
      .eq("id", body.vault_id)
      .maybeSingle();

    if (vaultError || !vault) {
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

    const { data: validationResult, error: validationError } = await supabase.rpc(
      "validate_access_request",
      {
        p_vault_id: body.vault_id,
        p_agent_address: body.agent_address.toLowerCase(),
        p_category: body.category,
        p_service_address: body.service_address.toLowerCase(),
        p_amount: body.amount || 0,
      }
    );

    if (validationError) {
      console.error("Validation error:", validationError);
      return new Response(
        JSON.stringify({ error: "Validation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!validationResult.allowed) {
      return new Response(
        JSON.stringify({
          access: "denied",
          reason: validationResult.reason,
          details: validationResult.details || null,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: persona } = await supabase
      .from("ephemeral_personas")
      .select("persona_alias, persona_address, mapped_fields")
      .eq("vault_id", body.vault_id)
      .eq("active", true)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    return new Response(
      JSON.stringify({
        access: "granted",
        policy_id: validationResult.policy_id,
        reveal_fields: validationResult.reveal_fields,
        hidden_fields: validationResult.hidden_fields,
        spend_limit: validationResult.spend_limit,
        total_limit: validationResult.total_limit,
        total_spent: validationResult.total_spent,
        expires_at: validationResult.expires_at,
        persona: persona
          ? {
              alias: persona.persona_alias,
              address: persona.persona_address,
              mapped_fields: persona.mapped_fields,
            }
          : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Access request error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
