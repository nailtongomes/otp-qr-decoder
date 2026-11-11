(function (root) {
  const OtpTool = root.OtpTool || (root.OtpTool = {});
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  function codeError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  function normalizeBase32(input) {
    return String(input || "")
      .replace(/[\s-]/g, "")
      .replace(/=+$/g, "")
      .toUpperCase();
  }

  function base32Decode(input) {
    const text = normalizeBase32(input);
    if (!text || /[^A-Z2-7]/.test(text)) throw codeError("badOtp");
    let bits = 0;
    let value = 0;
    const out = [];
    for (let i = 0; i < text.length; i += 1) {
      const idx = ALPHABET.indexOf(text.charAt(i));
      if (idx < 0) throw codeError("badOtp");
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        out.push((value >>> bits) & 0xff);
      }
    }
    if (!out.length) throw codeError("badOtp");
    return new Uint8Array(out);
  }

  function base32Encode(bytes) {
    let bits = 0;
    let value = 0;
    let out = "";
    for (let i = 0; i < bytes.length; i += 1) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        out += ALPHABET.charAt((value >>> bits) & 31);
      }
    }
    if (bits > 0) out += ALPHABET.charAt((value << (5 - bits)) & 31);
    return out;
  }

  function counterBytes(counter) {
    let value = BigInt(counter);
    if (value < 0n) throw codeError("badOtp");
    const out = new Uint8Array(8);
    for (let i = 7; i >= 0; i -= 1) {
      out[i] = Number(value & 0xffn);
      value >>= 8n;
    }
    return out;
  }

  function hashName(algorithm) {
    if (algorithm === "SHA1") return "SHA-1";
    if (algorithm === "SHA256") return "SHA-256";
    if (algorithm === "SHA512") return "SHA-512";
    throw codeError(algorithm === "MD5" ? "unsupportedAlgo" : "badOtp");
  }

  function timeStep(nowMs, period) {
    const step = BigInt(period);
    if (step <= 0n) throw codeError("badOtp");
    const seconds = BigInt(Math.floor(Number(nowMs) / 1000));
    return seconds / step;
  }

  async function hotp(secret, counter, options) {
    const opts = options || {};
    const algorithm = opts.algorithm || "SHA1";
    const digits = opts.digits || 6;
    if (!root.crypto || !root.crypto.subtle) throw codeError("no-webcrypto");
    const key = await root.crypto.subtle.importKey(
      "raw",
      secret,
      { name: "HMAC", hash: hashName(algorithm) },
      false,
      ["sign"]
    );
    const signature = new Uint8Array(
      await root.crypto.subtle.sign("HMAC", key, counterBytes(counter))
    );
    const offset = signature[signature.length - 1] & 0x0f;
    const binary =
      ((signature[offset] & 0x7f) << 24) |
      (signature[offset + 1] << 16) |
      (signature[offset + 2] << 8) |
      signature[offset + 3];
    const modulo = 10 ** digits;
    return String(binary % modulo).padStart(digits, "0");
  }

  async function totp(secret, nowMs, options) {
    const opts = options || {};
    const period = opts.period || 30;
    return hotp(secret, timeStep(nowMs, period), opts);
  }

  function toHex(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i += 1) {
      out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
  }

  async function fingerprint(secret) {
    if (!root.crypto || !root.crypto.subtle) throw codeError("no-webcrypto");
    const normalized = base32Encode(secret);
    const digest = new Uint8Array(
      await root.crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized))
    );
    return { normalized: normalized, hex: toHex(digest).slice(0, 8) };
  }

  OtpTool.base32Decode = base32Decode;
  OtpTool.base32Encode = base32Encode;
  OtpTool.normalizeBase32 = normalizeBase32;
  OtpTool.hotp = hotp;
  OtpTool.totp = totp;
  OtpTool.timeStep = timeStep;
  OtpTool.fingerprint = fingerprint;
  OtpTool.codeError = codeError;
})(typeof globalThis !== "undefined" ? globalThis : window);
