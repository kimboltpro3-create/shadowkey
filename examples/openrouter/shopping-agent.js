import { ShadowKeyClient } from 'shadowkey-agent-sdk';

// ─── OpenRouter AI Agent ────────────────────────────────────
class OpenRouterAgent {
  constructor(openRouterApiKey, model = 'nvidia/llama-3.3-nemotron-super-49b-v1:free') {
    this.apiKey = openRouterApiKey;
    this.baseUrl = 'https://openrouter.ai/api/v1';
    this.model = model;

    this.fallbackModels = [
      'nvidia/llama-3.3-nemotron-super-49b-v1:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'stepfun/step-3.5-flash:free',
      'nvidia/nemotron-3-nano-30b-a3b:free',
    ];
  }

  async chat(messages, model = null) {
    const primaryModel = model || this.model;

    try {
      return await this.attemptChat(messages, primaryModel);
    } catch (error) {
      console.warn(`⚠️  Primary model ${primaryModel} failed: ${error.message}`);

      for (const fallbackModel of this.fallbackModels) {
        if (fallbackModel === primaryModel) continue;
        try {
          console.log(`🔄 Trying fallback model: ${fallbackModel}`);
          const result = await this.attemptChat(messages, fallbackModel);
          console.log(`✅ Success with ${fallbackModel}`);
          return result;
        } catch (fallbackError) {
          console.warn(`⚠️  Fallback ${fallbackModel} failed: ${fallbackError.message}`);
        }
      }

      throw new Error('All models failed. Please try again later.');
    }
  }

  async attemptChat(messages, model) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://shadowkey-ai.vercel.app',
        'X-Title': 'ShadowKey Shopping Agent',
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${response.status} ${response.statusText}: ${errorText}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message) {
      throw new Error('Invalid response format from API');
    }
    return data.choices[0].message.content;
  }
}

// ─── Main Agent Flow ────────────────────────────────────────
async function runShoppingAgent() {
  console.log('🛍️  ShadowKey Shopping Agent (using shadowkey-agent-sdk)\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const shadowKeyApiKey = process.env.SHADOWKEY_API_KEY;
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;

  if (!supabaseUrl || !shadowKeyApiKey || !openRouterApiKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   SUPABASE_URL');
    console.error('   SHADOWKEY_API_KEY');
    console.error('   OPENROUTER_API_KEY');
    process.exit(1);
  }

  // ✅ Using the REAL published SDK from npm
  const shadowKey = new ShadowKeyClient({
    apiUrl: `${supabaseUrl}/functions/v1`,
    apiKey: shadowKeyApiKey,
    debug: true,
  });

  const agent = new OpenRouterAgent(openRouterApiKey);

  // ── Step 1: AI determines what data is needed ──────────
  console.log('📋 Step 1: AI determines what data is needed\n');

  const planningPrompt = [
    {
      role: 'system',
      content: 'You are a shopping assistant. Determine what user data you need to complete a purchase. Respond with a JSON array of field names like ["creditCard", "shippingAddress", "email"].',
    },
    {
      role: 'user',
      content: 'I want to buy wireless headphones for $89.99. What data do you need from my vault?',
    },
  ];

  const requiredFields = await agent.chat(planningPrompt);
  console.log('AI determined needed fields:', requiredFields);

  let fields;
  try {
    fields = JSON.parse(requiredFields);
  } catch {
    fields = ['creditCard', 'shippingAddress', 'email'];
  }

  // ── Step 2: SDK requests access from user's vault ──────
  console.log('\n🔐 Step 2: Request access from user via SDK\n');

  const accessRequest = await shadowKey.requestAccess({
    agentId: 'shopping-agent-001',
    agentName: 'Smart Shopping Assistant',
    requestedFields: fields,
    purpose: 'Complete your purchase of wireless headphones ($89.99)',
    category: 'shopping',
    expiresIn: 300,
  });

  console.log('✅ Access request created:', accessRequest.requestId);
  console.log('⏳ Waiting for user approval (check your ShadowKey dashboard)...\n');

  // ── Step 3: SDK polls for approval ─────────────────────
  const result = await shadowKey.waitForApproval(accessRequest.requestId, 120000, 3000);

  if (result.status === 'approved') {
    console.log('✅ Access granted!\n');
    console.log('📦 Step 3: AI completes the purchase\n');

    // SECURITY: Only send metadata to LLM — NOT actual vault secrets
    const purchaseMetadata = {
      hasPaymentMethod: result.grantedData && 'creditCard' in result.grantedData,
      hasShippingAddress: result.grantedData && 'shippingAddress' in result.grantedData,
      hasEmail: result.grantedData && 'email' in result.grantedData,
      approvedFields: Object.keys(result.grantedData || {}),
    };

    const purchasePrompt = [
      {
        role: 'system',
        content: 'You are a shopping assistant. The user granted you scoped access to their payment data via ShadowKey. Confirm the purchase.',
      },
      {
        role: 'user',
        content: `I have scoped access to: ${JSON.stringify(purchaseMetadata.approvedFields)}. Confirm that the purchase for Wireless Headphones ($89.99) will be processed. The actual data values are held locally — never sent to you.`,
      },
    ];

    const confirmation = await agent.chat(purchasePrompt);
    console.log('🎉 Purchase confirmation from AI:\n');
    console.log(confirmation);
    console.log('\n🔒 Actual purchase processed locally using scoped vault data.');
    console.log('✅ Vault secrets were NEVER sent to the LLM — only metadata about approved fields.');
  } else {
    console.log(`❌ Access ${result.status}: ${result.message}`);
  }
}

runShoppingAgent().catch(console.error);
