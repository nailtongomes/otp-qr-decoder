import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const sums = readFileSync(new URL("../vendor/SHA256SUMS", import.meta.url), "utf8");
let failed = false;
let checked = 0;

for (const line of sums.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const match = trimmed.match(/^([a-f0-9]{64})\s+(.+)$/i);
  if (!match) {
    console.error("Bad SHA256SUMS line:", line);
    failed = true;
    continue;
  }
  const expected = match[1].toLowerCase();
  const file = match[2].trim();
  const got = createHash("sha256").update(readFileSync(file)).digest("hex");
  if (got !== expected) {
    console.error(`HASH MISMATCH ${file}\n  expected ${expected}\n  got      ${got}`);
    failed = true;
  } else {
    console.log(`ok ${file}`);
  }
  checked += 1;
}

if (!checked) {
  console.error("No hashes recorded.");
  failed = true;
}

if (failed) process.exit(1);
