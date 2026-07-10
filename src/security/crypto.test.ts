import { describe, expect, it } from 'vitest';
import { hashPin, validatePinFormat, verifyPin } from './crypto';

describe('PIN seguro', () => {
  it('acepta únicamente entre cuatro y ocho dígitos', () => {
    expect(validatePinFormat('1234')).toBe(true);
    expect(validatePinFormat('12345678')).toBe(true);
    expect(validatePinFormat('123')).toBe(false);
    expect(validatePinFormat('123456789')).toBe(false);
    expect(validatePinFormat('12a4')).toBe(false);
  });

  it('genera un hash PBKDF2 verificable sin conservar el PIN', async () => {
    const encoded = await hashPin('4826');
    expect(encoded.startsWith('pbkdf2$')).toBe(true);
    expect(encoded.includes('4826')).toBe(false);
    await expect(verifyPin('4826', encoded)).resolves.toBe(true);
    await expect(verifyPin('4827', encoded)).resolves.toBe(false);
  });

  it('utiliza una sal diferente para el mismo PIN', async () => {
    const first = await hashPin('4826');
    const second = await hashPin('4826');
    expect(first).not.toBe(second);
  });
});
