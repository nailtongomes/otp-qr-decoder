import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { SHA1_SEED, SHA256_SEED, SHA512_SEED, base32Encode, fingerprint, hotp, totp } from "./oracle.mjs";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const SECRET = base32Encode(SHA1_SEED);
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'none'; form-action 'none'; base-uri 'none'";

const RFC6238 = [
  { time: 59, SHA1: "94287082", SHA256: "46119246", SHA512: "90693936" },
  { time: 1111111109, SHA1: "07081804", SHA256: "68084774", SHA512: "25091201" },
  { time: 1111111111, SHA1: "14050471", SHA256: "67062674", SHA512: "99943326" },
  { time: 1234567890, SHA1: "89005924", SHA256: "91819424", SHA512: "93441116" },
  { time: 2000000000, SHA1: "69279037", SHA256: "90698825", SHA512: "38618901" },
  { time: 20000000000, SHA1: "65353130", SHA256: "77737706", SHA512: "47863826" },
];

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("1970-01-01T00:00:59.000Z"));
  page.on("pageerror", (error) => {
    console.log("PAGEERROR", error.message);
  });
});

function fixture(name) {
  return path.join(fixtures, name);
}

test("vendored libraries match the recorded SHA-256 hashes", () => {
  const lines = readFileSync("vendor/SHA256SUMS", "utf8")
    .trim()
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("#"));
  expect(lines.length).toBeGreaterThanOrEqual(5);
  for (const line of lines) {
    const [hash, file] = line.trim().split(/\s+/);
    const got = createHash("sha256").update(readFileSync(file)).digest("hex");
    expect(got, file).toBe(hash);
  }
  expect(readFileSync("vendor/pdfjs/LICENSE", "utf8")).toContain("Apache License");
  expect(readFileSync("vendor/jsqr/LICENSE", "utf8")).toContain("Apache License");
  expect(readFileSync("vendor/pdfjs/pdf.min.js", "utf8")).toContain("Apache License");
});

test("English is the default for an English browser, with a Portuguese toggle", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("OTP QR decoder");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator("#lang-pt").click();
  await expect(page.locator("h1")).toHaveText("Decodificador de QR OTP");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await page.locator("#lang-en").click();
  await expect(page.locator("h1")).toHaveText("OTP QR decoder");
});

test("Portuguese is the default for pt and the fallback for other languages", async ({ browser }) => {
  for (const locale of ["pt-BR", "fr-FR"]) {
    const context = await browser.newContext({ locale, baseURL: "http://127.0.0.1:4173" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Decodificador de QR OTP");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await context.close();
  }
});

test("decodes a TOTP QR and matches the RFC 6238 current and next codes", async ({ page }) => {
  expect(hotp(SHA1_SEED, 2, 8, "sha1")).toBe("37359152");
  expect(fingerprint(SHA1_SEED)).toBe("549c9390");
  await page.goto("/");
  await page.setInputFiles("#file", fixture("totp.png"));
  const card = page.locator(".account");
  await expect(card.locator(".account-name")).toHaveText("alice@example.com");
  await expect(card.locator(".issuer")).toHaveText("Example");
  await expect(card.locator(".digits-current")).toHaveText("94287082");
  await expect(card.locator(".digits-next")).toHaveText("37359152");
  await expect(card.locator(".countdown")).toContainText("1");
  await expect(card.locator(".fp")).toHaveText("549c9390");
  await expect(card.locator(".meta")).toContainText("SHA-1");
  await expect(card.locator(".meta")).toContainText("8");
  await expect(card.locator(".meta")).toContainText("30");
  await expect(page.locator("#clock-utc")).toContainText("1970-01-01 00:00:59");
  await expect(page.locator("#clock-device")).toContainText("1970-01-01 00:00:59");
  await expect(page.locator("#clock-ref")).toContainText("1969-12-31 21:00:59");
  await expect(page.locator("#clock-utc")).toHaveAttribute("data-ms", "59000");
  await expect(page.locator("#clock-device")).toHaveAttribute("data-ms", "59000");
});

test("timezone changes the written window and not the code", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#tz")).toHaveValue("America/Sao_Paulo");
  await page.setInputFiles("#file", fixture("totp.png"));
  const win = page.locator(".window");
  await expect(win).toHaveAttribute("data-start-ms", "30000");
  await expect(win).toHaveAttribute("data-end-ms", "60000");
  await expect(win).toContainText("1969-12-31 21:00:30");
  await expect(win).toContainText("1969-12-31 21:01:00");
  await page.selectOption("#tz", "UTC");
  await expect(win).toHaveAttribute("data-start-ms", "30000");
  await expect(win).toContainText("1970-01-01 00:00:30");
  await expect(win).toContainText("1970-01-01 00:01:00");
  await expect(page.locator(".digits-current")).toHaveText("94287082");
  await expect(page.locator(".digits-next")).toHaveText("37359152");
  await page.locator("#lang-pt").click();
  await expect(page.locator(".digits-current")).toHaveText("94287082");
  await expect(win).toContainText("Válido de");
});

test("device timezone does not change a code that is tied to UTC", async ({ browser }) => {
  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/Sao_Paulo",
    baseURL: "http://127.0.0.1:4173",
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("1970-01-01T00:00:59.000Z"));
  await page.goto("/");
  await page.setInputFiles("#file", fixture("totp.png"));
  await expect(page.locator(".digits-current")).toHaveText("94287082");
  await expect(page.locator("#clock-utc")).toContainText("1970-01-01 00:00:59");
  await expect(page.locator("#clock-device")).toContainText("1969-12-31 21:00:59");
  await context.close();
});

test("masks the secret, copies it, and Clear removes it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.setInputFiles("#file", fixture("totp.png"));
  await expect(page.locator(".digits-current")).toHaveText("94287082");
  const results = page.locator("#results");
  await expect(results).not.toContainText(SECRET);
  expect((await results.innerHTML()).replace(/\s+/g, "")).not.toContain(SECRET);
  await expect(page.locator(".secret")).toHaveText("Hidden");
  await page.locator(".copy-secret").click();
  await expect(page.locator("#status")).toHaveText("Secret copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(SECRET);
  expect((await results.innerHTML()).replace(/\s+/g, "")).not.toContain(SECRET);
  await page.locator(".show-secret").click();
  expect((await page.locator(".secret").innerText()).replace(/\s+/g, "")).toBe(SECRET);
  await page.locator(".show-secret").click();
  await expect(page.locator(".secret")).toHaveText("Hidden");
  await page.locator(".copy-uri").click();
  const uri = await page.evaluate(() => navigator.clipboard.readText());
  expect(uri.startsWith("otpauth://totp/")).toBe(true);
  expect(uri).toContain("secret=" + SECRET);
  await expect(page.locator("#status")).toHaveText("otpauth link copied.");
  await expect(page.locator("#status")).not.toContainText(SECRET);
  await page.locator("#clear").click();
  await expect(page.locator(".account")).toHaveCount(0);
  await expect(page.locator("#results")).toContainText("No codes yet.");
  await expect(page.locator("body")).not.toContainText(SECRET);
  await expect(page.locator("#status")).toHaveText("Cleared from this tab.");
});

test("reads every account in a migration QR, not only the first", async ({ page }) => {
  await page.goto("/");
  await page.setInputFiles("#file", fixture("migration.png"));
  await expect(page.locator(".account")).toHaveCount(3);
  const names = await page.locator(".account-name").allTextContents();
  expect(names).toEqual(["alice@example.com", "bob", "carol"]);
  const alice = page.locator(".account", { hasText: "alice@example.com" });
  const bob = page.locator(".account", { hasText: "bob" }).first();
  const carol = page.locator(".account", { hasText: "carol" });
  await expect(alice.locator(".digits-current")).toHaveText("94287082");
  await expect(alice.locator(".notes")).toContainText("30 seconds");
  await expect(bob.locator(".digits-current")).toHaveText("755224");
  await expect(bob.locator(".digits-next")).toHaveText("287082");
  await expect(bob.locator(".countdown")).toContainText("counter");
  await expect(carol.locator(".digits-current")).toHaveText("46119246");
  await expect(carol.locator(".fp")).toHaveText(fingerprint(SHA256_SEED));
  await expect(carol.locator(".fp")).not.toHaveText("549c9390");
});

test("decodes two QR codes in one image, a PDF on a later page, and a plain Base32 QR", async ({ page }) => {
  await page.goto("/");
  await page.setInputFiles("#file", fixture("two.png"));
  await expect(page.locator(".account")).toHaveCount(2);
  await expect(page.locator(".account", { hasText: "alice@example.com" }).locator(".digits-current")).toHaveText("94287082");
  await expect(page.locator(".account", { hasText: "bob" }).locator(".digits-current")).toHaveText("755224");

  await page.locator("#clear").click();
  await page.setInputFiles("#file", fixture("totp.pdf"));
  await expect(page.locator(".digits-current")).toHaveText("94287082", { timeout: 45_000 });
  await expect(page.locator("#status")).toHaveAttribute("data-higher-zoom", "0");

  await page.locator("#clear").click();
  await page.setInputFiles("#file", fixture("base32.png"));
  await expect(page.locator(".digits-current")).toHaveText("287082");
  await expect(page.locator(".notes")).toContainText("SHA-1");
  await expect(page.locator(".account-name")).toHaveText("Pasted secret");
});

test("retries a tiny PDF QR at a higher zoom", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.setInputFiles("#file", fixture("tiny.pdf"));
  await expect(page.locator(".digits-current")).toHaveText("94287082", { timeout: 60_000 });
  await expect(page.locator("#status")).toHaveAttribute("data-higher-zoom", "1");
  await expect(page.locator("#status")).toContainText("higher zoom");
});

test("custom period and HOTP are honored", async ({ page }) => {
  expect(hotp(SHA1_SEED, 0, 8, "sha1")).toBe("84755224");
  await page.goto("/");
  await page.setInputFiles("#file", fixture("period.png"));
  await expect(page.locator(".digits-current")).toHaveText("84755224");
  await expect(page.locator(".meta")).toContainText("60");
  await expect(page.locator(".digits-current")).not.toHaveText("94287082");
  await page.locator("#clear").click();
  await page.setInputFiles("#file", fixture("hotp.png"));
  await expect(page.locator(".digits-current")).toHaveText("755224");
  await expect(page.locator(".digits-next")).toHaveText("287082");
});

test("text fallback accepts Base32 and rejects MD5 codes", async ({ page }) => {
  await page.goto("/");
  await page.locator("#fallback").fill(SECRET);
  await page.locator("#decode-text").click();
  await expect(page.locator(".digits-current")).toHaveText("287082");
  await expect(page.locator("#fallback")).toHaveValue("");
  await page.locator("#clear").click();
  await page.locator("#fallback").fill(
    `otpauth://totp/Ex:md5?secret=${SECRET}&algorithm=MD5&digits=6`
  );
  await page.locator("#decode-text").click();
  await expect(page.locator(".digits-current")).toHaveText("—");
  await expect(page.locator(".notes")).toContainText("MD5");
  await expect(page.locator("#fallback")).toHaveValue("");
});

test("an image with no QR does not invent an account", async ({ page }) => {
  await page.goto("/");
  await page.setInputFiles("#file", fixture("none.png"));
  await expect(page.locator("#status")).toHaveText("No QR code found.");
  await expect(page.locator(".account")).toHaveCount(0);
});

test("paste and drag-and-drop decode an image", async ({ page }) => {
  await page.goto("/");
  const b64 = readFileSync(fixture("totp.png")).toString("base64");
  await page.locator("#drop").evaluate((element, image) => {
    const bytes = Uint8Array.from(atob(image), (char) => char.charCodeAt(0));
    const file = new File([bytes], "drop.png", { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, b64);
  await expect(page.locator(".digits-current")).toHaveText("94287082");
  await page.locator("#clear").click();
  await page.evaluate((image) => {
    const bytes = Uint8Array.from(atob(image), (char) => char.charCodeAt(0));
    const file = new File([bytes], "paste.png", { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: transfer });
    window.dispatchEvent(event);
  }, b64);
  await expect(page.locator(".digits-current")).toHaveText("94287082");
});

test("page code matches every RFC 6238 vector, including the following step", async ({ page }) => {
  await page.goto("/");
  const seeds = {
    SHA1: [...SHA1_SEED],
    SHA256: [...SHA256_SEED],
    SHA512: [...SHA512_SEED],
  };
  const got = await page.evaluate(async ({ seeds, times }) => {
    const rows = [];
    for (const time of times) {
      const row = { time };
      for (const algorithm of ["SHA1", "SHA256", "SHA512"]) {
        const secret = new Uint8Array(seeds[algorithm]);
        row[algorithm] = await OtpTool.totp(secret, time * 1000, { algorithm, digits: 8, period: 30 });
        const step = OtpTool.timeStep(time * 1000, 30);
        row[algorithm + "Next"] = await OtpTool.hotp(secret, step + 1n, { algorithm, digits: 8 });
      }
      rows.push(row);
    }
    const foo = new TextDecoder().decode(OtpTool.base32Decode("MZXW6==="));
    return { rows, foo };
  }, { seeds, times: RFC6238.map((row) => row.time) });
  expect(got.foo).toBe("foo");
  expect(got.rows).toHaveLength(RFC6238.length);
  got.rows.forEach((row, index) => {
    const expected = RFC6238[index];
    expect(row.SHA1, `SHA1 ${expected.time}`).toBe(expected.SHA1);
    expect(row.SHA256, `SHA256 ${expected.time}`).toBe(expected.SHA256);
    expect(row.SHA512, `SHA512 ${expected.time}`).toBe(expected.SHA512);
    expect(row.SHA1Next).toBe(hotp(SHA1_SEED, Math.floor(expected.time / 30) + 1, 8, "sha1"));
    expect(row.SHA256Next).toBe(hotp(SHA256_SEED, Math.floor(expected.time / 30) + 1, 8, "sha256"));
    expect(row.SHA512Next).toBe(hotp(SHA512_SEED, Math.floor(expected.time / 30) + 1, 8, "sha512"));
  });
});

test("migration data keeps a literal plus in base64", async ({ page }) => {
  await page.goto("/");
  const inner = Buffer.from([
    0x0a, 0x03, 0xfb, 0xef, 0xff,
    0x12, 0x01, 0x7a,
    0x1a, 0x01, 0x71,
    0x20, 0x01,
    0x28, 0x01,
    0x30, 0x02,
  ]);
  const payload = Buffer.concat([Buffer.from([0x0a, inner.length]), inner]);
  const b64 = payload.toString("base64");
  expect(b64).toMatch(/[+/]/);
  const read = async (data) => page.evaluate(async (uri) => {
    const parsed = OtpTool.parsePayload(uri);
    return parsed.accounts.map((account) => ({
      name: account.name,
      issuer: account.issuer,
      type: account.type,
      digits: account.digits,
    }));
  }, `otpauth-migration://offline?data=${data}`);
  await expect(read(b64)).resolves.toEqual([{ name: "z", issuer: "q", type: "totp", digits: 6 }]);
  const encoded = b64.replaceAll("+", "%2B").replaceAll("/", "%2F");
  await expect(read(encoded)).resolves.toEqual([{ name: "z", issuer: "q", type: "totp", digits: 6 }]);
});

test("the page does not call the network, storage, or a service worker", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    window.__storageCalls = [];
    const mark = (name) => window.__storageCalls.push(name);
    for (const method of ["getItem", "setItem", "removeItem", "clear"]) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function storageProbe(...args) {
        mark((this === window.localStorage ? "localStorage" : "sessionStorage") + "." + method);
        return original.apply(this, args);
      };
    }
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = function indexedProbe(...args) {
      mark("indexedDB.open");
      return open(...args);
    };
    if (navigator.serviceWorker) {
      const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      navigator.serviceWorker.register = function swProbe(...args) {
        mark("serviceWorker.register");
        return register(...args);
      };
    }
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    if (descriptor && descriptor.get && descriptor.set) {
      Object.defineProperty(document, "cookie", {
        configurable: true,
        get() {
          mark("cookie.get");
          return descriptor.get.call(document);
        },
        set(value) {
          mark("cookie.set");
          return descriptor.set.call(document, value);
        },
      });
    }
  });
  const requests = [];
  let websocket = false;
  page.on("request", (request) => requests.push(request.url()));
  page.on("websocket", () => {
    websocket = true;
  });
  await page.goto("/");
  await page.locator("#lang-pt").click();
  await page.locator("#lang-en").click();
  await page.selectOption("#tz", "Europe/Lisbon");
  await page.setInputFiles("#file", fixture("totp.png"));
  await expect(page.locator(".digits-current")).toHaveText("94287082");
  await page.setInputFiles("#file", fixture("none.png"));
  await expect(page.locator("#status")).toContainText("No QR code found.");
  await page.setInputFiles("#file", fixture("totp.pdf"));
  await expect(page.locator(".digits-current").last()).toHaveText("94287082", { timeout: 45_000 });
  await page.locator("#clear").click();

  const allowed = new Set([
    "/",
    "/index.html",
    "/favicon.svg",
    "/css/styles.css",
    "/js/app.js",
    "/js/i18n.js",
    "/js/totp.js",
    "/js/parse.js",
    "/js/migration.js",
    "/js/qr.js",
    "/vendor/jsqr/jsQR.js",
    "/vendor/pdfjs/pdf.min.js",
    "/vendor/pdfjs/pdf.worker.min.js",
  ]);
  const unexpected = [];
  for (const url of requests) {
    const parsed = new URL(url);
    if (parsed.protocol === "data:" || parsed.protocol === "blob:") continue;
    if (parsed.hostname !== "127.0.0.1" || !allowed.has(parsed.pathname)) unexpected.push(url);
  }
  expect(unexpected, "unexpected requests:\n" + unexpected.join("\n")).toEqual([]);
  expect(websocket).toBe(false);
  const storageCalls = await page.evaluate(() => window.__storageCalls);
  expect(storageCalls).toEqual([]);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toBe(CSP);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
  const scripts = await page.locator("script").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src")));
  expect(scripts.every((src) => src && !/^https?:\/\//i.test(src))).toBe(true);
  await expect(page.locator("#file")).toHaveAttribute("accept", /image\/webp/);
  await expect(page.locator("#file")).toHaveAttribute("accept", /image\/jpeg/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(mobileOverflow).toBe(false);
});
