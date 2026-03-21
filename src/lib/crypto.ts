const PBKDF2_ITERATIONS = 600_000;
const KEY_LENGTH = 256;

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(
  data: string,
  password: string
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16)).buffer;
  const iv = crypto.getRandomValues(new Uint8Array(12)).buffer;
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const ciphertextBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(data));
  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
  };
}

export async function decryptData(
  ciphertext: string,
  iv: string,
  salt: string,
  password: string
): Promise<string> {
  const key = await deriveKey(password, base64ToBuffer(salt));
  const dec = new TextDecoder();
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBuffer(iv) },
    key,
    base64ToBuffer(ciphertext)
  );
  return dec.decode(plaintextBuffer);
}

export function generateAccessToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bufferToBase64(bytes.buffer);
}
