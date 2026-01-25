import { webcrypto } from 'node:crypto';

// Configuration
const EMAIL = 'admin@demo.com';
const PASSWORD = 'password123';
const TENANT_ID = 'tenant-1';

async function generateHash(password) {
  const enc = new TextEncoder();
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await webcrypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
  );
  const key = await webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  );
  const exportedKey = await webcrypto.subtle.exportKey('raw', key);
  
  const toHex = (buf) => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${toHex(salt)}:${toHex(exportedKey)}`;
}

(async () => {
  const hash = await generateHash(PASSWORD);
  const userId = webcrypto.randomUUID();
  
  const sql = `
    INSERT INTO users (user_id, tenant_id, email, password_hash, role, status)
    VALUES ('${userId}', '${TENANT_ID}', '${EMAIL}', '${hash}', 'admin', 'active');
  `;
  
  console.log("\n✅ COPY AND RUN THIS COMMAND:");
  console.log(`npx wrangler d1 execute llnd-core-db --local --command "${sql.replace(/\n/g, ' ').trim()}"`);
})();