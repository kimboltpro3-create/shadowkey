/**
 * ERC-8128: Signed HTTP Requests with Ethereum
 *
 * Built on RFC 9421 (IETF HTTP Message Signatures).
 * Each HTTP request is signed with an Ethereum key — no sessions,
 * no stored API keys. The signature IS the auth credential.
 *
 * Compared to SIWE:
 *   SIWE     = one-time login → server-issued session token
 *   ERC-8128 = every request signed → continuous cryptographic proof
 *
 * Works for:
 *   - EOAs:  ecrecover via ethers verifyMessage
 *   - Smart contract wallets: ERC-1271 isValidSignature (extension point)
 *
 * No new dependencies — uses globalThis.crypto.subtle (same as crypto.ts).
 * ethers is imported dynamically for verifyMessage (tree-shake friendly).
 */

export interface ERC8128Headers {
  'Content-Digest'?: string;
  'Signature-Input': string;
  'Signature': string;
}

export interface ERC8128SignerConfig {
  /**
   * Signing function. Receives the RFC 9421 signature base string,
   * returns a hex Ethereum signature (with or without 0x prefix).
   *
   * Browser:  (msg) => window.ethereum.request({ method: 'personal_sign', params: [msg, address] })
   * Node.js:  (msg) => wallet.signMessage(msg)    // ethers Wallet
   */
  sign: (message: string) => Promise<string>;
  /** Ethereum address corresponding to the signing key */
  address: string;
  /** Optional key ID for Signature-Input (defaults to address) */
  keyId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 body digest for the Content-Digest header.
 * Returns: `sha-256=:<base64>:`  (RFC 9421 §2.4 format)
 */
export async function computeContentDigest(body: string): Promise<string> {
  const data = new TextEncoder().encode(body);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  return `sha-256=:${bufferToBase64(hashBuffer)}:`;
}

/**
 * Build the RFC 9421 signature base string and corresponding
 * Signature-Input header value.
 *
 * Covered components: @method, @path, @authority, content-digest (POST only)
 */
export function buildSignatureBase(params: {
  method: string;
  url: string;
  contentDigest?: string;
  created: number;
  nonce: string;
  keyId: string;
}): { base: string; signatureInput: string } {
  const urlObj = new URL(params.url);
  const method = params.method.toUpperCase();
  const path = urlObj.pathname + urlObj.search;
  const authority = urlObj.host;

  // Covered components list (RFC 9421 §2.1)
  const components: string[] = ['"@method"', '"@path"', '"@authority"'];
  if (params.contentDigest) {
    components.push('"content-digest"');
  }

  // Signature-Input header (RFC 9421 §4.1)
  // Format: sig1=(<components>);created=<unix>;nonce="<hex>";keyid="<address>"
  const sigParamsValue = `(${components.join(' ')});created=${params.created};nonce="${params.nonce}";keyid="${params.keyId}"`;
  const signatureInput = `sig1=${sigParamsValue}`;

  // Signature base string (RFC 9421 §2.5)
  // Each covered component: `"name": value\n`
  // Final line: `"@signature-params": <sigParamsValue>`
  const lines: string[] = [
    `"@method": ${method}`,
    `"@path": ${path}`,
    `"@authority": ${authority}`,
  ];
  if (params.contentDigest) {
    lines.push(`"content-digest": ${params.contentDigest}`);
  }
  lines.push(`"@signature-params": ${sigParamsValue}`);

  return {
    base: lines.join('\n'), // LF only — required by RFC 9421
    signatureInput,
  };
}

/**
 * Sign an HTTP request using ERC-8128.
 * Returns the headers to attach to the outgoing request.
 */
export async function signRequest(
  config: ERC8128SignerConfig,
  request: { method: string; url: string; body?: string }
): Promise<ERC8128Headers> {
  const created = Math.floor(Date.now() / 1000);
  const nonce = randomHex(8);
  const keyId = config.keyId ?? config.address;

  let contentDigest: string | undefined;
  if (request.body && request.method.toUpperCase() !== 'GET') {
    contentDigest = await computeContentDigest(request.body);
  }

  const { base, signatureInput } = buildSignatureBase({
    method: request.method,
    url: request.url,
    contentDigest,
    created,
    nonce,
    keyId,
  });

  // Ethereum personal_sign prepends the standard prefix automatically
  // (both MetaMask personal_sign and ethers Wallet.signMessage do this)
  const rawSig = await config.sign(base);
  const sigHex = rawSig.startsWith('0x') ? rawSig.slice(2) : rawSig;
  const sigB64 = bufferToBase64(hexToBuffer(sigHex));

  const headers: ERC8128Headers = {
    'Signature-Input': signatureInput,
    'Signature': `sig1=:${sigB64}:`,
  };
  if (contentDigest) {
    headers['Content-Digest'] = contentDigest;
  }

  return headers;
}

/**
 * Verify an ERC-8128 signed request.
 * Returns the recovered Ethereum address (lowercased).
 * Throws if:
 *   - The request is older than 5 minutes (freshness window)
 *   - The signature is malformed
 *   - ethers verifyMessage fails
 */
export async function verifyRequest(params: {
  method: string;
  url: string;
  signatureInput: string;
  signature: string;
  contentDigest?: string;
}): Promise<string> {
  // Parse Signature-Input: sig1=(<components>);created=...;nonce="...";keyid="..."
  const sigParamsValue = params.signatureInput.replace(/^sig1=/, '');

  const createdMatch = sigParamsValue.match(/created=(\d+)/);
  const nonceMatch   = sigParamsValue.match(/nonce="([^"]+)"/);
  const keyidMatch   = sigParamsValue.match(/keyid="([^"]+)"/);

  if (!createdMatch) throw new Error('ERC-8128: Missing created in Signature-Input');
  const created = parseInt(createdMatch[1], 10);
  const nonce   = nonceMatch?.[1]  ?? '';
  const keyId   = keyidMatch?.[1] ?? '';

  // Freshness check — reject stale requests (replay protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - created) > 300) {
    throw new Error('ERC-8128: Request signature expired (> 5 minutes)');
  }

  // Rebuild the signature base string
  const { base } = buildSignatureBase({
    method: params.method,
    url: params.url,
    contentDigest: params.contentDigest,
    created,
    nonce,
    keyId,
  });

  // Decode signature: `sig1=:<base64>:` → hex
  const sigValue = params.signature.replace(/^sig1=:|:$/g, '');
  const sigBuffer = base64ToBuffer(sigValue);
  const sigHex = '0x' + bufferToHex(sigBuffer);

  // Recover Ethereum address — dynamic import keeps this tree-shake friendly
  const { verifyMessage } = await import('ethers');
  const recovered = verifyMessage(base, sigHex);
  return recovered.toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  return bufferToHex(arr.buffer);
}
