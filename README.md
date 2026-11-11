# OTP QR decoder

Local, browser-only decoder for 2FA setup QR codes. It reads `otpauth://totp`, `otpauth://hotp`, Google Authenticator `otpauth-migration://` exports, and a plain Base32 secret. TOTP codes are computed in the tab with WebCrypto. Nothing is uploaded and nothing is stored.

Live page: https://nailtongomes.github.io/otp-qr-decoder/

## Privacy

The page is a static file. QR decoding (jsQR), PDF rendering (PDF.js), and HMAC (WebCrypto) run on your device. A Content-Security-Policy meta tag sets `connect-src 'none'`, so the browser refuses any network call from the page. There is no analytics, no CDN, and no camera. Secrets are masked until you press Show. Clear drops them from the page; closing the tab does the same. The timezone you pick is kept in memory only.

The fingerprint is the first 8 hex characters of SHA-256 over the canonical Base32 secret (uppercase, no spaces, no `=`). It is a short check value so two people can confirm they hold the same secret without reading it aloud. A mismatch means the secrets differ.

Codes use UTC and this device's clock. The timezone menu only changes the clock times written next to each code. Compare the UTC line with a clock you trust. If your computer clock is wrong, the codes are wrong. This page does not ask a time server, on purpose.

## Verify

1. Open DevTools → Network, reload, and decode a code. The only requests should be this site's own HTML, CSS, JS, and (for a PDF) the PDF.js worker.
2. Switch the browser offline and decode an image again.
3. View source and check the Content-Security-Policy tag: `default-src 'none'` and `connect-src 'none'`.
4. Press Clear and confirm the secret is gone. It is not there on the next visit.

## Run offline

Save the repository (or the published files) and serve the folder:

```bash
python3 -m http.server 4173
```

Open http://127.0.0.1:4173/ . `localhost` is a secure context, so live codes and clipboard copy work, and PDF decoding works.

Opening `index.html` directly (`file://`) still decodes PNG, JPEG, and WebP in current Chrome and Firefox. PDF decoding loads PDF.js as a module and a worker, which browsers usually block from `file://`. If a browser does not treat `file://` as a secure context, parsing still works and live codes are not computed.

## Enable GitHub Pages once

The workflow `.github/workflows/pages.yml` publishes the static site from `main` with `actions/deploy-pages`. It cannot turn Pages on by itself.

1. Push this repository to `main` (merge the pull request).
2. On GitHub: Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. If the first run failed before that setting existed, open Actions → Deploy GitHub Pages → Run workflow.

The site is then https://nailtongomes.github.io/otp-qr-decoder/ .

## Develop

```bash
npm ci
npx playwright install --with-deps chromium
npm test
```

Fixtures are generated from RFC 4226 / RFC 6238 test secrets only. Do not put a real seed in this repo.

Our code is MIT (Nailton Gomes). jsQR 1.4.0 and PDF.js 6.5.438 are Apache-2.0, vendored under `vendor/` with SHA-256 hashes in `vendor/SHA256SUMS`. See `THIRD_PARTY_NOTICES.md` and `docs/DECISIONS.md`.

---

# Decodificador de QR OTP

Decodificador local, só no navegador, para QR de configuração 2FA. Lê `otpauth://totp`, `otpauth://hotp`, exportação `otpauth-migration://` do Google Authenticator e um segredo Base32 puro. Os códigos TOTP são calculados na aba com WebCrypto. Nada é enviado e nada é gravado.

Página: https://nailtongomes.github.io/otp-qr-decoder/

## Privacidade

A página é um arquivo estático. A leitura do QR (jsQR), o PDF (PDF.js) e o HMAC (WebCrypto) rodam no seu aparelho. A meta tag Content-Security-Policy define `connect-src 'none'`: o navegador recusa qualquer chamada de rede desta página. Não há análise de uso, nem CDN, nem câmera. O segredo fica oculto até você tocar em Mostrar. Limpar tira o segredo da página; fechar a aba faz o mesmo. O fuso escolhido fica só na memória.

A impressão são os primeiros 8 caracteres hexadecimais do SHA-256 do segredo em Base32 canônico (maiúsculas, sem espaços, sem `=`). É uma checagem curta para duas pessoas confirmarem que têm o mesmo segredo sem lê-lo em voz alta. Se não bater, os segredos são diferentes.

Os códigos usam UTC e o relógio deste aparelho. O menu de fuso só muda o horário escrito ao lado de cada código. Compare a linha UTC com um relógio em que você confia. Se o relógio do computador estiver errado, os códigos estarão errados. Esta página não consulta um servidor de hora, de propósito.

## Como verificar

1. Abra DevTools → Rede, recarregue e decodifique um código. Os únicos pedidos devem ser os arquivos deste site: HTML, CSS, JS e, num PDF, o worker do PDF.js.
2. Coloque o navegador offline e decodifique uma imagem de novo.
3. Veja o código-fonte e confira a tag Content-Security-Policy: `default-src 'none'` e `connect-src 'none'`.
4. Toque em Limpar e confirme que o segredo sumiu. Ele não volta na próxima visita.

## Usar offline

Salve o repositório (ou os arquivos publicados) e sirva a pasta:

```bash
python3 -m http.server 4173
```

Abra http://127.0.0.1:4173/ . `localhost` é um contexto seguro: os códigos ao vivo, a cópia e o PDF funcionam.

Abrir `index.html` direto (`file://`) ainda lê PNG, JPEG e WebP no Chrome e no Firefox atuais. O PDF carrega o PDF.js como módulo e worker, e os navegadores em geral bloqueiam isso em `file://`. Se o navegador não tratar `file://` como contexto seguro, a leitura do segredo continua e os códigos ao vivo não são calculados.

## Ativar o GitHub Pages uma vez

O workflow `.github/workflows/pages.yml` publica o site estático a partir de `main`, com `actions/deploy-pages`. Ele não consegue ligar o Pages sozinho.

1. Envie este repositório para `main` (faça o merge do pull request).
2. No GitHub: Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. Se a primeira execução falhou antes dessa opção existir, abra Actions → Deploy GitHub Pages → Run workflow.

O endereço fica https://nailtongomes.github.io/otp-qr-decoder/ .

## Desenvolvimento

```bash
npm ci
npx playwright install --with-deps chromium
npm test
```

Os fixtures usam só os segredos de teste da RFC 4226 e da RFC 6238. Não coloque uma semente real neste repositório.

O nosso código é MIT (Nailton Gomes). jsQR 1.4.0 e PDF.js 6.5.438 são Apache-2.0, vendidos em `vendor/`, com hashes SHA-256 em `vendor/SHA256SUMS`. Veja `THIRD_PARTY_NOTICES.md` e `docs/DECISIONS.md`.
