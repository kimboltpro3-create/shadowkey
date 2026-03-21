import express from 'express';
import cors from 'cors';
import { ShadowKeyClient } from 'shadowkey-agent-sdk';

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Using the REAL published SDK from npm — handles HMAC signing, retries, timeouts
const shadowKey = new ShadowKeyClient({
  apiUrl: `${process.env.SUPABASE_URL}/functions/v1`,
  apiKey: process.env.SHADOWKEY_API_KEY || '',
  debug: process.env.NODE_ENV === 'development',
});

const pendingRequests = new Map();

// ── POST /api/request-data ──────────────────────────────────
app.post('/api/request-data', async (req, res) => {
  try {
    const { agentId, agentName, fields, purpose, category, authToken } = req.body;

    if (!authToken || authToken !== process.env.API_AUTH_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing auth token' });
    }

    if (!agentId || !agentName || !fields || !purpose) {
      return res.status(400).json({
        error: 'Missing required fields: agentId, agentName, fields, purpose',
      });
    }

    // SDK handles HMAC signing, headers, and retries automatically
    const response = await shadowKey.requestAccess({
      agentId,
      agentName,
      requestedFields: fields,
      purpose,
      category: category || 'general',
    });

    pendingRequests.set(response.requestId, {
      agentId,
      agentName,
      createdAt: new Date(),
      expiresAt: response.expiresAt,
    });

    res.json({
      requestId: response.requestId,
      status: response.status,
      expiresAt: response.expiresAt,
      message: 'Access request created. User will be notified.',
    });
  } catch (error) {
    console.error('Request failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/check-status/:requestId ────────────────────────
app.get('/api/check-status/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const authToken = req.headers.authorization?.replace('Bearer ', '');

    if (!authToken || authToken !== process.env.API_AUTH_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing auth token' });
    }

    if (!pendingRequests.has(requestId)) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // SDK handles HMAC signing for status checks too
    const status = await shadowKey.checkStatus(requestId);

    if (status.status === 'approved' || status.status === 'denied' || status.status === 'expired') {
      pendingRequests.delete(requestId);
    }

    res.json(status);
  } catch (error) {
    console.error('Status check failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Cleanup expired requests ────────────────────────────────
function cleanupExpiredRequests() {
  const now = new Date();
  for (const [requestId, data] of pendingRequests.entries()) {
    if (data.expiresAt && new Date(data.expiresAt) < now) {
      pendingRequests.delete(requestId);
    }
  }
}

setInterval(cleanupExpiredRequests, 60000);

// ── GET /api/pending-requests ───────────────────────────────
app.get('/api/pending-requests', (req, res) => {
  const authToken = req.headers.authorization?.replace('Bearer ', '');

  if (!authToken || authToken !== process.env.API_AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing auth token' });
  }

  cleanupExpiredRequests();

  const requests = Array.from(pendingRequests.entries()).map(([id, data]) => ({
    requestId: id,
    ...data,
  }));

  res.json({ requests, count: requests.length });
});

// ── GET /health ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', sdk: 'shadowkey-agent-sdk@1.2.0', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 ShadowKey Express Server running on port ${PORT}`);
  console.log(`   Using shadowkey-agent-sdk for authenticated vault access`);
  console.log(`📋 Endpoints:`);
  console.log(`   POST   /api/request-data`);
  console.log(`   GET    /api/check-status/:requestId`);
  console.log(`   GET    /api/pending-requests`);
  console.log(`   GET    /health`);
});
