const ITERATIONS = 150_000;
const HASH_ALGORITHM = 'SHA-256';

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

const derive = async (pin: string, salt: Uint8Array, iterations: number) => {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: HASH_ALGORITHM,
      salt: asArrayBuffer(salt),
      iterations,
    },
    material,
    256,
  );
  return new Uint8Array(bits);
};

const constantTimeEqual = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
};

export const validatePinFormat = (pin: string) => /^\d{4,8}$/.test(pin);

export const hashPin = async (pin: string): Promise<string> => {
  if (!validatePinFormat(pin)) throw new Error('El PIN debe contener entre 4 y 8 números.');
  if (!globalThis.crypto?.subtle) throw new Error('Este dispositivo no permite proteger el PIN de forma segura.');

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
};

export const verifyPin = async (pin: string, encoded: string): Promise<boolean> => {
  try {
    const [scheme, iterationsText, saltText, hashText] = encoded.split('$');
    if (scheme !== 'pbkdf2') return false;
    const iterations = Number(iterationsText);
    if (!Number.isInteger(iterations) || iterations < 100_000) return false;
    const expected = base64ToBytes(hashText);
    const actual = await derive(pin, base64ToBytes(saltText), iterations);
    return constantTimeEqual(expected, actual);
  } catch {
    return false;
  }
};
