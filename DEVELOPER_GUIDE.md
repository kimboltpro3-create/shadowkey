# ShadowKey Agent SDK - Developer Guide

Complete guide for integrating AI agents with ShadowKey's privacy vault.

## Table of Contents

1. [Quick Start](#quick-start)
2. [SDK Installation](#sdk-installation)
3. [Authentication](#authentication)
4. [Core Concepts](#core-concepts)
5. [API Reference](#api-reference)
6. [Integration Examples](#integration-examples)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 5-Minute Integration

```javascript
import { ShadowKeyClient } from '@shadowkey/agent-sdk';

const client = new ShadowKeyClient({
  apiUrl: 'https://your-project.supabase.co/functions/v1',
  apiKey: 'sk_your_api_key_here'
});

const response = await client.requestAccess({
  agentId: 'my-agent-001',
  agentName: 'My AI Assistant',
  requestedFields: ['email', 'name'],
  purpose: 'Send you a confirmation email'
});

const result = await client.waitForApproval(response.requestId);

if (result.status === 'approved') {
  console.log('Granted data:', result.grantedData);
}
```

---

## SDK Installation

### Node.js / JavaScript

```bash
npm install @shadowkey/agent-sdk
```

### Browser (CDN)

```html
<script type="module">
  import { ShadowKeyClient } from 'https://cdn.jsdelivr.net/npm/@shadowkey/agent-sdk/+esm';
</script>
```

### TypeScript

The SDK is written in TypeScript and includes full type definitions.

```typescript
import { ShadowKeyClient, AccessRequest, AccessResponse } from '@shadowkey/agent-sdk';
```

---

## Authentication

### Step 1: Get Your API Key

1. Visit [ShadowKey Dashboard](https://shadowkey.dev)
2. Connect your wallet
3. Navigate to **Settings** → **Agent API Keys**
4. Click **Create Key**
5. Name your key (e.g., "Production Agent")
6. Copy and securely store the key

### Step 2: Configure Your Client

```javascript
const client = new ShadowKeyClient({
  apiUrl: process.env.SUPABASE_URL + '/functions/v1',
  apiKey: process.env.SHADOWKEY_API_KEY,
  timeout: 30000,        // Optional: Request timeout in ms
  retryAttempts: 3,      // Optional: Number of retry attempts
  debug: false           // Optional: Enable debug logging
});
```

### Security Best Practices

- Store API keys in environment variables
- Never commit keys to version control
- Use different keys for development and production
- Rotate keys regularly (every 90 days recommended)
- Revoke unused keys immediately

---

## Core Concepts

### 1. Access Requests

Agents request specific data fields from users. Users approve or deny requests through the ShadowKey dashboard.

```javascript
await client.requestAccess({
  agentId: 'unique-agent-id',      // Your agent's identifier
  agentName: 'Human-readable name', // Displayed to user
  requestedFields: ['email', 'phone'], // Array of field names
  purpose: 'Clear explanation',     // Why you need this data
  category: 'shopping',             // Optional: shopping, travel, health, etc.
  expiresIn: 300                    // Optional: Seconds until expiration (default: 300)
});
```

### 2. Request Status

Requests can be in one of four states:

- `pending`: Waiting for user approval
- `approved`: User granted access
- `denied`: User rejected access
- `expired`: Request timed out

### 3. Data Fields

Common field names users can store in their vault:

**Identity:**
- `fullName`, `firstName`, `lastName`
- `email`, `phone`
- `dateOfBirth`, `ssn`

**Location:**
- `homeAddress`, `shippingAddress`, `billingAddress`
- `city`, `state`, `zipCode`, `country`

**Financial:**
- `creditCard`, `bankAccount`
- `cryptoWallet`

**Health:**
- `insuranceId`, `medicalRecords`
- `bloodType`, `allergies`

**Travel:**
- `passport`, `driversLicense`
- `travelPreferences`

**Custom:**
Users can create custom fields with any name.

### 4. Polling vs Webhooks

**Polling** (Implemented in SDK):
```javascript
await client.waitForApproval(requestId, 300000, 2000);
```

**Webhooks** (Coming soon):
Register a callback URL to receive real-time notifications.

---

## API Reference

### Constructor

```typescript
new ShadowKeyClient(config: ShadowKeyConfig)
```

**Parameters:**
- `apiUrl` (string, required): Supabase project URL + `/functions/v1`
- `apiKey` (string, required): Your ShadowKey API key
- `timeout` (number, optional): Request timeout in milliseconds (default: 30000)
- `retryAttempts` (number, optional): Number of retry attempts (default: 3)
- `debug` (boolean, optional): Enable debug logging (default: false)

### Methods

#### `requestAccess(request: AccessRequest): Promise<AccessResponse>`

Create a new access request.

**Parameters:**
```typescript
interface AccessRequest {
  agentId: string;              // Unique identifier for your agent
  agentName: string;            // Human-readable agent name
  requestedFields: string[];    // Array of field names to request
  purpose: string;              // Clear explanation of why you need access
  category?: string;            // Optional category
  expiresIn?: number;           // Optional expiration time in seconds
}
```

**Returns:**
```typescript
interface AccessResponse {
  requestId: string;            // Use this to check status
  status: 'pending' | 'approved' | 'denied' | 'expired';
  grantedData?: Record<string, any>; // Present if immediately approved
  expiresAt?: string;           // ISO timestamp
  message?: string;
}
```

**Example:**
```javascript
const response = await client.requestAccess({
  agentId: 'shopping-bot-v2',
  agentName: 'Smart Shopping Assistant',
  requestedFields: ['creditCard', 'shippingAddress'],
  purpose: 'Complete your purchase of wireless headphones ($89.99)',
  category: 'shopping',
  expiresIn: 600
});
```

#### `checkStatus(requestId: string): Promise<DisclosureStatus>`

Check the current status of an access request.

**Parameters:**
- `requestId` (string): The request ID returned from `requestAccess()`

**Returns:**
```typescript
interface DisclosureStatus {
  requestId: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  approvedAt?: string;
  deniedAt?: string;
  expiresAt?: string;
  grantedFields?: string[];
  grantedData?: Record<string, any>;
}
```

**Example:**
```javascript
const status = await client.checkStatus(requestId);

if (status.status === 'approved') {
  console.log('Access granted!', status.grantedData);
}
```

#### `waitForApproval(requestId: string, maxWaitMs?: number, pollIntervalMs?: number): Promise<AccessResponse>`

Poll for approval with automatic retries.

**Parameters:**
- `requestId` (string): The request ID to poll
- `maxWaitMs` (number, optional): Maximum time to wait in milliseconds (default: 300000 = 5 minutes)
- `pollIntervalMs` (number, optional): Time between polls in milliseconds (default: 2000 = 2 seconds)

**Returns:** `Promise<AccessResponse>`

**Example:**
```javascript
try {
  const result = await client.waitForApproval(
    requestId,
    120000, // Wait up to 2 minutes
    3000    // Check every 3 seconds
  );

  if (result.status === 'approved') {
    console.log('Access granted:', result.grantedData);
  }
} catch (error) {
  console.error('Timeout or error:', error.message);
}
```

#### `submitReverseDisclosure(request: ReverseDisclosureRequest): Promise<ReverseDisclosureResponse>`

Submit data to user's vault (reverse data flow).

**Parameters:**
```typescript
interface ReverseDisclosureRequest {
  serviceId: string;
  serviceName: string;
  dataOffered: Array<{
    field: string;
    value: string;
    category: string;
  }>;
  purpose: string;
}
```

**Example:**
```javascript
await client.submitReverseDisclosure({
  serviceId: 'travel-agency-001',
  serviceName: 'Global Travel Co.',
  dataOffered: [
    {
      field: 'bookingConfirmation',
      value: 'ABC123',
      category: 'travel'
    },
    {
      field: 'frequentFlyerNumber',
      value: 'FF987654',
      category: 'travel'
    }
  ],
  purpose: 'Store your travel booking details'
});
```

---

## Integration Examples

### OpenRouter (Free AI Models)

Complete example using Gemini 2.0 Flash:

```javascript
import { ShadowKeyClient } from '@shadowkey/agent-sdk';

const shadowKey = new ShadowKeyClient({
  apiUrl: process.env.SUPABASE_URL + '/functions/v1',
  apiKey: process.env.SHADOWKEY_API_KEY
});

async function aiDrivenRequest() {
  const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [{
        role: 'user',
        content: 'I want to book a flight. What user data do you need?'
      }]
    })
  });

  const aiResponse = await openRouterResponse.json();
  const requiredFields = JSON.parse(aiResponse.choices[0].message.content);

  const accessRequest = await shadowKey.requestAccess({
    agentId: 'travel-bot',
    agentName: 'AI Travel Assistant',
    requestedFields: requiredFields,
    purpose: 'Book your flight to New York',
    category: 'travel'
  });

  return await shadowKey.waitForApproval(accessRequest.requestId);
}
```

See `/examples/openrouter` for complete implementation.

### Express.js Backend

```javascript
import express from 'express';
import { ShadowKeyClient } from '@shadowkey/agent-sdk';

const app = express();
const shadowKey = new ShadowKeyClient({
  apiUrl: process.env.SUPABASE_URL + '/functions/v1',
  apiKey: process.env.SHADOWKEY_API_KEY
});

app.post('/api/request-user-data', async (req, res) => {
  const { fields, purpose } = req.body;

  const response = await shadowKey.requestAccess({
    agentId: 'web-app',
    agentName: 'My Web Application',
    requestedFields: fields,
    purpose
  });

  res.json({ requestId: response.requestId });
});

app.get('/api/check-status/:requestId', async (req, res) => {
  const status = await shadowKey.checkStatus(req.params.requestId);
  res.json(status);
});
```

See `/examples/node-express` for complete implementation.

---

## Best Practices

### 1. Request Only What You Need

```javascript
// Good: Specific, minimal request
requestedFields: ['email', 'shippingAddress']

// Bad: Overly broad request
requestedFields: ['email', 'phone', 'address', 'ssn', 'creditCard', 'passport']
```

### 2. Provide Clear Purpose

```javascript
// Good: Clear, specific purpose
purpose: 'Send order confirmation and track your shipment'

// Bad: Vague purpose
purpose: 'For our services'
```

### 3. Handle All Response States

```javascript
const result = await client.waitForApproval(requestId);

switch (result.status) {
  case 'approved':
    console.log('Process the data:', result.grantedData);
    break;
  case 'denied':
    console.log('Gracefully handle denial');
    break;
  case 'expired':
    console.log('Request timed out');
    break;
}
```

### 4. Implement Proper Error Handling

```javascript
try {
  const response = await client.requestAccess({...});
} catch (error) {
  if (error.message.includes('401')) {
    console.error('Invalid API key - check your credentials');
  } else if (error.message.includes('timeout')) {
    console.error('Request timed out - increase timeout or retry');
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

### 5. Use Appropriate Timeouts

```javascript
// Short-lived request (notification)
await client.waitForApproval(requestId, 60000); // 1 minute

// Standard request
await client.waitForApproval(requestId, 300000); // 5 minutes

// Long-lived request (background process)
await client.waitForApproval(requestId, 600000); // 10 minutes
```

---

## Troubleshooting

### Common Issues

#### "Invalid API key"

**Cause:** API key is incorrect, expired, or revoked.

**Solution:**
1. Verify the API key in your `.env` file
2. Check that the key is active in ShadowKey Settings
3. Generate a new key if necessary

#### "Request not found"

**Cause:** Checking status for a non-existent request ID.

**Solution:**
- Verify the request ID is correct
- Ensure you're using the same API key that created the request

#### "Timeout waiting for approval"

**Cause:** User hasn't approved within the timeout period.

**Solution:**
- Increase `maxWaitMs` in `waitForApproval()`
- Implement notification system to alert users
- Consider using webhooks instead of polling

#### "CORS error" (Browser)

**Cause:** Browser blocking cross-origin requests.

**Solution:**
The SDK is designed for server-side use. For browser integration:
1. Proxy requests through your backend
2. Or configure CORS on your Supabase project

### Debug Mode

Enable debug logging to see detailed request/response information:

```javascript
const client = new ShadowKeyClient({
  apiUrl: process.env.SUPABASE_URL + '/functions/v1',
  apiKey: process.env.SHADOWKEY_API_KEY,
  debug: true // Enable debug logging
});
```

### Rate Limits

Default rate limits per API key:
- **Free tier:** 100 requests/minute, 1000 requests/hour
- **Pro tier:** 1000 requests/minute, 10000 requests/hour
- **Enterprise:** Custom limits

If you hit rate limits, the SDK will automatically retry with exponential backoff.

---

## Support

- **Documentation:** https://shadowkey.dev/docs
- **GitHub Issues:** https://github.com/shadowkey/agent-sdk/issues
- **Discord:** https://discord.gg/shadowkey
- **Email:** support@shadowkey.dev

---

## License

MIT License - see LICENSE file for details.
