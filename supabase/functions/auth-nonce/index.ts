// ─── Challenge-Response Wallet Authentication ──────────────────────────────
//
// POST body: { wallet_address, message, signature }
//
// Verifies the signature, then mints a Supabase-compatible JWT so the
// client can call supabase.auth.setSession() and use 'authenticated' RLS.
// ─────────────────────────────────────────────────────────────────────────────

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ethers } from "npm:ethers@6.13.0";
import * as jose from "npm:jose@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { wallet_address, message, signature } = await req.json();

    if (!wallet_address || !message || !signature) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Verify timestamp freshness ────────────────────────────────────────────
    const tsMatch = message.match(/Timestamp:\s*(\d+)/);
    if (!tsMatch) {
      return new Response(JSON.stringify({ error: "Invalid message format" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messageMinute = parseInt(tsMatch[1], 10);
    const currentMinute = Math.floor(Date.now() / 60000);

    if (Math.abs(currentMinute - messageMinute) > 2) {
      return new Response(JSON.stringify({ error: "Signature expired. Please reconnect your wallet." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Verify signature ──────────────────────────────────────────────────────
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== wallet_address.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Signature verification failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedAddress = recoveredAddress.toLowerCase();

    // ── Mint a Supabase-compatible JWT ────────────────────────────────────────
    // sub = wallet address (used in RLS via auth.jwt()->>'sub')
    // role = 'authenticated' so authenticated RLS policies apply
    const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET");
    let accessToken: string | null = null;

    if (jwtSecret) {
      const secret = new TextEncoder().encode(jwtSecret);
      accessToken = await new jose.SignJWT({
        aud: "authenticated",
        role: "authenticated",
        sub: normalizedAddress,
        wallet_address: normalizedAddress,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("8h")
        .sign(secret);
    }

    return new Response(
      JSON.stringify({
        verified: true,
        wallet_address: normalizedAddress,
        access_token: accessToken,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
