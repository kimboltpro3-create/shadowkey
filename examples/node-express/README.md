# Express.js + ShadowKey Integration

REST API server demonstrating ShadowKey SDK integration with Express.js.

## Features

- RESTful API endpoints for data requests
- Request status tracking
- In-memory pending request management
- CORS enabled for frontend integration
- Health check endpoint

## Setup

```bash
npm install
```

Create `.env` file:

```bash
SUPABASE_URL=https://your-project.supabase.co
SHADOWKEY_API_KEY=sk_your_key_here
PORT=3000
```

## Usage

Start the server:

```bash
npm start
```

## API Endpoints

### POST /api/request-data

Create a new data access request.

**Request Body:**
```json
{
  "agentId": "my-agent-001",
  "agentName": "My AI Assistant",
  "fields": ["email", "name", "phone"],
  "purpose": "Send you a confirmation email",
  "category": "communication"
}
```

**Response:**
```json
{
  "requestId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "pending",
  "expiresAt": "2024-03-15T10:30:00Z",
  "message": "Access request created. User will be notified."
}
```

### GET /api/check-status/:requestId

Check the status of a pending request.

**Response (Pending):**
```json
{
  "requestId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "pending",
  "expiresAt": "2024-03-15T10:30:00Z"
}
```

**Response (Approved):**
```json
{
  "requestId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "approved",
  "approvedAt": "2024-03-15T10:25:00Z",
  "grantedData": {
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### GET /api/pending-requests

List all pending requests.

**Response:**
```json
{
  "requests": [
    {
      "requestId": "123e4567-e89b-12d3-a456-426614174000",
      "agentId": "my-agent-001",
      "agentName": "My AI Assistant",
      "createdAt": "2024-03-15T10:20:00Z"
    }
  ],
  "count": 1
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-03-15T10:20:00Z"
}
```

## Example Usage with curl

```bash
# Request data access
curl -X POST http://localhost:3000/api/request-data \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "shopping-bot",
    "agentName": "Shopping Assistant",
    "fields": ["creditCard", "shippingAddress"],
    "purpose": "Complete your purchase",
    "category": "shopping"
  }'

# Check status
curl http://localhost:3000/api/check-status/YOUR_REQUEST_ID

# List pending
curl http://localhost:3000/api/pending-requests
```

## Frontend Integration

```javascript
async function requestUserData() {
  const response = await fetch('http://localhost:3000/api/request-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: 'web-app',
      agentName: 'My Web App',
      fields: ['email', 'name'],
      purpose: 'Create your account',
      category: 'registration'
    })
  });

  const data = await response.json();
  console.log('Request ID:', data.requestId);

  const pollStatus = setInterval(async () => {
    const statusRes = await fetch(
      `http://localhost:3000/api/check-status/${data.requestId}`
    );
    const status = await statusRes.json();

    if (status.status === 'approved') {
      clearInterval(pollStatus);
      console.log('Access granted!', status.grantedData);
    } else if (status.status === 'denied') {
      clearInterval(pollStatus);
      console.log('Access denied');
    }
  }, 3000);
}
```

## Production Considerations

1. **Database Storage**: Replace `Map` with persistent storage (PostgreSQL, Redis)
2. **Authentication**: Add API authentication for your endpoints
3. **Rate Limiting**: Implement rate limiting middleware
4. **Webhooks**: Add webhook support for real-time notifications
5. **Logging**: Add proper logging (Winston, Pino)
6. **Error Handling**: Enhance error handling and validation

## License

MIT
