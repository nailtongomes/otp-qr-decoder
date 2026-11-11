import { createHash, createHmac } from "node:crypto";

export const SHA1_SEED = Buffer.from("12345678901234567890", "ascii");
export const SHA256_SEED = Buffer.from("12345678901234567890123456789012", "ascii");
export const SHA512_SEED = Buffer.from(
  "1234567890123456789012345678901234567890123456789012345678901234",
  "ascii"
);

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(value >>> bits) & 31];
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function hotp(secret, counter, digits, algorithm) {
  const buf = Buffer.alloc(8);
  const count = BigInt(counter);
  buf.writeUInt32BE(Number((count >> 32n) & 0xffffffffn), 0);
  buf.writeUInt32BE(Number(count & 0xffffffffn), 4);
  const hmac = createHmac(algorithm, secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function totp(secret, unixSeconds, digits, algorithm, period = 30) {
  return hotp(secret, Math.floor(unixSeconds / period), digits, algorithm);
}

export function fingerprint(secret) {
  return createHash("sha256").update(base32Encode(secret)).digest("hex").slice(0, 8);
}

function assertOracle() {
  const vectors = { f: "MY", fo: "MZXQ", foo: "MZXW6", foobar: "MZXW6YTBOI" };
  for (const [text, expected] of Object.entries(vectors)) {
    const got = base32Encode(Buffer.from(text, "ascii"));
    if (got !== expected) throw new Error(`base32 ${text} => ${got}, expected ${expected}`);
  }
  if (hotp(SHA1_SEED, 0, 6, "sha1") !== "755224") throw new Error("HOTP counter 0 drifted");
  if (totp(SHA1_SEED, 59, 8, "sha1") !== "94287082") throw new Error("TOTP SHA1 drifted");
  if (totp(SHA256_SEED, 59, 8, "sha256") !== "46119246") throw new Error("TOTP SHA256 drifted");
  if (totp(SHA512_SEED, 59, 8, "sha512") !== "90693936") throw new Error("TOTP SHA512 drifted");
  if (fingerprint(SHA1_SEED) !== "549c9390") throw new Error("fingerprint drifted");
}

assertOracle();
