import { signRequest } from './erc8128';
import type { ERC8128SignerConfig } from './erc8128';
import type {
  AccessRequest,
  AccessResponse,
  DisclosureStatus,
  ReverseDisclosureRequest,
  ReverseDisclosureResponse,
} from './types';

export interface ERC8128ClientConfig {
  /** Base URL of the ShadowKey API */
  apiUrl: string;
  /** ERC-8128 signer — Ethereum wallet that signs each request */
  signerConfig: ERC8128SignerConfig;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * ERC8128ShadowKeyClient
 *
 * Drop-in alternative to ShadowKeyClient that authenticates each request
 * using ERC-8128 (RFC 9421 HTTP Message Signatures) instead of HMAC.
 *
 * Instead of a shared API key, the agent's Ethereum wallet signs every
 * outgoing request. The server verifies via ecrecover — no stored secrets,
 * no sessions, every request independently verifiable.
 *
 * Usage:
 *   import { ERC8128ShadowKeyClient } from '@shadowkey/agent-sdk';
 *
 *   const client = new ERC8128ShadowKeyClient({
 *     apiUrl: 'https://your-api.com/functions/v1',
 *     signerConfig: {
 *       address: wallet.address,
 *       sign: (msg) => wallet.signMessage(msg),
 *     },
 *   });
 *
 *   await client.requestAccess({ agentId: 'my-agent', ... });
 */
export class ERC8128ShadowKeyClient {
  private readonly apiUrl: string;
  private readonly signerConfig: ERC8128SignerConfig;
  private readonly timeout: number;
  private readonly debug: boolean;

  constructor(config: ERC8128ClientConfig) {
    if (!config.apiUrl) throw new Error('ERC8128ShadowKeyClient: apiUrl is required');
    if (!config.signerConfig?.address) throw new Error('ERC8128ShadowKeyClient: signerConfig.address is required');
    if (!config.signerConfig?.sign) throw new Error('ERC8128ShadowKeyClient: signerConfig.sign is required');

    this.apiUrl = config.apiUrl.replace(/\/$/, '');
    this.signerConfig = config.signerConfig;
    this.timeout = config.timeout ?? 30_000;
    this.debug = config.debug ?? false;
  }

  private log(...args: unknown[]) {
    if (this.debug) console.log('[ERC8128Client]', ...args);
  }

  private async makeRequest<T>(endpoint: string, method: string, body?: unknown): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;
    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;

    this.log(`${method} ${url}`);

    // Sign the request — this is the ERC-8128 auth primitive
    const erc8128Headers = await signRequest(this.signerConfig, {
      method,
      url,
      body: bodyStr,
    });

    this.log('Signature-Input:', erc8128Headers['Signature-Input']);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Agent's Ethereum address so the server knows whose key to verify against
      'X-Agent-Address': this.signerConfig.address,
      ...erc8128Headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: bodyStr,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
      throw new Error((err as { message?: string }).message || `HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  /** Request access to vault fields on behalf of the agent */
  async requestAccess(request: AccessRequest): Promise<AccessResponse> {
    return this.makeRequest<AccessResponse>('/sdk-access-request', 'POST', request);
  }

  /** Poll the status of a pending access request */
  async checkStatus(requestId: string): Promise<DisclosureStatus> {
    return this.makeRequest<DisclosureStatus>(`/sdk-access-status/${requestId}`, 'GET');
  }

  /** Submit a reverse disclosure (agent offers data to user) */
  async submitReverseDisclosure(request: ReverseDisclosureRequest): Promise<ReverseDisclosureResponse> {
    return this.makeRequest<ReverseDisclosureResponse>('/reverse-disclosure', 'POST', request);
  }

  /** Wait for an access request to be approved or denied */
  async waitForApproval(
    requestId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<DisclosureStatus> {
    const deadline = Date.now() + (options.timeoutMs ?? 300_000);
    const interval = options.pollIntervalMs ?? 2_000;

    while (Date.now() < deadline) {
      const status = await this.checkStatus(requestId);
      if (status.status === 'approved' || status.status === 'denied') return status;
      await new Promise(r => setTimeout(r, interval));
    }

    throw new Error('Approval timed out');
  }
}
