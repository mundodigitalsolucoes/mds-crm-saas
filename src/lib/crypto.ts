// src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const SECRET_HEX = process.env.TOKENS_SECRET;
if (!SECRET_HEX) throw new Error('TOKENS_SECRET não definido no .env');

const KEY = Buffer.from(SECRET_HEX, 'hex'); // 32 bytes (64 chars em hex)
if (KEY.length !== 32) {
  throw new Error('TOKENS_SECRET deve ter 32 bytes (64 chars em hex) para AES-256-GCM');
}

// Retorna string no formato: ivBase64.tagBase64.cipherBase64
export function encrypt(plain: string): string {
  const iv = randomBytes(12); // recomendado p/ GCM
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Token criptografado inválido');

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString('utf8');
}
