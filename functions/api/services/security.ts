import { SignJWT, jwtVerify } from 'jose';

const DEFAULT_SECRET = 'temporary-dev-secret-change-this-in-prod';
const ALG = 'HS256';

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  );
  const exportedKey = (await crypto.subtle.exportKey('raw', key)) as ArrayBuffer;
  return `${buf2hex(salt)}:${buf2hex(exportedKey)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, originalHash] = storedHash.split(':');
  if (!saltHex || !originalHash) return false;
  const salt = hex2buf(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  );
  const exportedKey = (await crypto.subtle.exportKey('raw', key)) as ArrayBuffer;
  return buf2hex(exportedKey) === originalHash;
}

export async function generateToken(payload: any, secret?: string): Promise<string> {
  const secretKey = new TextEncoder().encode(secret || DEFAULT_SECRET);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secretKey);
}

export async function verifyToken(token: string, secret?: string): Promise<any> {
  const secretKey = new TextEncoder().encode(secret || DEFAULT_SECRET);
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    return null;
  }
}

// UTILS
function buf2hex(buffer: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function hex2buf(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
}