import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Timestamp, X-Nonce, X-Signature",
};

interface SDKAccessRequest {
  agentId: string;
  agentName: string;
  requestedFields: string[];
  purpose: string;
  category?: string;
  expiresIn?: number;
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function validateApiKey(supabase: any, authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header', apiKey: null };
  }

  const apiKey = authHeader.substring(7);
  const keyHash = await hashApiKey(apiKey);

  const { data, error } = await supabase.rpc('validate_api_key', {
    key_hash_input: keyHash
  });

  if (error || !data || data.length === 0) {
    return { valid: false, error: 'Invalid API key', apiKey: null };
  }

  const keyData = data[0];
  if (!keyData.is_valid) {
    return { valid: false, error: 'API key expired or revoked', apiKey: null };
  }

  await supabase.rpc('log_api_key_usage', { key_hash_input: keyHash });

  return {
    valid: true,
    userAddress: keyData.user_address,
    permissions: keyData.permissions,
    rateLimitTier: keyData.rate_limit_tier,
    apiKey: apiKey
  };
}

async function validateHMACSignature(
  req: Request,
  body: any,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  const timestamp = req.headers.get('X-Timestamp');
  const nonce = req.headers.get('X-Nonce');
  const signature = req.headers.get('X-Signature');

  if (!timestamp || !nonce || !signature) {
    return { valid: false, error: 'Missing signature headers' };
  }

  // Check timestamp is within 5 minutes
  const requestTime = parseInt(timestamp);
  const now = Date.now();
  if (Math.abs(now - requestTime) > 300000) {
    return { valid: false, error: 'Request timestamp expired' };
  }

  // Reconstruct the message
  const message = JSON.stringify({ ...body, timestamp: requestTime, nonce });
  const encoder = new TextEncoder();
  const data = encoder.encode(message + apiKey);

  // Generate expected signature
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  if (signature !== expectedSignature) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
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

    const authValidation = await validateApiKey(supabase, req.headers.get('Authorization'));
    if (!authValidation.valid) {
      return new Response(
        JSON.stringify({ error: authValidation.error }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SDKAccessRequest = await req.json();

    // Validate HMAC signature
    const signatureValidation = await validateHMACSignature(req, body, authValidation.apiKey!);
    if (!signatureValidation.valid) {
      return new Response(
        JSON.stringify({ error: signatureValidation.error }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.agentId || !body.agentName || !body.requestedFields || !body.purpose) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: agentId, agentName, requestedFields, purpose" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: vault } = await supabase
      .from("vaults")
      .select("id")
      .eq("owner_address", authValidation.userAddress)
      .maybeSingle();

    if (!vault) {
      return new Response(
        JSON.stringify({ error: "No vault found for this user" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (body.expiresIn || 300) * 1000);

    // Generate salt for potential encryption
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const salt = Array.from(saltBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { error: insertError } = await supabase
      .from("disclosure_logs")
      .insert({
        id: requestId,
        vault_id: vault.id,
        service_id: body.agentId,
        service_name: body.agentName,
        fields_requested: body.requestedFields,
        purpose: body.purpose,
        category: body.category || 'general',
        status: 'pending',
        salt: salt,
        expires_at: expiresAt.toISOString(),
        metadata: {
          sdk_request: true,
          user_agent: req.headers.get('User-Agent')
        }
      });

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to create access request", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        requestId,
        status: 'pending',
        expiresAt: expiresAt.toISOString(),
        message: 'Access request created. User will be notified to approve or deny.'
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("SDK access request error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
