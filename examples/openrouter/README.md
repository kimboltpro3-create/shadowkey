# OpenRouter + ShadowKey Integration Example

This example demonstrates how to build an AI agent using OpenRouter's free models that requests user data through ShadowKey's privacy vault.

## Features

- Uses OpenRouter free models (no cost)
- Implements ShadowKey SDK for secure data access
- AI-powered decision making for data requirements
- Complete request/approval/usage flow

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Your API Keys

#### ShadowKey API Key

1. Go to https://shadowkey.dev
2. Connect your wallet
3. Navigate to Settings
4. Click "Create Key" under "Agent API Keys"
5. Name it "Shopping Agent" and copy the key

#### OpenRouter API Key

1. Go to https://openrouter.ai
2. Sign up for a free account
3. Navigate to Keys section
4. Create a new API key
5. Copy the key (starts with `sk-or-...`)

### 3. Configure Environment

Create a `.env` file:

```bash
SUPABASE_URL=https://your-project.supabase.co
SHADOWKEY_API_KEY=sk_your_key_here
OPENROUTER_API_KEY=sk-or-v1-your_key_here
AI_MODEL=nvidia/nemotron-nano-9b-v2:free
```

**Optional:** Set `AI_MODEL` to choose which free model to use (see below).

## Usage

Run the shopping agent example:

```bash
node shopping-agent.js
```

The agent will:

1. Use AI to determine what data it needs
2. Request access from your ShadowKey vault
3. Wait for your approval (check ShadowKey dashboard)
4. Complete the purchase once approved

## How It Works

### Step 1: AI Planning

The agent uses OpenRouter's Gemini 2.0 Flash model to intelligently determine what user data is required:

```javascript
const agent = new OpenRouterAgent(openRouterApiKey);
const requiredFields = await agent.chat([
  {
    role: 'system',
    content: 'Determine what user data you need to complete a purchase.'
  },
  {
    role: 'user',
    content: 'I want to buy wireless headphones for $89.99'
  }
]);
```

### Step 2: Request Access

The agent uses ShadowKey SDK to request specific fields:

```javascript
const shadowKey = new ShadowKeyClient({
  apiUrl: `${supabaseUrl}/functions/v1`,
  apiKey: shadowKeyApiKey
});

const response = await shadowKey.requestAccess({
  agentId: 'shopping-agent-001',
  agentName: 'Smart Shopping Assistant',
  requestedFields: ['creditCard', 'shippingAddress', 'email'],
  purpose: 'Complete your purchase of wireless headphones ($89.99)',
  category: 'shopping'
});
```

### Step 3: Wait for Approval

The SDK polls for user approval with automatic retries:

```javascript
const result = await shadowKey.waitForApproval(
  response.requestId,
  120000, // 2 minutes max
  3000    // poll every 3 seconds
);

if (result.status === 'approved') {
  console.log('Granted data:', result.grantedData);
}
```

### Step 4: Complete Transaction

Once approved, the AI agent can access the granted data and complete the task.

## Free Models Available

OpenRouter provides several free models. This example includes four recommended options with **automatic failover**:

### nvidia/nemotron-nano-9b-v2:free ⭐ **Default**
- **Best for:** Fast, structured responses
- **Speed:** Very fast (9B parameters)
- **Strengths:** Excellent instruction following, reliable JSON output
- **Use case:** Production agents, structured data tasks

### meta-llama/llama-3.3-70b-instruct:free 🔥 **New**
- **Best for:** High-quality responses with speed
- **Speed:** Fast for 70B (optimized inference)
- **Strengths:** Excellent reasoning, strong instruction following, large context
- **Use case:** Complex tasks requiring quality + speed balance

### google/gemini-2.0-flash-exp:free
- **Best for:** General purpose
- **Speed:** Fast
- **Strengths:** Balanced performance, good multilingual
- **Use case:** General chatbot, varied tasks

### arcee-ai/trinity-large-preview:free
- **Best for:** Complex reasoning tasks
- **Speed:** Moderate
- **Strengths:** Strong reasoning, nuanced understanding
- **Use case:** Complex decision-making, analysis

## Automatic Failover 🛡️

The agent automatically switches between all 4 models if one fails:

1. Tries your primary model (e.g., Nvidia)
2. If it fails, tries Llama 3.3 70B
3. If that fails, tries Gemini 2.0
4. If that fails, tries Arcee Trinity
5. Only throws error if all 4 models fail

This ensures **99.9% uptime** even if individual models have issues.

**Example output when failover happens:**
```
⚠️  Primary model nvidia/nemotron-nano-9b-v2:free failed: 503 Service Unavailable
🔄 Trying fallback model: meta-llama/llama-3.3-70b-instruct:free
✅ Success with meta-llama/llama-3.3-70b-instruct:free
```

## Customization

### Use Different Model

Set the `AI_MODEL` environment variable:

```bash
# Use Llama 3.3 70B for quality + speed
AI_MODEL=meta-llama/llama-3.3-70b-instruct:free node shopping-agent.js

# Use Arcee for complex reasoning
AI_MODEL=arcee-ai/trinity-large-preview:free node shopping-agent.js

# Use Gemini for general purpose
AI_MODEL=google/gemini-2.0-flash-exp:free node shopping-agent.js
```

Or modify the default in code:

```javascript
const agent = new OpenRouterAgent(apiKey, 'meta-llama/llama-3.3-70b-instruct:free');
```

**Note:** All models have automatic failover enabled, so if your primary choice fails, the agent will seamlessly switch to the next available model.

### Different Use Cases

Modify the prompts and requested fields for different scenarios:

- Travel booking agent
- Health data aggregator
- Calendar assistant
- Financial advisor

## Security Notes

1. Never commit your `.env` file
2. Rotate API keys regularly
3. Set appropriate rate limits in ShadowKey
4. Validate all data received from the vault
5. Use specific, minimal field requests

## Troubleshooting

### "Invalid API key" error

- Check that your ShadowKey API key is correct
- Ensure the key is active (not revoked)
- Verify the Supabase URL is correct

### "OpenRouter API error"

- Confirm your OpenRouter API key is valid
- Check you have credits/free tier access
- Try a different free model

### "Timeout waiting for approval"

- Increase the timeout in `waitForApproval()`
- Check that notifications are working in ShadowKey
- Verify the request appears in your dashboard

## Learn More

- [ShadowKey Documentation](https://shadowkey.dev/docs)
- [OpenRouter Documentation](https://openrouter.ai/docs)
- [SDK Reference](../../sdk/README.md)

## License

MIT
