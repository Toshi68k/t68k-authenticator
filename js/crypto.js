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
    const nameLower = clean.toLowerCase();
    const brands = [
      { key: 'amazon web services', color: '#ec7211' },
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

  global.T68kAuthCrypto = {
    base32Decode,
    isValidBase32,
    generateTOTP,
    formatCode,
    getValidityInfo,
    parseOTPAuthURI,
    getIssuerBrandInfo
  };
})(typeof window !== 'undefined' ? window : this);
