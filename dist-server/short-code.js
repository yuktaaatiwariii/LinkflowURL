"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_RETRIES = exports.CODE_LENGTH = exports.BASE = exports.BASE62_ALPHABET = void 0;
exports.generateShortCode = generateShortCode;
exports.isValidBase62 = isValidBase62;
const crypto_1 = __importDefault(require("crypto"));
const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
exports.BASE62_ALPHABET = BASE62_ALPHABET;
const BASE = 62;
exports.BASE = BASE;
const CODE_LENGTH = 8;
exports.CODE_LENGTH = CODE_LENGTH;
const MAX_RETRIES = 10;
exports.MAX_RETRIES = MAX_RETRIES;
/**
 * Generates a cryptographically secure Base62 short code.
 * Uses unbiased sampling via crypto.randomInt to avoid modulo bias.
 */
function generateShortCode(length = CODE_LENGTH) {
    let code = '';
    for (let i = 0; i < length; i++) {
        // crypto.randomInt is unbiased (unlike Math.random() % BASE)
        const index = crypto_1.default.randomInt(0, BASE);
        code += BASE62_ALPHABET[index];
    }
    return code;
}
/**
 * Validates that a string contains only valid Base62 characters.
 */
function isValidBase62(code) {
    return /^[0-9A-Za-z]+$/.test(code);
}
