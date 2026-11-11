# Decisions

## ADR 1 — One static page, no build

The page is HTML, CSS, and classic scripts. There is no framework and no bundler. Relative URLs work on GitHub project Pages (`/otp-qr-decoder/`) and on a local static server. A build step would be another place for a secret to leak into an artifact, and it is not needed.

## ADR 2 — jsQR, not ZXing

jsQR 1.4.0 (Apache-2.0) is one file that turns `ImageData` into a QR payload. Several codes in one image are found by whiting out each hit and scanning again. ZXing is more tolerant of damaged photos and can read many codes in one pass. It is also a larger dependency. Screenshots and PDF renders are clean images, so the smaller library is the better fit. Inversion is attempted. Images are scanned up to 1800px on the long edge, then up to 3600px if nothing was found. A wide or tall image is scanned again in two overlapping halves, because one pass can miss a second code sitting beside the first. A PDF page that is essentially blank at the first zoom is not rendered again.

## ADR 3 — PDF.js legacy build, renamed to `.js`

PDF.js 6.5.438 (Apache-2.0) renders every page locally. The legacy build is the one meant for a wider set of browsers. The published files are `.mjs` modules. They are copied byte-for-byte to `.js` so GitHub Pages and `python3 -m http.server` send a JavaScript MIME type. A wrong MIME type makes the module and the worker fail. The page sets `useWorkerFetch: false` and does not set cmap, font, or wasm URLs, so PDF.js does not fetch those packs. They are not vendored. Each page is rendered at scale 2, then 4, then 6, until a QR appears or the canvas would exceed 16 million pixels. `isEvalSupported` is gone in this version; the build we ship does not call `eval`.

## ADR 4 — A small protobuf reader for migration exports

`otpauth-migration://` is a protobuf `MigrationPayload` with a repeated `OtpParameters`. A general protobuf library is more code than the message. The reader understands varints and length-delimited fields, keeps every account, and skips the version and batch fields even when they sit between accounts. Bytes are decoded from standard or URL-safe base64. The query parser does not use `URLSearchParams` for `data`, because that turns a literal `+` into a space and corrupts the secret. Algorithm 0 and digit count 0 mean SHA-1 and 6 digits, which is what Authenticator omits. The export has no period; the page says it is assuming 30 seconds. MD5 is recognized and not computed: WebCrypto has no MD5, and a homemade MD5 would be a second crypto implementation to audit.

## ADR 5 — WebCrypto for HMAC

TOTP and HOTP use `crypto.subtle` HMAC with SHA-1, SHA-256, or SHA-512, 6 or 8 digits, and a caller-supplied period or counter (RFC 4226 / RFC 6238). The moving factor is an 8-byte big-endian counter. Tests lock the function to the RFC 6238 table.

## ADR 6 — No persistence

The page never touches `localStorage`, `sessionStorage`, `IndexedDB`, cookies, or a service worker. Language follows the browser for this load (Portuguese, English, otherwise Portuguese) and the toggle is memory only. The timezone is memory only and defaults to `America/Sao_Paulo`. Clear zeroes the secret bytes it still holds, drops the strings, and removes the cards. JavaScript strings are immutable, so a copied Base32 value can remain in the heap until garbage collection. Clear also cannot wipe the OS clipboard or a screenshot the user already saved. The page ignores query strings and hashes instead of decoding them, and strips them, because an address leaks.

## ADR 7 — CSP in a meta tag, no external URLs

GitHub Pages does not let this repo set a CSP response header. The meta tag is `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'none'; form-action 'none'; base-uri 'none'`. `frame-ancestors` is illegal in a meta policy, so it is not set; a hostile parent frame cannot exfiltrate data while `connect-src` and `form-action` are `none`, but it could overlay the page. There are no links to other origins, so the browser has nothing to prefetch. Referrer policy is `no-referrer`. Styles are classes, not inline attributes.

## ADR 8 — Fingerprint

The fingerprint is `hex(SHA-256(utf8(canonical Base32)))` truncated to 8 characters. Canonical Base32 is the secret bytes re-encoded: uppercase, no spaces, no padding. Eight hex characters are 32 bits. That is enough for two people to notice a mismatch. It is not a full hash and it is not a secret. The page says so.

## ADR 9 — Timezone is a label, not an input to the code

The step is `floor(unixSeconds / period)` from `Date.now()`. The menu only changes `Intl` formatting of that window. The page shows the device zone, UTC, and the reference zone for the same instant so a wrong computer clock is visible. There is no NTP call.

## ADR 10 — `file://` is partial

Classic scripts decode images from disk. PDF.js is a module plus a module worker, which `file://` usually blocks. WebCrypto and the clipboard need a secure context. Current Chrome and Firefox treat `file://` as one; a browser that does not will still parse and will not compute codes. The README tells people to use `python3 -m http.server` when that happens.

## ADR 11 — Fixtures

Playwright generates QR PNGs and PDFs from the RFC test seeds (`12345678901234567890` and the longer SHA-256 / SHA-512 seeds). No real authenticator secret belongs in this repo. The migration fixture is a hand-described protobuf: three accounts, with the version field between the first and the second, so a parser that keeps only the first account, only the last, or fails to skip unknown fields, does not pass. An independent Node HMAC checks the same RFC rows the page must produce.

## ADR 13 — Parameters live in the fragment

`secret`, `url`, and the display options are read from the hash. The query string is copied into the hash and removed with `history.replaceState` before the values are used, and they are never written to the console. A query still hits the server on that first navigation; the move only stops the reload and later copies of the address from repeating it. `curl` cannot produce a code: the math runs in the page.

## ADR 14 — Two origins, no redirects

`connect-src` allows only `https://arquivos.n3wizards.com` and `https://minio.n3wizards.com`. The fetch uses `redirect: "manual"` and drops opaque redirects, so a bucket cannot bounce the browser at another host. Any other URL shows a short message and makes no request. A network or CORS failure says the bucket must allow this page's origin. There is no network time source, so the clock stays "device versus UTC" with the seconds remaining; we do not invent a skew warning.

## ADR 15 — Bot view, link, and tones

`just_code=1` and `format=json` hide the app and expose one `<pre>`. The title becomes the current code in `just_code`. Sounds are short WebAudio tones, with a mute flag kept in memory. Bot mode stays silent. Copy link builds `#secret=` plus digits, period, or algorithm only when they are not the defaults, and the status says the link contains the secret. The long privacy text sits in a `<details>` element.

## ADR 12 — What the deploy publishes

The Pages workflow uploads `_site` with the HTML, CSS, JS, favicon, vendored libraries, license, and third-party notices. Tests, `node_modules`, and workflows stay off the site. Actions are pinned to commit SHAs. The workflow token can read contents; only the deploy job can write Pages and request the deployment token.
