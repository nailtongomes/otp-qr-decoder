# Third-party notices

Our code is MIT, copyright Nailton Gomes (see `LICENSE`). The libraries below are vendored in this repository and shipped with the page. They are not loaded from a CDN. Hashes are in `vendor/SHA256SUMS`. Versions are in `vendor/VERSIONS`.

## jsQR 1.4.0

- Copyright: jsQR contributors
- License: Apache License 2.0
- Project: https://github.com/cozmo/jsQR
- Package: https://www.npmjs.com/package/jsqr/v/1.4.0
- Files: `vendor/jsqr/jsQR.js`, `vendor/jsqr/LICENSE`

The file `vendor/jsqr/jsQR.js` is the unmodified `dist/jsQR.js` from the 1.4.0 package.

## PDF.js 6.5.438

- Copyright 2024 Mozilla Foundation (as stated in the distributed build)
- License: Apache License 2.0
- Project: https://github.com/mozilla/pdf.js
- Package: https://www.npmjs.com/package/pdfjs-dist/v/6.5.438
- Files: `vendor/pdfjs/pdf.min.js`, `vendor/pdfjs/pdf.worker.min.js`, `vendor/pdfjs/LICENSE`

Those two scripts are the unmodified legacy build (`package/legacy/build/pdf.min.mjs` and `pdf.worker.min.mjs`), renamed to `.js` so static hosts serve them as JavaScript. See `vendor/VERSIONS`.

This page does not include the PDF.js wasm decoders, cmap files, or standard font packs, and it does not ask PDF.js to fetch them.

## License text

Both libraries are Apache-2.0. The full license text is stored next to each library:

- `vendor/jsqr/LICENSE`
- `vendor/pdfjs/LICENSE`

Test-only tools (`@playwright/test`, `qrcode`, `pdf-lib`) are not part of the page and are not vendored.
