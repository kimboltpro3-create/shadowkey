import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

Deno.serve(async (req: Request) => {

  try {
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");

    if (!cronSecret) {
      console.error("CRON_SECRET is not set");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid or missing cron secret" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: switchResult, error: switchError } = await supabase.rpc(
      "check_dead_man_switches"
    );

    if (switchError) {
      return new Response(
        JSON.stringify({ error: "Switch check failed", details: switchError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: expireResult, error: expireError } = await supabase.rpc(
      "expire_stale_personas"
    );

    if (expireError) {
      return new Response(
        JSON.stringify({ error: "Persona expiry failed", details: expireError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: staleRequests, error: staleError } = await supabase
      .from("reverse_disclosure_requests")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (staleError) {
      return new Response(
        JSON.stringify({ error: "Request expiry failed", details: staleError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        dead_man_switches: switchResult,
        personas_expired: expireResult,
        requests_expired: staleRequests?.length || 0,
        ran_at: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Dead man switch cron error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
