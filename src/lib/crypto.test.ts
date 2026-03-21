import { describe, it, expect } from 'vitest';
import { encryptData, decryptData } from './crypto';

describe('AES-256-GCM crypto layer', () => {
  it('round-trips plaintext correctly', async () => {
    const plaintext = 'my secret credit card: 4532 •••• •••• 7891';
    const password = 'hunter2';
    const { ciphertext, iv, salt } = await encryptData(plaintext, password);
    const result = await decryptData(ciphertext, iv, salt, password);
    expect(result).toBe(plaintext);
  });

  it('throws on wrong password (AES-GCM auth tag mismatch)', async () => {
    const { ciphertext, iv, salt } = await encryptData('sensitive data', 'correct-password');
    await expect(
      decryptData(ciphertext, iv, salt, 'wrong-password')
    ).rejects.toThrow();
  });

  it('produces unique ciphertext on each call (random salt + IV)', async () => {
    const plaintext = 'same input';
    const password = 'same-password';
    const first = await encryptData(plaintext, password);
    const second = await encryptData(plaintext, password);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.iv).not.toBe(second.iv);
    expect(first.salt).not.toBe(second.salt);
  });

  it('different passwords produce different ciphertext', async () => {
    const plaintext = 'the same plaintext';
    const a = await encryptData(plaintext, 'password-alpha');
    const b = await encryptData(plaintext, 'password-beta');
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('handles unicode and emoji correctly', async () => {
    const plaintext = '🔐 secret: 日本語 — café résumé';
    const password = 'unicode-test';
    const { ciphertext, iv, salt } = await encryptData(plaintext, password);
    const result = await decryptData(ciphertext, iv, salt, password);
    expect(result).toBe(plaintext);
  });
});
