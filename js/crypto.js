/**
 * T68k Authenticator - Cryptographic & URI Engine
 * RFC 6238 (TOTP) and RFC 4226 (HOTP) implementation using Web Crypto API (crypto.subtle)
 */

(function (global) {
  'use strict';

  const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  /**
   * Decodes a Base32 string into a Uint8Array.
   * Strips spaces, dashes, and padding '='. Case-insensitive.
   */
  function base32Decode(str) {
    if (!str || typeof str !== 'string') {
      throw new Error('Invalid Base32 secret');
    }

    const cleanStr = str.toUpperCase().replace(/[\s\-_=]/g, '');
    if (cleanStr.length === 0) {
      throw new Error('Empty secret key');
    }

    let bits = 0;
    let value = 0;
    const output = [];

    for (let i = 0; i < cleanStr.length; i++) {
      const char = cleanStr[i];
      const val = BASE32_CHARS.indexOf(char);
      if (val === -1) {
        throw new Error(`Invalid Base32 character: "${char}"`);
      }

      value = (value << 5) | val;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return new Uint8Array(output);
  }

  /**
   * Validates if a secret key is valid Base32.
   */
  function isValidBase32(str) {
    try {
      base32Decode(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generates a TOTP code for a given secret at a specific epoch time (seconds).
   * @param {string} secret - Base32 encoded secret.
   * @param {Object} options - Optional configuration { algorithm, digits, period, epoch }.
   * @returns {Promise<string>} - e.g. "123456"
   */
  async function generateTOTP(secret, options = {}) {
    const algorithm = (options.algorithm || 'SHA-1').toUpperCase();
    const digits = parseInt(options.digits, 10) || 6;
    const period = parseInt(options.period, 10) || 30;
    const epoch = options.epoch !== undefined ? options.epoch : Math.floor(Date.now() / 1000);

    const secretBytes = base32Decode(secret);
    const counter = Math.floor(epoch / period);

    // 8-byte big-endian counter buffer
    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    // Upper 32 bits
    counterView.setUint32(0, Math.floor(counter / 0x100000000), false);
    // Lower 32 bits
    counterView.setUint32(4, counter & 0xffffffff, false);

    // Map algorithm name to Web Crypto subtle format
    let subtleAlgo;
    if (algorithm === 'SHA-256' || algorithm === 'SHA256') {
      subtleAlgo = 'SHA-256';
    } else if (algorithm === 'SHA-512' || algorithm === 'SHA512') {
      subtleAlgo = 'SHA-512';
    } else {
      subtleAlgo = 'SHA-1';
    }

    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: { name: subtleAlgo } },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, counterBuffer);
    const hmacBytes = new Uint8Array(signature);

    // Dynamic truncation (RFC 4226)
    const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
    const binaryCode =
      ((hmacBytes[offset] & 0x7f) << 24) |
      ((hmacBytes[offset + 1] & 0xff) << 16) |
      ((hmacBytes[offset + 2] & 0xff) << 8) |
      (hmacBytes[offset + 3] & 0xff);

    const otp = binaryCode % Math.pow(10, digits);
    return otp.toString().padStart(digits, '0');
  }

  /**
   * Formats a raw TOTP code (e.g. "123456" -> "123 456" or "12345678" -> "1234 5678")
   */
  function formatCode(code) {
    if (!code) return '--- ---';
    if (code.length === 6) {
      return `${code.slice(0, 3)} ${code.slice(3)}`;
    }
    if (code.length === 8) {
      return `${code.slice(0, 4)} ${code.slice(4)}`;
    }
    return code;
  }

  /**
   * Computes remaining validity seconds and progress (0.0 to 1.0)
   */
  function getValidityInfo(period = 30) {
    const now = Math.floor(Date.now() / 1000);
    const remaining = period - (now % period);
    const elapsed = now % period;
    const progress = remaining / period;
    return {
      remaining,
      elapsed,
      progress,
      period
    };
  }

  /**
   * Parses an otpauth:// URL into an account object.
   * Format: otpauth://totp/[Issuer:]Account?secret=...&issuer=...&algorithm=...&digits=...&period=...
   */
  function parseOTPAuthURI(uriString) {
    if (!uriString || typeof uriString !== 'string') {
      throw new Error('Invalid OTP Auth URI');
    }

    const trimmed = uriString.trim();
    if (!trimmed.toLowerCase().startsWith('otpauth://')) {
      throw new Error('URI must start with otpauth://');
    }

    const url = new URL(trimmed);
    const type = url.host.toLowerCase(); // 'totp' or 'hotp'
    if (type !== 'totp') {
      // We primarily handle TOTP
      console.warn('Handling type:', type);
    }

    // Path represents label: /Issuer:Account or /Account
    let label = decodeURIComponent(url.pathname.replace(/^\//, ''));
    let issuerFromLabel = '';
    let account = label;

    if (label.includes(':')) {
      const parts = label.split(':');
      issuerFromLabel = parts[0].trim();
      account = parts.slice(1).join(':').trim();
    }

    const params = url.searchParams;
    const secret = params.get('secret');
    if (!secret) {
      throw new Error('Missing "secret" parameter in URI');
    }

    const issuer = params.get('issuer') || issuerFromLabel || 'Account';
    const algorithm = (params.get('algorithm') || 'SHA1').toUpperCase();
    const digits = parseInt(params.get('digits'), 10) || 6;
    const period = parseInt(params.get('period'), 10) || 30;

    return {
      issuer,
      account: account || issuer,
      secret: secret.trim(),
      algorithm,
      digits,
      period
    };
  }

  /**
   * Generates brand colors / initial badges for an issuer.
   */
  function getIssuerBrandInfo(issuerName = '') {
    const clean = issuerName.trim();
    const initial = (clean.charAt(0) || '?').toUpperCase();

    // Curated brand color mapping
    // Add your own issuer -> color mappings here
    const brands = [
      { key: 'amazon web services', color: '#ec7211' },
      { key: 'aws', color: '#ec7211' },
    ];

    for (const b of brands) {
      if (nameLower.includes(b.key)) {
        return { initial, color: b.color, brand: b.key };
      }
    }

    // Deterministic palette generation from name string
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hues = [160, 190, 220, 260, 290, 330, 30, 45];
    const hue = hues[Math.abs(hash) % hues.length];
    return {
      initial,
      color: `hsl(${hue}, 75%, 55%)`,
      brand: null
    };
  }

  /**
   * Converts Uint8Array to base64 string
   */
  function bytesToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Converts base64 string to Uint8Array
   */
  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Encrypts plaintext string using AES-GCM (256-bit) and PBKDF2 key derivation.
   * @param {string} plainText
   * @param {string} password
   * @returns {Promise<Object>}
   */
  async function encryptData(plainText, password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password is required for encryption');
    }

    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iterations = 100000;

    const passwordKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      enc.encode(plainText)
    );

    return {
      version: 1,
      encrypted: true,
      exportedAt: new Date().toISOString(),
      generator: 'T68k Authenticator Chrome Extension',
      crypto: {
        algorithm: 'AES-GCM',
        kdf: 'PBKDF2',
        hash: 'SHA-256',
        iterations,
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv)
      },
      cipherText: bytesToBase64(new Uint8Array(cipherBuffer))
    };
  }

  /**
   * Decrypts an encrypted envelope using AES-GCM and password.
   * @param {Object} envelope
   * @param {string} password
   * @returns {Promise<string>} Plaintext string
   */
  async function decryptData(envelope, password) {
    if (!envelope || !envelope.cipherText || !envelope.crypto) {
      throw new Error('Invalid encrypted backup format');
    }
    if (!password || typeof password !== 'string') {
      throw new Error('Password is required for decryption');
    }

    const { salt, iv, iterations = 100000, hash = 'SHA-256' } = envelope.crypto;
    const saltBytes = base64ToBytes(salt);
    const ivBytes = base64ToBytes(iv);
    const cipherBytes = base64ToBytes(envelope.cipherText);

    const enc = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations,
        hash
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    try {
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBytes },
        derivedKey,
        cipherBytes
      );
      const dec = new TextDecoder();
      return dec.decode(decryptedBuffer);
    } catch (e) {
      throw new Error('Incorrect password or corrupted backup file');
    }
  }

  global.T68kAuthCrypto = {
    base32Decode,
    isValidBase32,
    generateTOTP,
    formatCode,
    getValidityInfo,
    parseOTPAuthURI,
    getIssuerBrandInfo,
    bytesToBase64,
    base64ToBytes,
    encryptData,
    decryptData
  };
})(typeof window !== 'undefined' ? window : this);
