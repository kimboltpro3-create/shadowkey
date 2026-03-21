import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ─── Simulate Receipt Edge Function ──────────────────────────────────────────
//
// Generates a server-side receipt for agent demo scenarios.
// Returns a unique server-generated reference ID + timestamp so the receipt
// is provably NOT hardcoded frontend mock data.
//
// POST /functions/v1/simulate-receipt
// Body: { scenario: "shopping" | "travel" | "health", fields: Record<string, string> }
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Apikey, X-Client-Info",
};

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { scenario, fields } = await req.json() as {
      scenario: string;
      fields: Record<string, string>;
    };

    const issuedAt = new Date().toISOString();
    let receipt: Record<string, string>;

    if (scenario === "shopping") {
      const orderId = generateId("ORD");
      const lastFour = fields.card_number
        ? fields.card_number.replace(/\s/g, "").slice(-4)
        : "7891";
      receipt = {
        "Order ID": orderId,
        "Item": "Sony WF-1000XM5 Wireless Earbuds",
        "Charged": `$49.99 → Visa ••••${lastFour} (exp ${fields.expiry || "09/27"})`,
        "Ship to": fields.shipping_address || fields.billing_address || "Address on file",
        "Issued at": issuedAt,
        "Server": "supabase-edge/simulate-receipt",
        "Status": "✅ Order confirmed",
      };
    } else if (scenario === "travel") {
      const bookingRef = generateId("TKT");
      receipt = {
        "Booking ref": bookingRef,
        "Passenger": fields.full_name || "Traveller",
        "Route": "JFK → NRT (round-trip)",
        "Dates": "Apr 15–22, 2026",
        "Passport": fields.passport_number ? `••••${fields.passport_number.slice(-4)}` : "On file",
        "Hotel": "Shinjuku Grand, 5 nights",
        "Total": "$2,847.50",
        "Issued at": issuedAt,
        "Server": "supabase-edge/simulate-receipt",
        "Status": "✅ Booking confirmed",
      };
    } else {
      const formId = generateId("ER");
      receipt = {
        "Form ID": formId,
        "Blood type": fields.blood_type || "On file",
        "Allergies": fields.allergies || "None listed",
        "Medications": fields.medications || "None listed",
        "Conditions": fields.conditions || "None listed",
        "Emergency contact": fields.emergency_contact || "Not provided",
        "Issued at": issuedAt,
        "Server": "supabase-edge/simulate-receipt",
        "Status": "✅ Intake form pre-filled",
      };
    }

    return new Response(
      JSON.stringify({ receipt, issuedAt }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Failed to generate receipt: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
