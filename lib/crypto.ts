/**
 * End-to-end encryption core.
 *
 * The room password NEVER leaves the browser and is NEVER sent to Supabase
 * in any form. Everything the server stores — messages, file blobs, display
 * names, the "verifier" used to gate the join screen — is derived or
 * encrypted client-side first.
 *
 * Key derivation:
 *   1. Each room has one random 16-byte `salt`, generated once at room
 *      creation and stored in the `rooms` table (salts are not secret —
 *      only the password is).
 *   2. From (password, salt) we derive TWO independent 256-bit values with
 *      PBKDF2-SHA256, distinguished only by an `info` string:
 *        - "nebula-verify-v1"  -> verifierHash  (stored in Supabase, lets the
 *                                 join screen tell right/wrong password apart)
 *        - "nebula-encrypt-v1" -> secretKey      (never stored anywhere,
 *                                 used for nacl.secretbox on every message
 *                                 and file)
 *   Because the two are derived independently, leaking verifierHash (which
 *   is by design public/readable) does not help recover secretKey.
 *
 * Message/file encryption: XSalsa20-Poly1305 via TweetNaCl's `secretbox`,
 * with a fresh random 24-byte nonce per encryption.
 */
import nacl from 'tweetnacl';
import {
  encodeBase64,
  decodeBase64,
  encodeUTF8,
  decodeUTF8,
} from 'tweetnacl-util';

const PBKDF2_ITERATIONS = 210_000;

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function randomSalt(len = 16): Uint8Array {
  return nacl.randomBytes(len);
}

export function slugifyRoomName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'room';
}

async function deriveMaterial(
  password: string,
  salt: Uint8Array,
  info: string,
  lengthBytes = 32
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const saltedInfo = concatBytes(salt, enc.encode(info));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltedInfo, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    passwordKey,
    lengthBytes * 8
  );
  return new Uint8Array(bits);
}

export async function deriveVerifier(password: string, salt: Uint8Array): Promise<string> {
  const material = await deriveMaterial(password, salt, 'nebula-verify-v1');
  return encodeBase64(material);
}

export async function deriveSecretKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return deriveMaterial(password, salt, 'nebula-encrypt-v1', nacl.secretbox.keyLength);
}

/** Constant-time-ish comparison for base64 verifier strings. */
export function verifiersMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type EncryptedPayload = { ciphertext: string; nonce: string };

export function encryptText(secretKey: Uint8Array, plaintext: string): EncryptedPayload {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(decodeUTF8(plaintext), nonce, secretKey);
  return { ciphertext: encodeBase64(box), nonce: encodeBase64(nonce) };
}

export function decryptText(
  secretKey: Uint8Array,
  ciphertext: string,
  nonce: string
): string | null {
  try {
    const opened = nacl.secretbox.open(
      decodeBase64(ciphertext),
      decodeBase64(nonce),
      secretKey
    );
    if (!opened) return null;
    return encodeUTF8(opened);
  } catch {
    return null;
  }
}

export function encryptJSON<T>(secretKey: Uint8Array, value: T): EncryptedPayload {
  return encryptText(secretKey, JSON.stringify(value));
}

export function decryptJSON<T>(
  secretKey: Uint8Array,
  ciphertext: string,
  nonce: string
): T | null {
  const text = decryptText(secretKey, ciphertext, nonce);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function encryptBytes(secretKey: Uint8Array, data: Uint8Array): EncryptedPayload {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(data, nonce, secretKey);
  return { ciphertext: encodeBase64(box), nonce: encodeBase64(nonce) };
}

export function decryptBytes(
  secretKey: Uint8Array,
  ciphertext: string,
  nonce: string
): Uint8Array | null {
  try {
    return nacl.secretbox.open(decodeBase64(ciphertext), decodeBase64(nonce), secretKey);
  } catch {
    return null;
  }
}

/**
 * Raw (non-base64) variants for large binary payloads — used for file
 * uploads so we don't pay base64's ~33% size overhead in Supabase Storage.
 * The nonce is small, so it's still carried as base64 inside the (encrypted)
 * file metadata JSON rather than as its own storage object.
 */
export function encryptRawBytes(
  secretKey: Uint8Array,
  data: Uint8Array
): { cipher: Uint8Array; nonce: Uint8Array } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const cipher = nacl.secretbox(data, nonce, secretKey);
  return { cipher, nonce };
}

export function decryptRawBytes(
  secretKey: Uint8Array,
  cipher: Uint8Array,
  nonce: Uint8Array
): Uint8Array | null {
  try {
    return nacl.secretbox.open(cipher, nonce, secretKey);
  } catch {
    return null;
  }
}

/** Small helper: derive a stable but non-identifying per-session id. */
export function randomId(): string {
  return encodeBase64(nacl.randomBytes(12)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
}
