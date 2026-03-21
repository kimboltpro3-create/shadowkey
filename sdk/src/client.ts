import type {
  ShadowKeyConfig,
  AccessRequest,
  AccessResponse,
  ReverseDisclosureRequest,
  ReverseDisclosureResponse,
  DisclosureStatus,
  APIError,
  RequestMetadata
} from './types';

export class ShadowKeyClient {
  private config: Required<ShadowKeyConfig>;

  constructor(config: ShadowKeyConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      debug: false,
      ...config
    };

    if (!this.config.apiUrl) {
      throw new Error('apiUrl is required');
    }
    if (!this.config.apiKey) {
      throw new Error('apiKey is required');
    }
  }

  private log(message: string, data?: any) {
    if (this.config.debug) {
      if (data && typeof data === 'object') {
        // Redact sensitive fields from logging
        const sanitized = { ...data };
        const sensitiveFields = ['grantedData', 'grantedFields', 'response_data', 'decrypted_data'];
        sensitiveFields.forEach(field => {
          if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
          }
        });
        console.log('[ShadowKey SDK]', message, sanitized);
      } else {
        console.log('[ShadowKey SDK]', message, data);
      }
    }
  }

  private async generateSignature(payload: any): Promise<RequestMetadata> {
    const timestamp = Date.now();

    // Works in both browser and Node.js 18+ (globalThis.crypto available)
    const nonceBytes = new Uint8Array(12);
    globalThis.crypto.getRandomValues(nonceBytes);
    const nonce = Array.from(nonceBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const message = JSON.stringify({ ...payload, timestamp, nonce });
    const encoder = new TextEncoder();
    const data = encoder.encode(message + this.config.apiKey);

    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return { timestamp, nonce, signature };
  }

  private async makeRequest<T>(
    endpoint: string,
    method: string,
    body?: any,
    attempt: number = 1
  ): Promise<T> {
    const metadata = await this.generateSignature(body || {});
    const url = `${this.config.apiUrl}${endpoint}`;

    this.log(`${method} ${url}`, body);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Timestamp': metadata.timestamp.toString(),
          'X-Nonce': metadata.nonce,
          'X-Signature': metadata.signature
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error: APIError = await response.json().catch(() => ({
          code: 'UNKNOWN_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`
        }));

        // Don't retry client errors (4xx) as they won't succeed on retry
        const isClientError = response.status >= 400 && response.status < 500;
        if (isClientError) {
          const err = new Error(error.message || 'Request failed');
          (err as any).isClientError = true;
          throw err;
        }

        throw new Error(error.message || 'Request failed');
      }

      const data = await response.json();
      this.log('Response:', data);
      return data;

    } catch (error: any) {
      this.log('Request failed:', error.message);

      // Don't retry client errors or AbortError
      const shouldRetry = attempt < this.config.retryAttempts
        && error.name !== 'AbortError'
        && !error.isClientError;

      if (shouldRetry) {
        const delay = Math.pow(2, attempt) * 1000;
        this.log(`Retrying in ${delay}ms...`, { attempt: attempt + 1, max: this.config.retryAttempts });
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest<T>(endpoint, method, body, attempt + 1);
      }

      throw error;
    }
  }

  async requestAccess(request: AccessRequest): Promise<AccessResponse> {
    return this.makeRequest<AccessResponse>('/sdk-access-request', 'POST', request);
  }

  async checkStatus(requestId: string): Promise<DisclosureStatus> {
    return this.makeRequest<DisclosureStatus>(`/sdk-access-status/${requestId}`, 'GET');
  }

  async submitReverseDisclosure(request: ReverseDisclosureRequest): Promise<ReverseDisclosureResponse> {
    return this.makeRequest<ReverseDisclosureResponse>('/reverse-disclosure', 'POST', request);
  }

  async waitForApproval(
    requestId: string,
    maxWaitMs: number = 300000,
    pollIntervalMs: number = 2000
  ): Promise<AccessResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkStatus(requestId);

      if (status.status === 'approved') {
        return {
          requestId,
          status: 'approved',
          grantedFields: status.grantedFields || [],
          grantedData: status.grantedData || {},
          expiresAt: status.expiresAt,
          message: 'Access granted'
        };
      }

      if (status.status === 'denied') {
        return {
          requestId,
          status: 'denied',
          message: 'Access denied by user'
        };
      }

      if (status.status === 'expired') {
        return {
          requestId,
          status: 'expired',
          message: 'Request expired'
        };
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('Timeout waiting for approval');
  }
}
