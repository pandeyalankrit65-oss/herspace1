// Encryption for the private record (abuse at home). Everything is encrypted on her phone; the
// server keeps only ciphertext. A random record key encrypts the entries; it's stored on the
// server "wrapped" (encrypted) twice: once with a key from her PIN, once with a key from a
// recovery code she writes down. The server also gets a separate proof derived from the PIN, so
// it can refuse to hand out the wrapped key after a few wrong tries: someone holding her phone
// can't keep guessing.

const ITERATIONS = 310_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

// In chunks: spreading a large array into one call overflows the stack.
export function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function derive(secret: string, salt: Uint8Array, purpose: "proof" | "wrap"): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
  // The purpose goes in the salt, so the proof sent to the server says nothing about the wrapping key.
  const purposed = new Uint8Array([...salt, ...enc.encode(purpose)]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: purposed, iterations: ITERATIONS }, base, 256));
}

const aesKey = (raw: Uint8Array, usages: KeyUsage[]) => crypto.subtle.importKey("raw", raw, "AES-GCM", false, usages);

async function seal(key: CryptoKey, data: Uint8Array) {
  const iv = random(12);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  return { iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
}

async function open(key: CryptoKey, sealed: { iv: string; ciphertext: string }) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(sealed.iv) }, key, fromBase64(sealed.ciphertext)));
}

export type Sealed = { iv: string; ciphertext: string };
export type Wrapped = { salt: string; proof: string; wrappedKey: Sealed };

// What the server keeps for one secret (PIN or recovery code): a salt, a proof to check, and the
// record key wrapped with a key only that secret can make.
async function wrapWith(secret: string, recordKey: Uint8Array): Promise<Wrapped> {
  const salt = random(16);
  const [proof, wrapRaw] = await Promise.all([derive(secret, salt, "proof"), derive(secret, salt, "wrap")]);
  return { salt: toBase64(salt), proof: toBase64(proof), wrappedKey: await seal(await aesKey(wrapRaw, ["encrypt"]), recordKey) };
}

// A new record: a random key, wrapped for the PIN and for a recovery code shown once.
export async function createRecordKeys(pin: string) {
  const recordKey = random(32);
  const recoveryCode = makeRecoveryCode();
  const [byPin, byRecovery] = await Promise.all([wrapWith(pin, recordKey), wrapWith(normaliseRecovery(recoveryCode), recordKey)]);
  return { recoveryCode, byPin, byRecovery, key: await aesKey(recordKey, ["encrypt", "decrypt"]), rawKey: recordKey };
}

// The proof the server checks before releasing the wrapped key.
export async function proofFor(secret: string, salt: string) {
  return toBase64(await derive(secret, fromBase64(salt), "proof"));
}

// Unwraps the record key with the PIN (or recovery code). Throws if it's wrong.
export async function unwrapRecordKey(secret: string, salt: string, wrappedKey: Sealed) {
  const wrapRaw = await derive(secret, fromBase64(salt), "wrap");
  const rawKey = await open(await aesKey(wrapRaw, ["decrypt"]), wrappedKey);
  return { key: await aesKey(rawKey, ["encrypt", "decrypt"]), rawKey };
}

// A new PIN for the same record (after recovery, or to change it).
export const rewrapForPin = (pin: string, rawKey: Uint8Array) => wrapWith(pin, rawKey);

export const encryptJson = (key: CryptoKey, value: unknown) => seal(key, enc.encode(JSON.stringify(value)));
export const decryptJson = async <T>(key: CryptoKey, sealed: Sealed): Promise<T> => JSON.parse(dec.decode(await open(key, sealed))) as T;
// Files (photos) stay as bytes, not text.
export async function encryptBytes(key: CryptoKey, data: Uint8Array) {
  const iv = random(12);
  return { iv: toBase64(iv), bytes: new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data)) };
}
export async function decryptBytes(key: CryptoKey, iv: string, bytes: Uint8Array) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, bytes));
}

// 20 letters and digits in groups of 4, without look-alikes (0/O, 1/I/L): easy to write down.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function makeRecoveryCode() {
  const bytes = random(20);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return [0, 4, 8, 12, 16].map((i) => chars.slice(i, i + 4).join("")).join("-");
}
export const normaliseRecovery = (code: string) => code.toUpperCase().replace(/[^0-9A-Z]/g, "");

// At least 6 digits, or a longer passphrase.
export const pinIsStrongEnough = (pin: string) => (/^\d+$/.test(pin) ? pin.length >= 6 : pin.length >= 8);
