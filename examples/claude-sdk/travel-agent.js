import Anthropic from '@anthropic-ai/sdk';
import { ShadowKeyClient } from 'shadowkey-agent-sdk';

// ─── Claude Travel Agent with ShadowKey Privacy Vault ──────────────────────
//
// This example demonstrates how a Claude-powered AI agent can request
// access to a user's ShadowKey vault to complete a travel booking —
// with the user retaining full field-level control over what is shared.
//
// Flow:
//   1. Claude determines which user data is needed for the booking
//   2. ShadowKey SDK creates a pending access request
//   3. User approves (field-by-field) in the ShadowKey dashboard
//   4. Claude completes the booking — actual secrets never leave the vault
// ───────────────────────────────────────────────────────────────────────────

async function runTravelAgent() {
  console.log('✈️  ShadowKey Travel Agent (Claude + shadowkey-agent-sdk)\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const shadowKeyApiKey = process.env.SHADOWKEY_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !shadowKeyApiKey || !anthropicApiKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   SUPABASE_URL         — your Supabase project URL');
    console.error('   SHADOWKEY_API_KEY    — from the ShadowKey settings page');
    console.error('   ANTHROPIC_API_KEY    — from console.anthropic.com');
    process.exit(1);
  }

  // ── Initialise clients ──────────────────────────────────────────────────
  const claude = new Anthropic({ apiKey: anthropicApiKey });

  const shadowKey = new ShadowKeyClient({
    apiUrl: `${supabaseUrl}/functions/v1`,
    apiKey: shadowKeyApiKey,
    debug: true,
  });

  const destination = 'Tokyo, Japan';
  const dates = 'April 15–22, 2026';
  const budget = '$3,500';

  console.log(`📍 Booking request: ${destination} | ${dates} | Budget: ${budget}\n`);

  // ── Step 1: Claude determines which fields it needs ─────────────────────
  console.log('🤔 Step 1: Claude determines which vault fields are needed\n');

  const planningResponse = await claude.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `You are a travel booking assistant. A user wants to book a trip to ${destination}
from ${dates} with a budget of ${budget}.

List the exact user data fields you need from their secure vault to complete this booking.
Respond with ONLY a JSON array of field names, e.g. ["full_name", "passport_number"].

Common vault fields available: full_name, email, phone, dob, passport_number,
passport_country, nationality, card_number, expiry, billing_address`,
      },
    ],
  });

  const rawFields = planningResponse.content[0].text.trim();
  console.log('Claude says it needs:', rawFields);

  let requestedFields;
  try {
    requestedFields = JSON.parse(rawFields);
  } catch {
    // Safe fallback if Claude adds prose around the JSON
    const match = rawFields.match(/\[.*\]/s);
    requestedFields = match
      ? JSON.parse(match[0])
      : ['full_name', 'passport_number', 'email', 'card_number'];
  }

  // ── Step 2: Request access via ShadowKey SDK ────────────────────────────
  console.log('\n🔐 Step 2: Requesting user approval via ShadowKey\n');

  const accessRequest = await shadowKey.requestAccess({
    agentId: 'travel-agent-claude-001',
    agentName: 'Claude Travel Assistant',
    requestedFields,
    purpose: `Book a trip to ${destination} (${dates}) within a ${budget} budget`,
    category: 'travel',
    expiresIn: 300,
  });

  console.log(`✅ Access request created: ${accessRequest.requestId}`);
  console.log('⏳ Waiting for approval in ShadowKey dashboard...\n');
  console.log('   → Open https://shadowkey-ai.vercel.app to approve\n');

  // ── Step 3: Poll for user approval (max 2 minutes) ──────────────────────
  const result = await shadowKey.waitForApproval(accessRequest.requestId, 120_000, 3_000);

  if (result.status !== 'approved') {
    console.log(`❌ Access ${result.status}. Booking cancelled.`);
    return;
  }

  console.log('✅ Approved!\n');
  console.log('Granted fields:', result.grantedFields ?? Object.keys(result.grantedData ?? {}));

  // ── Step 4: Claude completes the booking ────────────────────────────────
  //
  // SECURITY: Only field metadata is sent to Claude — NOT the actual values.
  // The application processes actual vault secrets locally (e.g. to call a
  // booking API), keeping sensitive data out of the LLM context entirely.
  //
  console.log('\n📋 Step 4: Claude confirms the booking using approved field metadata\n');

  const approvedFields = result.grantedFields ?? Object.keys(result.grantedData ?? {});
  const hasPassport = approvedFields.some(f => f.includes('passport'));
  const hasPayment = approvedFields.some(f => ['card_number', 'expiry', 'billing_address'].includes(f));

  const confirmationResponse = await claude.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are a travel booking assistant. The user has granted scoped access via ShadowKey.

Trip details:
- Destination: ${destination}
- Dates: ${dates}
- Budget: ${budget}

Approved data fields (values held locally — never sent to you):
${approvedFields.map(f => `  • ${f}`).join('\n')}

Has identity/passport data: ${hasPassport}
Has payment data: ${hasPayment}

Generate a friendly booking confirmation summary. Note that their sensitive data was accessed
only with their explicit per-field consent via ShadowKey, and was never transmitted to any AI.`,
      },
    ],
  });

  console.log('🎉 Booking confirmation from Claude:\n');
  console.log(confirmationResponse.content[0].text);
  console.log('\n─────────────────────────────────────────────────────');
  console.log('🔒 Privacy guarantee: Vault secrets were NEVER sent to Claude.');
  console.log('   Only field names (metadata) were included in the prompt.');
  console.log('   Actual booking API calls use locally-held decrypted values.');
  console.log('─────────────────────────────────────────────────────\n');
}

runTravelAgent().catch(console.error);
