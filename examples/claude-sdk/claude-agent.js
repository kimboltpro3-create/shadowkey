import Anthropic from '@anthropic-ai/sdk';
import { ShadowKeyClient } from 'shadowkey-agent-sdk';

// ─── Claude Shopping Agent with ShadowKey — tool_use Edition ────────────────
//
// Demonstrates Claude's native tool_use (function calling) API integrated with
// ShadowKey's privacy vault. Claude DECIDES what fields it needs, calls the
// request_vault_access tool, waits for user approval, then completes checkout.
//
// This proves the SDK is framework-agnostic: same flow as the OpenRouter example
// but using Claude's structured tool_use rather than free-form JSON output.
//
// Flow:
//   1. Claude receives a shopping cart and thinks through what data it needs
//   2. Claude calls request_vault_access tool with specific fields + purpose
//   3. ShadowKey SDK creates a pending request in the vault
//   4. User approves fields in the ShadowKey dashboard (field-by-field)
//   5. Claude receives only the approved fields — denied ones are never revealed
//   6. Claude generates a checkout confirmation with scoped data
//
// Run:
//   ANTHROPIC_API_KEY=sk-... SHADOWKEY_API_KEY=sk_... SUPABASE_URL=https://... node claude-agent.js
// ─────────────────────────────────────────────────────────────────────────────

// ── Tool definition for Claude's function calling ─────────────────────────────
const REQUEST_VAULT_ACCESS_TOOL = {
  name: 'request_vault_access',
  description:
    "Request access to specific fields from the user's ShadowKey privacy vault. " +
    'The user will be notified and must approve or deny each field individually. ' +
    'Only request the minimum fields genuinely needed for the task.',
  input_schema: {
    type: 'object',
    properties: {
      fields: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Exact vault field names needed (e.g. ["full_name", "email", "card_number", "billing_address", "shipping_address"])',
      },
      purpose: {
        type: 'string',
        description: 'Clear, user-facing explanation of why these fields are needed for this specific task',
      },
      category: {
        type: 'string',
        enum: ['payment', 'identity', 'credentials', 'health', 'preferences'],
        description: 'Primary vault category for the requested fields',
      },
    },
    required: ['fields', 'purpose', 'category'],
  },
};

async function runShoppingAgent() {
  console.log('🛍️  ShadowKey Shopping Agent (Claude tool_use + shadowkey-agent-sdk)\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const shadowKeyApiKey = process.env.SHADOWKEY_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !shadowKeyApiKey || !anthropicApiKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   SUPABASE_URL         — your Supabase project URL');
    console.error('   SHADOWKEY_API_KEY    — from the ShadowKey Settings page');
    console.error('   ANTHROPIC_API_KEY    — from console.anthropic.com');
    process.exit(1);
  }

  // ── Initialise clients ───────────────────────────────────────────────────
  const claude = new Anthropic({ apiKey: anthropicApiKey });

  const shadowKey = new ShadowKeyClient({
    apiUrl: `${supabaseUrl}/functions/v1`,
    apiKey: shadowKeyApiKey,
    debug: true,
  });

  // ── Shopping cart ────────────────────────────────────────────────────────
  const cart = [
    { name: 'Mechanical Keyboard (TKL)', price: 149.99, sku: 'KB-TKL-001' },
    { name: 'USB-C Desk Hub (7-port)', price: 79.99, sku: 'HUB-7C-002' },
    { name: 'Laptop Stand (aluminium)', price: 49.99, sku: 'LS-ALU-003' },
  ];

  const total = cart.reduce((s, i) => s + i.price, 0).toFixed(2);

  console.log(`📦 Cart (${cart.length} items, total $${total}):`);
  cart.forEach((i) => console.log(`   • ${i.name} — $${i.price}`));
  console.log();

  // ── Agentic loop ─────────────────────────────────────────────────────────
  const messages = [
    {
      role: 'user',
      content:
        `You are a checkout assistant for an e-commerce store. ` +
        `The user wants to purchase:\n\n` +
        cart.map((i) => `- ${i.name} ($${i.price})`).join('\n') +
        `\n\nOrder total: $${total}\n\n` +
        `Use the request_vault_access tool to request the minimum fields needed ` +
        `to complete this checkout. Request payment AND shipping fields together in one call.`,
    },
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // ── Ask Claude ─────────────────────────────────────────────────────────
    console.log(`🤔 Claude thinking (iteration ${iterations})...\n`);

    const response = await claude.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      tools: [REQUEST_VAULT_ACCESS_TOOL],
      messages,
    });

    // ── Handle tool_use ────────────────────────────────────────────────────
    if (response.stop_reason === 'tool_use') {
      const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
      if (!toolUseBlock || toolUseBlock.type !== 'tool_use') break;

      const { fields, purpose, category } = toolUseBlock.input;

      console.log(`🔧 Claude called: ${toolUseBlock.name}`);
      console.log(`   Fields: ${fields.join(', ')}`);
      console.log(`   Purpose: ${purpose}`);
      console.log(`   Category: ${category}\n`);

      // ── Request vault access via ShadowKey SDK ──────────────────────────
      console.log('🔐 Creating ShadowKey access request...\n');

      const accessRequest = await shadowKey.requestAccess({
        agentId: 'shopping-agent-claude-tool-use-001',
        agentName: 'Claude Checkout Assistant',
        requestedFields: fields,
        purpose,
        category,
        expiresIn: 300,
      });

      console.log(`✅ Access request created: ${accessRequest.requestId}`);
      console.log('⏳ Waiting for user approval in ShadowKey dashboard...');
      console.log('   → Open https://shadowkey-ai.vercel.app to approve\n');

      // ── Poll for approval ───────────────────────────────────────────────
      const result = await shadowKey.waitForApproval(accessRequest.requestId, 180_000, 3_000);

      console.log(`\n📋 Approval result: ${result.status}`);

      const toolResult = {
        status: result.status,
        grantedFields: result.grantedFields ?? [],
        deniedFields: fields.filter((f) => !result.grantedFields?.includes(f)),
        message:
          result.status === 'approved'
            ? `User granted access to ${result.grantedFields?.length} of ${fields.length} requested fields.`
            : `User ${result.status} the request.`,
      };

      if (result.status === 'approved') {
        console.log(`✅ Approved: ${toolResult.grantedFields.join(', ')}`);
        if (toolResult.deniedFields.length > 0) {
          console.log(`🚫 Denied: ${toolResult.deniedFields.join(', ')}`);
        }
        console.log();
      } else {
        console.log(`❌ ${result.status}. Checkout cancelled.\n`);
      }

      // ── Feed tool result back to Claude ────────────────────────────────
      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: JSON.stringify(toolResult),
          },
        ],
      });

      if (result.status !== 'approved') break;

    } else if (response.stop_reason === 'end_turn') {
      // ── Claude is done — print final output ───────────────────────────
      const textBlock = response.content.find((b) => b.type === 'text');
      if (textBlock && textBlock.type === 'text') {
        console.log('🎉 Checkout summary from Claude:\n');
        console.log(textBlock.text);
      }
      break;
    } else {
      console.log(`Unexpected stop_reason: ${response.stop_reason}`);
      break;
    }
  }

  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('🔒 Privacy guarantee: Vault secrets were NEVER sent to Claude.');
  console.log('   Only field names (metadata) were in the tool_result.');
  console.log('   Actual payment processing uses locally-held decrypted values.');
  console.log('   This agent uses Claude tool_use — framework-agnostic SDK demo.');
  console.log('─────────────────────────────────────────────────────────────\n');
}

runShoppingAgent().catch(console.error);
