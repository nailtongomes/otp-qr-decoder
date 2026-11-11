import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";
import { SHA1_SEED, SHA256_SEED, base32Encode } from "./oracle.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "fixtures");

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

export function encodePng(width, height, rgb) {
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 3 + 1);
    raw[start] = 0;
    rgb.copy(raw, start + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  if (png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height) {
    throw new Error("PNG header mismatch");
  }
  return png;
}

function solid(width, height, red, green, blue) {
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0; i < rgb.length; i += 3) {
    rgb[i] = red;
    rgb[i + 1] = green;
    rgb[i + 2] = blue;
  }
  return encodePng(width, height, rgb);
}

function drawQr(text, modulePx = 8, margin = 4) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const cells = size + margin * 2;
  const pixels = cells * modulePx;
  const rgb = Buffer.alloc(pixels * pixels * 3, 255);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!qr.modules.get(y, x)) continue;
      const originX = (x + margin) * modulePx;
      const originY = (y + margin) * modulePx;
      for (let py = 0; py < modulePx; py += 1) {
        for (let px = 0; px < modulePx; px += 1) {
          const index = ((originY + py) * pixels + (originX + px)) * 3;
          rgb[index] = 0;
          rgb[index + 1] = 0;
          rgb[index + 2] = 0;
        }
      }
    }
  }
  return encodePng(pixels, pixels, rgb);
}

function sideBySide(left, right, gap = 120) {
  const leftQr = QRCode.create(left, { errorCorrectionLevel: "M" });
  const rightQr = QRCode.create(right, { errorCorrectionLevel: "M" });
  const modulePx = 8;
  const margin = 4;
  const cell = (qr) => (qr.modules.size + margin * 2) * modulePx;
  const leftPx = cell(leftQr);
  const rightPx = cell(rightQr);
  const width = leftPx + gap + rightPx;
  const height = Math.max(leftPx, rightPx);
  const rgb = Buffer.alloc(width * height * 3, 255);
  function blit(qr, originX, originY) {
    const size = qr.modules.size;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!qr.modules.get(y, x)) continue;
        const px0 = originX + (x + margin) * modulePx;
        const py0 = originY + (y + margin) * modulePx;
        for (let py = 0; py < modulePx; py += 1) {
          for (let px = 0; px < modulePx; px += 1) {
            const index = ((py0 + py) * width + (px0 + px)) * 3;
            rgb[index] = 0;
            rgb[index + 1] = 0;
            rgb[index + 2] = 0;
          }
        }
      }
    }
  }
  blit(leftQr, 0, 0);
  blit(rightQr, leftPx + gap, 0);
  return encodePng(width, height, rgb);
}

function varint(number) {
  let value = BigInt(number);
  const out = [];
  while (value > 127n) {
    out.push(Number((value & 0x7fn) | 0x80n));
    value >>= 7n;
  }
  out.push(Number(value));
  return Buffer.from(out);
}

function key(field, wire) {
  return varint((field << 3) | wire);
}

function lengthDelimited(field, bytes) {
  return Buffer.concat([key(field, 2), varint(bytes.length), bytes]);
}

function fieldVarint(field, number) {
  return Buffer.concat([key(field, 0), varint(number)]);
}

function otpParameters({ secret, name, issuer, algorithm, digits, type, counter }) {
  const parts = [
    lengthDelimited(1, secret),
    lengthDelimited(2, Buffer.from(name)),
    lengthDelimited(3, Buffer.from(issuer)),
    fieldVarint(4, algorithm),
    fieldVarint(5, digits),
    fieldVarint(6, type),
  ];
  if (counter != null) parts.push(fieldVarint(7, counter));
  return Buffer.concat(parts);
}

export function migrationPayload() {
  const alice = otpParameters({
    secret: SHA1_SEED,
    name: "alice@example.com",
    issuer: "Example",
    algorithm: 1,
    digits: 2,
    type: 2,
  });
  const bob = otpParameters({
    secret: SHA1_SEED,
    name: "bob",
    issuer: "Other",
    algorithm: 1,
    digits: 1,
    type: 1,
    counter: 0,
  });
  const carol = otpParameters({
    secret: SHA256_SEED,
    name: "carol",
    issuer: "Sha256Co",
    algorithm: 2,
    digits: 2,
    type: 2,
  });
  return Buffer.concat([
    lengthDelimited(1, alice),
    fieldVarint(2, 1),
    lengthDelimited(1, bob),
    lengthDelimited(1, carol),
    fieldVarint(3, 1),
    fieldVarint(4, 0),
    fieldVarint(5, 1),
  ]);
}

function totpUri({ issuer, name, secret, algorithm = "SHA1", digits = 8, period = 30 }) {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(name)}`;
  const params = new URLSearchParams({
    secret: base32Encode(secret),
    issuer,
    algorithm,
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${params}`;
}

function hotpUri({ issuer, name, secret, counter, digits = 6 }) {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(name)}`;
  const params = new URLSearchParams({
    secret: base32Encode(secret),
    issuer,
    algorithm: "SHA1",
    digits: String(digits),
    counter: String(counter),
  });
  return `otpauth://hotp/${label}?${params}`;
}

async function writePdf(filename, png, placements) {
  const pdf = await PDFDocument.create();
  pdf.setCreator("otp-qr-decoder fixtures");
  pdf.setProducer("otp-qr-decoder fixtures");
  const fixed = new Date(Date.UTC(2020, 0, 1));
  pdf.setCreationDate(fixed);
  pdf.setModificationDate(fixed);
  const image = await pdf.embedPng(png);
  for (const placement of placements) {
    const page = pdf.addPage([placement.pageWidth, placement.pageHeight]);
    if (placement.size) {
      page.drawImage(image, {
        x: placement.x,
        y: placement.y,
        width: placement.size,
        height: placement.size,
      });
    }
  }
  await writeFile(filename, await pdf.save());
}

export async function generateFixtures() {
  if (crc32(Buffer.from("123456789")) !== 0xcbf43926) {
    throw new Error("CRC32 self-check failed");
  }
  await mkdir(outDir, { recursive: true });
  const alice = totpUri({
    issuer: "Example",
    name: "alice@example.com",
    secret: SHA1_SEED,
    digits: 8,
    period: 30,
  });
  const bob = hotpUri({ issuer: "Other", name: "bob", secret: SHA1_SEED, counter: 0, digits: 6 });
  const period = totpUri({
    issuer: "Example",
    name: "alice@example.com",
    secret: SHA1_SEED,
    digits: 8,
    period: 60,
  });
  const migration = `otpauth-migration://offline?data=${migrationPayload().toString("base64")}`;
  await writeFile(join(outDir, "totp.png"), drawQr(alice));
  await writeFile(join(outDir, "hotp.png"), drawQr(bob));
  await writeFile(join(outDir, "period.png"), drawQr(period));
  await writeFile(join(outDir, "base32.png"), drawQr(base32Encode(SHA1_SEED)));
  await writeFile(join(outDir, "migration.png"), drawQr(migration, 6, 4));
  await writeFile(join(outDir, "two.png"), sideBySide(alice, bob));
  await writeFile(join(outDir, "none.png"), solid(96, 64, 180, 176, 168));
  const totpPng = drawQr(alice);
  await writePdf(join(outDir, "totp.pdf"), totpPng, [
    { pageWidth: 612, pageHeight: 792 },
    { pageWidth: 612, pageHeight: 792, x: 180, y: 420, size: 220 },
  ]);
  await writePdf(join(outDir, "tiny.pdf"), totpPng, [
    { pageWidth: 500, pageHeight: 500, x: 200, y: 230, size: 22 },
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await generateFixtures();
}
