(function (root) {
  const OtpTool = root.OtpTool || (root.OtpTool = {});
  let pdfjsPromise = null;

  function fail(code) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }

  // Resolve next to the HTML file, not next to this script. Classic-script
  // import() is based on the document URL, and a project-page URL without a
  // trailing slash would otherwise drop the repository directory.
  function asset(path) {
    const current = new URL(root.location.href);
    let base = current.href;
    if (!base.endsWith("/")) {
      const last = current.pathname.split("/").pop() || "";
      if (last.includes(".")) base = new URL("./", current).href;
      else base = new URL(current.pathname + "/", current.origin).href;
    }
    return new URL(path, base).href;
  }

  function blankQr(image, location, padRatio) {
    if (!location) return false;
    const keys = [
      "topLeftCorner",
      "topRightCorner",
      "bottomRightCorner",
      "bottomLeftCorner",
      "topLeftFinderPattern",
      "topRightFinderPattern",
      "bottomLeftFinderPattern",
    ];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let count = 0;
    for (let i = 0; i < keys.length; i += 1) {
      const point = location[keys[i]];
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      count += 1;
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
    if (!count) return false;
    const pad = Math.max(12, Math.round(padRatio * Math.max(maxX - minX, maxY - minY)));
    const x0 = Math.max(0, Math.floor(minX - pad));
    const y0 = Math.max(0, Math.floor(minY - pad));
    const x1 = Math.min(image.width - 1, Math.ceil(maxX + pad));
    const y1 = Math.min(image.height - 1, Math.ceil(maxY + pad));
    const data = image.data;
    for (let y = y0; y <= y1; y += 1) {
      let index = (y * image.width + x0) * 4;
      for (let x = x0; x <= x1; x += 1) {
        data[index] = 255;
        data[index + 1] = 255;
        data[index + 2] = 255;
        data[index + 3] = 255;
        index += 4;
      }
    }
    return true;
  }

  function scanRegion(image, found, seen) {
    const work = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
    for (let n = 0; n < 8; n += 1) {
      let code = null;
      try {
        code = root.jsQR(work.data, work.width, work.height, { inversionAttempts: "attemptBoth" });
      } catch (error) {
        break;
      }
      if (!code || !code.data) break;
      if (!seen.has(code.data)) {
        seen.add(code.data);
        found.push(code.data);
      }
      if (!blankQr(work, code.location, 0.22)) break;
    }
  }

  function crop(image, x, y, width, height) {
    const out = new ImageData(width, height);
    for (let row = 0; row < height; row += 1) {
      const src = ((y + row) * image.width + x) * 4;
      out.data.set(image.data.subarray(src, src + width * 4), row * width * 4);
    }
    return out;
  }

  // jsQR returns one code, and a second code in the same frame can make that
  // first pass miss both. Halves with a small overlap catch codes that sit
  // side by side or one above the other.
  function findQrPayloads(imageData) {
    if (typeof root.jsQR !== "function") fail("imageFailed");
    const found = [];
    const seen = new Set();
    scanRegion(imageData, found, seen);
    const boxes = [];
    const wide = imageData.width > imageData.height * 1.35;
    const tall = imageData.height > imageData.width * 1.35;
    if (wide) {
      const mid = Math.floor(imageData.width / 2);
      const overlap = 36;
      boxes.push([0, 0, Math.min(imageData.width, mid + overlap), imageData.height]);
      const right = Math.max(0, mid - overlap);
      boxes.push([right, 0, imageData.width - right, imageData.height]);
    }
    if (tall) {
      const mid = Math.floor(imageData.height / 2);
      const overlap = 36;
      boxes.push([0, 0, imageData.width, Math.min(imageData.height, mid + overlap)]);
      const bottom = Math.max(0, mid - overlap);
      boxes.push([0, bottom, imageData.width, imageData.height - bottom]);
    }
    for (let i = 0; i < boxes.length; i += 1) {
      const box = boxes[i];
      if (box[2] < 48 || box[3] < 48) continue;
      scanRegion(crop(imageData, box[0], box[1], box[2], box[3]), found, seen);
    }
    return found;
  }

  function raster(bitmap, maxEdge) {
    const largest = Math.max(bitmap.width, bitmap.height);
    const scale = largest > maxEdge ? maxEdge / largest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = root.document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const image = ctx.getImageData(0, 0, width, height);
    canvas.width = 0;
    canvas.height = 0;
    return image;
  }

  async function decodeImageFile(file) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (error) {
      fail("imageFailed");
    }
    try {
      const largest = Math.max(bitmap.width, bitmap.height);
      const first = raster(bitmap, Math.min(largest, 1800));
      let payloads = findQrPayloads(first);
      if (!payloads.length && largest > 1800) {
        payloads = findQrPayloads(raster(bitmap, Math.min(largest, 3600)));
      }
      return payloads;
    } finally {
      bitmap.close();
    }
  }

  function mostlyBlank(image) {
    const data = image.data;
    let dark = 0;
    let seen = 0;
    for (let i = 0; i < data.length; i += 128) {
      seen += 1;
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) dark += 1;
    }
    return seen === 0 || dark / seen < 0.001;
  }

  function loadPdfJs() {
    if (!pdfjsPromise) {
      const url = asset("vendor/pdfjs/pdf.min.js");
      pdfjsPromise = import(url).catch(function () {
        pdfjsPromise = null;
        fail(root.location.protocol === "file:" ? "pdfNeedsHttp" : "pdfLoadFailed");
      });
    }
    return pdfjsPromise;
  }

  async function renderPage(page, scale) {
    const viewport = page.getViewport({ scale: scale });
    const width = Math.max(1, Math.floor(viewport.width));
    const height = Math.max(1, Math.floor(viewport.height));
    const canvas = root.document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    const task = page.render({
      canvasContext: ctx,
      viewport: viewport,
      annotationMode: 0,
      background: "#ffffff",
    });
    await (task.promise || task);
    const image = ctx.getImageData(0, 0, width, height);
    canvas.width = 0;
    canvas.height = 0;
    return image;
  }

  async function decodePdfFile(file, shouldContinue, onProgress) {
    const pdfjs = await loadPdfJs();
    if (!shouldContinue()) return { payloads: [], higherZoom: false };
    pdfjs.GlobalWorkerOptions.workerSrc = asset("vendor/pdfjs/pdf.worker.min.js");
    const data = new Uint8Array(await file.arrayBuffer());
    if (!shouldContinue()) return { payloads: [], higherZoom: false };
    const loadingTask = pdfjs.getDocument({
      data: data,
      disableFontFace: true,
      disableAutoFetch: true,
      disableStream: true,
      disableRange: true,
      useSystemFonts: false,
      useWorkerFetch: false,
    });
    let pdf;
    try {
      pdf = await loadingTask.promise;
    } catch (error) {
      if (error && error.name === "PasswordException") fail("pdfPassword");
      fail("pdfLoadFailed");
    }
    const payloads = [];
    let higherZoom = false;
    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (!shouldContinue()) break;
        if (onProgress) onProgress({ page: pageNumber, pages: pdf.numPages });
        const page = await pdf.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const maxPixels = 16000000;
        let scales = [2, 4, 6].filter(function (scale) {
          return base.width * scale * base.height * scale <= maxPixels;
        });
        if (!scales.length) scales = [1];
        let found = [];
        for (let i = 0; i < scales.length; i += 1) {
          if (!shouldContinue()) break;
          const image = await renderPage(page, scales[i]);
          found = findQrPayloads(image);
          if (found.length) {
            if (i > 0) higherZoom = true;
            break;
          }
          if (i === 0 && mostlyBlank(image)) break;
        }
        for (let i = 0; i < found.length; i += 1) payloads.push(found[i]);
        if (typeof page.cleanup === "function") await page.cleanup();
      }
    } finally {
      try {
        if (typeof loadingTask.destroy === "function") await loadingTask.destroy();
      } catch (error) {
        /* The worker is same-origin and dies with the tab. */
      }
    }
    return { payloads: payloads, higherZoom: higherZoom };
  }

  async function readFile(file, shouldContinue, onProgress) {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    let magic = "";
    for (let i = 0; i < head.length; i += 1) magic += String.fromCharCode(head[i]);
    const looksPdf =
      magic.startsWith("%PDF") ||
      file.type === "application/pdf" ||
      /\.pdf$/i.test(file.name || "");
    if (looksPdf) return decodePdfFile(file, shouldContinue, onProgress);
    const payloads = await decodeImageFile(file);
    return { payloads: payloads, higherZoom: false };
  }

  OtpTool.readFile = readFile;
  OtpTool.findQrPayloads = findQrPayloads;
})(typeof globalThis !== "undefined" ? globalThis : window);
