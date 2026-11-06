import crypto from 'crypto';

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = 62;
const CODE_LENGTH = 8;
const MAX_RETRIES = 10;

/**
 * Generates a cryptographically secure Base62 short code.
 * Uses unbiased sampling via crypto.randomInt to avoid modulo bias.
 */
export function generateShortCode(length: number = CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    // crypto.randomInt is unbiased (unlike Math.random() % BASE)
    const index = crypto.randomInt(0, BASE);
    code += BASE62_ALPHABET[index];
  }
  return code;
}

/**
 * Validates that a string contains only valid Base62 characters.
 */
export function isValidBase62(code: string): boolean {
  return /^[0-9A-Za-z]+$/.test(code);
}

export { BASE62_ALPHABET, BASE, CODE_LENGTH, MAX_RETRIES };
