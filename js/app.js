(function (root) {
  const state = {
    timeZone: "America/Sao_Paulo",
    accounts: [],
    shown: new Set(),
    nextId: 0,
    generation: 0,
    report: null,
    webcrypto: !!(root.crypto && root.crypto.subtle),
    inputRevealed: false,
    muted: false,
    bot: false,
    params: null,
  };
  let refreshing = false;
  let refreshQueued = false;

  const COMMON_ZONES = [
    "America/Sao_Paulo",
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Mexico_City",
    "America/Argentina/Buenos_Aires",
    "America/Fortaleza",
    "Europe/Lisbon",
    "Europe/London",
    "Europe/Paris",
    "Africa/Johannesburg",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];

  function t(key, vars) {
    return root.OtpI18n.t(key, vars);
  }

  function el(tag, className, text) {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function formatWhen(ms, timeZone) {
    const map = {};
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(ms));
    for (let i = 0; i < parts.length; i += 1) map[parts[i].type] = parts[i].value;
    let hour = map.hour;
    if (hour === "24") hour = "00";
    return map.year + "-" + map.month + "-" + map.day + " " + hour + ":" + map.minute + ":" + map.second;
  }

  function zoneOffset(ms, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
    }).formatToParts(new Date(ms));
    for (let i = 0; i < parts.length; i += 1) {
      if (parts[i].type === "timeZoneName") return parts[i].value;
    }
    return "";
  }

  function paintClocks(now) {
    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    writeClock("clock-device", now, deviceZone);
    writeClock("clock-utc", now, "UTC");
    writeClock("clock-ref", now, state.timeZone);
  }

  function writeClock(id, now, zone) {
    const node = root.document.getElementById(id);
    if (!node) return;
    node.textContent = formatWhen(now, zone) + "  " + zone + " (" + zoneOffset(now, zone) + ")";
    node.dataset.ms = String(now);
    node.dataset.zone = zone;
  }

  function zones() {
    try {
      const list = Intl.supportedValuesOf("timeZone").slice();
      if (list.indexOf("UTC") === -1) list.unshift("UTC");
      if (list.indexOf("America/Sao_Paulo") === -1) list.unshift("America/Sao_Paulo");
      return list;
    } catch (error) {
      return COMMON_ZONES.slice();
    }
  }

  function zoneOption(id) {
    const option = el("option", "", id);
    option.value = id;
    return option;
  }

  function fillZones() {
    const select = root.document.getElementById("tz");
    const current = state.timeZone;
    const all = zones();
    select.replaceChildren();
    const common = el("optgroup");
    common.label = t("tzCommon");
    COMMON_ZONES.forEach(function (id) {
      if (all.indexOf(id) !== -1) common.append(zoneOption(id));
    });
    const rest = el("optgroup");
    rest.label = t("tzAll");
    all.forEach(function (id) {
      if (COMMON_ZONES.indexOf(id) === -1) rest.append(zoneOption(id));
    });
    select.append(common, rest);
    select.value = current;
    if (select.value !== current) {
      common.append(zoneOption(current));
      select.value = current;
    }
  }

  function paintReport() {
    const node = root.document.getElementById("status");
    const report = state.report;
    if (!report) {
      node.textContent = "";
      node.className = "status";
      delete node.dataset.higherZoom;
      return;
    }
    let text = "";
    let tone = report.tone || "";
    if (report.kind === "added") {
      const parts = [t("statusAdded", { n: report.added })];
      if (report.higherZoom) parts.push(t("statusHigherZoom"));
      if (report.ignored) parts.push(t("statusIgnored", { n: report.ignored }));
      if (report.noQr) parts.push(t("statusNoQr"));
      if (report.errorKey) parts.push(t(report.errorKey));
      text = parts.join(" ");
      tone = "ok";
      node.dataset.higherZoom = report.higherZoom ? "1" : "0";
    } else {
      text = t(report.key, report.vars || {});
      delete node.dataset.higherZoom;
    }
    node.textContent = text;
    node.className = "status" + (tone ? " is-" + tone : "");
  }

  function groupSecret(value) {
    return String(value || "")
      .replace(/(.{4})/g, "$1 ")
      .trim();
  }

  function algoLabel(algorithm) {
    if (algorithm === "SHA1") return "SHA-1";
    if (algorithm === "SHA256") return "SHA-256";
    if (algorithm === "SHA512") return "SHA-512";
    return algorithm;
  }

  function wipe(account) {
    if (account.secret && account.secret.fill) account.secret.fill(0);
    account.secret = null;
    account.base32 = "";
    account.uri = "";
    account.current = "";
    account.next = "";
  }

  function accountTitle(account) {
    return account.name || t(account.nameKey || "manualAccount");
  }

  function paintSecret(account, node) {
    const shown = state.shown.has(account.id);
    node.textContent = shown ? groupSecret(account.base32) : t("secretHidden");
    node.dataset.shown = shown ? "1" : "0";
  }

  function renderAccount(account) {
    const card = el("article", "account");
    card.dataset.id = account.id;
    card.dataset.type = account.type;
    card.setAttribute("translate", "no");
    if (account.issuer) card.append(el("p", "issuer", account.issuer));
    const heading = el("h3", "account-name", accountTitle(account));
    card.append(heading);
    const meta = account.type === "hotp"
      ? t("metaHotp", {
          algo: algoLabel(account.algorithm),
          digits: account.digits,
          counter: account.counter.toString(),
        })
      : t("metaTotp", {
          algo: algoLabel(account.algorithm),
          digits: account.digits,
          period: account.period,
        });
    card.append(el("p", "meta", meta));

    const codes = el("div", "codes");
    const current = el("div", "code-card current");
    const currentLabel = el("p", "code-label", t("current"));
    currentLabel.id = account.id + "-current-label";
    const currentDigits = el("p", "digits digits-current", "…");
    currentDigits.setAttribute("aria-labelledby", currentLabel.id);
    currentDigits.setAttribute("aria-live", "polite");
    current.append(currentLabel, currentDigits, el("p", "countdown", ""));
    const next = el("div", "code-card");
    const nextLabel = el("p", "code-label", t("next"));
    nextLabel.id = account.id + "-next-label";
    const nextDigits = el("p", "digits digits-next", "…");
    nextDigits.setAttribute("aria-labelledby", nextLabel.id);
    next.append(nextLabel, nextDigits);
    codes.append(current, next);
    card.append(codes);

    const windowLine = el("p", "window", "");
    card.append(windowLine);

    const noteKeys = (account.assumptions || []).slice();
    if (account.unsupported) noteKeys.push(account.unsupported);
    if (noteKeys.length) {
      const list = el("ul", "notes");
      noteKeys.forEach(function (key) {
        list.append(el("li", "", t(key)));
      });
      card.append(list);
    }

    const fpRow = el("p", "fp-row");
    fpRow.append(el("span", "fp-label", t("fingerprint") + " "));
    fpRow.append(el("code", "fp", account.fingerprint || "…"));
    card.append(fpRow);
    card.append(el("p", "fp-help", t("fingerprintHelp")));

    const shown = state.shown.has(account.id);
    const secret = el("p", "secret", shown ? groupSecret(account.base32) : t("secretHidden"));
    secret.dataset.shown = shown ? "1" : "0";
    card.append(secret);

    const actions = el("div", "actions");
    const show = el("button", "show-secret", t(shown ? "hideSecret" : "showSecret"));
    show.type = "button";
    show.setAttribute("aria-pressed", shown ? "true" : "false");
    show.addEventListener("click", function () {
      toggleSecret(account.id);
    });
    const copySecret = el("button", "copy-secret", t("copySecret"));
    copySecret.type = "button";
    copySecret.addEventListener("click", function () {
      const found = findAccount(account.id);
      if (found) void copyText(found.base32, "statusCopiedSecret");
    });
    const copyUri = el("button", "copy-uri", t("copyUri"));
    copyUri.type = "button";
    copyUri.addEventListener("click", function () {
      const found = findAccount(account.id);
      if (found) void copyText(found.uri, "statusCopiedUri");
    });
    const copyFp = el("button", "copy-fp", t("copyFp"));
    copyFp.type = "button";
    copyFp.addEventListener("click", function () {
      const node = card.querySelector(".fp");
      if (node && node.textContent && node.textContent !== "…") {
        void copyText(node.textContent, "statusCopiedFp");
      }
    });
    const copyLink = el("button", "copy-link", t("copyLink"));
    copyLink.type = "button";
    copyLink.addEventListener("click", function () {
      const found = findAccount(account.id);
      if (found) void copyText(fragmentLink(found), "statusLinkCopied");
    });
    actions.append(show, copySecret, copyUri, copyFp, copyLink);
    card.append(actions);
    return card;
  }

  function findAccount(id) {
    for (let i = 0; i < state.accounts.length; i += 1) {
      if (state.accounts[i].id === id) return state.accounts[i];
    }
    return null;
  }

  function toggleSecret(id) {
    if (state.shown.has(id)) state.shown.delete(id);
    else state.shown.add(id);
    const account = findAccount(id);
    const card = root.document.querySelector('[data-id="' + id + '"]');
    if (!account || !card) return;
    paintSecret(account, card.querySelector(".secret"));
    const button = card.querySelector(".show-secret");
    const shown = state.shown.has(id);
    button.textContent = t(shown ? "hideSecret" : "showSecret");
    button.setAttribute("aria-pressed", shown ? "true" : "false");
  }

  function renderResults() {
    const rootNode = root.document.getElementById("results");
    rootNode.replaceChildren();
    if (!state.accounts.length) {
      rootNode.append(el("p", "empty", t("empty")));
      return;
    }
    for (let i = 0; i < state.accounts.length; i += 1) {
      rootNode.append(renderAccount(state.accounts[i]));
    }
  }

  function setDigits(card, current, next) {
    card.querySelector(".digits-current").textContent = current;
    card.querySelector(".digits-next").textContent = next;
  }

  async function paintCodes(account, now) {
    const card = root.document.querySelector('[data-id="' + account.id + '"]');
    if (!card) return;
    if (account.unsupported || account.algorithm === "MD5" || !account.secret) {
      setDigits(card, "—", "—");
      card.querySelector(".countdown").textContent = "";
      return;
    }
    if (!state.webcrypto) {
      setDigits(card, "—", "—");
      return;
    }
    try {
      if (!account.fingerprint) {
        const fp = await root.OtpTool.fingerprint(account.secret);
        account.fingerprint = fp.hex;
      }
      card.querySelector(".fp").textContent = account.fingerprint;
      if (account.type === "hotp") {
        if (!account.current) {
          account.current = await root.OtpTool.hotp(account.secret, account.counter, account);
          account.next = await root.OtpTool.hotp(account.secret, account.counter + 1n, account);
        }
        account.expiresIn = 0;
        setDigits(card, account.current, account.next);
        card.querySelector(".countdown").textContent = t("hotpNote");
        const win = card.querySelector(".window");
        win.textContent = t("windowHotp", {
          current: account.counter.toString(),
          next: (account.counter + 1n).toString(),
        });
        win.removeAttribute("data-start-ms");
        win.removeAttribute("data-end-ms");
        return;
      }
      const step = root.OtpTool.timeStep(now, account.period);
      const stepKey = step.toString();
      if (account.stepKey !== stepKey) {
        account.stepKey = stepKey;
        account.current = await root.OtpTool.hotp(account.secret, step, account);
        account.next = await root.OtpTool.hotp(account.secret, step + 1n, account);
      }
      const startSec = step * BigInt(account.period);
      const endSec = startSec + BigInt(account.period);
      let remain = Number(endSec) - Math.floor(now / 1000);
      if (remain <= 0) remain = account.period;
      account.expiresIn = remain;
      setDigits(card, account.current, account.next);
      card.querySelector(".countdown").textContent = t("countdown", { n: remain });
      const win = card.querySelector(".window");
      win.dataset.startMs = String(Number(startSec) * 1000);
      win.dataset.endMs = String(Number(endSec) * 1000);
      win.textContent = t("windowUntil", {
        start: formatWhen(Number(startSec) * 1000, state.timeZone),
        end: formatWhen(Number(endSec) * 1000, state.timeZone),
        zone: state.timeZone,
      });
    } catch (error) {
      setDigits(card, "—", "—");
    }
  }

  async function refreshCodes() {
    if (refreshing) {
      refreshQueued = true;
      return;
    }
    refreshing = true;
    try {
      do {
        refreshQueued = false;
        const now = Date.now();
        paintClocks(now);
        for (let i = 0; i < state.accounts.length; i += 1) {
          await paintCodes(state.accounts[i], now);
        }
        updateBot();
      } while (refreshQueued);
    } finally {
      refreshing = false;
    }
  }

  function appendAccounts(accounts, meta) {
    for (let i = 0; i < accounts.length; i += 1) {
      state.nextId += 1;
      accounts[i].id = "a" + state.nextId;
      state.accounts.push(accounts[i]);
    }
    renderResults();
    state.report = {
      kind: "added",
      added: accounts.length,
      higherZoom: !!meta.higherZoom,
      ignored: meta.ignored || 0,
      noQr: !!meta.noQr,
      errorKey: meta.errorKey || "",
    };
    paintReport();
    chime("ok");
    void refreshCodes();
  }

  function mapError(code) {
    if (code === "pdfNeedsHttp") return "statusPdfFile";
    if (code === "pdfLoadFailed") return "statusPdfFail";
    if (code === "pdfPassword") return "statusPdfPassword";
    return "statusImageFail";
  }

  async function handleFiles(list) {
    const files = Array.from(list || []);
    if (!files.length) return;
    const results = root.document.getElementById("results");
    const gen = (state.generation += 1);
    results.setAttribute("aria-busy", "true");
    state.report = { kind: "key", key: "statusReading", vars: { n: files.length }, tone: "" };
    paintReport();
    const batch = [];
    let ignored = 0;
    let noQr = 0;
    let higherZoom = false;
    let errorKey = "";
    try {
      for (let i = 0; i < files.length; i += 1) {
        if (gen !== state.generation) return;
        try {
          const result = await root.OtpTool.readFile(
            files[i],
            function () {
              return gen === state.generation;
            },
            function (info) {
              if (gen !== state.generation || !info) return;
              state.report = {
                kind: "key",
                key: "statusPage",
                vars: { page: info.page, pages: info.pages },
                tone: "",
              };
              paintReport();
            }
          );
          if (gen !== state.generation) return;
          if (result.higherZoom) higherZoom = true;
          if (!result.payloads.length) {
            noQr += 1;
            continue;
          }
          for (let p = 0; p < result.payloads.length; p += 1) {
            const parsed = root.OtpTool.parsePayload(result.payloads[p]);
            if (!parsed.accounts.length) ignored += parsed.errors.length || 1;
            else {
              for (let a = 0; a < parsed.accounts.length; a += 1) batch.push(parsed.accounts[a]);
              ignored += parsed.errors.length;
            }
          }
        } catch (error) {
          errorKey = mapError(error && error.code);
        }
      }
      if (gen !== state.generation) return;
      if (!batch.length && errorKey && !noQr && !ignored) {
        state.report = { kind: "key", key: errorKey, tone: "bad" };
        paintReport();
        chime("bad");
        return;
      }
      if (!batch.length) {
        state.report = {
          kind: "key",
          key: ignored ? "statusIgnored" : "statusNoQr",
          vars: { n: ignored },
          tone: "bad",
        };
        paintReport();
        chime("bad");
        return;
      }
      appendAccounts(batch, {
        higherZoom: higherZoom,
        ignored: ignored,
        noQr: noQr > 0,
        errorKey: errorKey,
      });
    } finally {
      if (gen !== state.generation) {
        for (let i = 0; i < batch.length; i += 1) wipe(batch[i]);
      }
      results.setAttribute("aria-busy", "false");
    }
  }

  function decodeText() {
    const field = root.document.getElementById("fallback");
    const text = field.value;
    if (!String(text).trim()) {
      state.report = { kind: "key", key: "statusDecodeEmpty", tone: "bad" };
      paintReport();
      chime("bad");
      return;
    }
    const parsed = root.OtpTool.parsePayload(text);
    if (!parsed.accounts.length) {
      state.report = { kind: "key", key: parsed.errors[0] || "badOtp", tone: "bad" };
      paintReport();
      chime("bad");
      return;
    }
    field.value = "";
    appendAccounts(parsed.accounts, { ignored: parsed.errors.length, higherZoom: false, noQr: false });
  }

  async function copyText(value, statusKey) {
    try {
      if (!root.navigator.clipboard || !root.navigator.clipboard.writeText) throw new Error("copy");
      await root.navigator.clipboard.writeText(value);
      state.report = { kind: "key", key: statusKey, tone: "ok" };
    } catch (error) {
      state.report = { kind: "key", key: "statusCopyFail", tone: "bad" };
    }
    paintReport();
  }

  function clearAll() {
    state.generation += 1;
    for (let i = 0; i < state.accounts.length; i += 1) wipe(state.accounts[i]);
    state.accounts = [];
    state.shown.clear();
    root.document.getElementById("fallback").value = "";
    root.document.getElementById("file").value = "";
    renderResults();
    state.report = { kind: "key", key: "statusCleared", tone: "ok" };
    paintReport();
  }

  function syncInputToggle() {
    const button = root.document.getElementById("toggle-input");
    const field = root.document.getElementById("fallback");
    field.classList.toggle("is-revealed", state.inputRevealed);
    button.textContent = t(state.inputRevealed ? "hideInput" : "showInput");
    button.setAttribute("aria-pressed", state.inputRevealed ? "true" : "false");
  }

  function setLanguage(next) {
    root.OtpI18n.use(next);
    root.OtpI18n.apply(root.document);
    fillZones();
    syncInputToggle();
    syncMute();
    renderResults();
    paintReport();
    const banner = root.document.getElementById("webcrypto");
    banner.hidden = !!state.webcrypto;
    void refreshCodes();
  }

  function syncMute() {
    const button = root.document.getElementById("mute");
    if (!button) return;
    button.textContent = t(state.muted ? "muted" : "mute");
    button.setAttribute("aria-pressed", state.muted ? "true" : "false");
  }

  function chime(kind) {
    if (state.muted || state.bot) return;
    try {
      const Ctx = root.AudioContext || root.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = kind === "ok" ? 880 : 196;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "ok" ? 0.15 : 0.24));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
      osc.onended = function () {
        ctx.close();
      };
    } catch (error) {
      /* Autoplay policies and headless browsers may refuse audio. */
    }
  }

  function acceptZone(value) {
    if (!value) return "";
    try {
      const known = Intl.supportedValuesOf("timeZone");
      if (value === "UTC" || known.indexOf(value) !== -1) return value;
    } catch (error) {
      if (value === "UTC" || /^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value)) return value;
    }
    return "";
  }

  function tune(account, params) {
    if (params.digits === "6" || params.digits === "8") account.digits = Number(params.digits);
    if (account.type === "totp" && /^[0-9]+$/.test(params.period || "")) {
      const period = Number(params.period);
      if (period >= 1 && period <= 86400) account.period = period;
    }
    const algorithm = (params.algorithm || "").toUpperCase().replace(/-/g, "");
    if (algorithm === "SHA1" || algorithm === "SHA256" || algorithm === "SHA512") {
      account.algorithm = algorithm;
      account.unsupported = "";
    }
    account.base32 = root.OtpTool.base32Encode(account.secret);
    account.uri = root.OtpTool.buildUri(account);
    account.current = "";
    account.next = "";
    account.stepKey = "";
    return account;
  }

  function fragmentLink(account) {
    const params = new URLSearchParams();
    params.set("secret", account.base32);
    if (account.digits !== 6) params.set("digits", String(account.digits));
    if (account.type === "totp" && account.period !== 30) params.set("period", String(account.period));
    if (account.algorithm && account.algorithm !== "SHA1") params.set("algorithm", account.algorithm);
    const current = new URL(root.location.href);
    return current.origin + current.pathname + "#" + params.toString();
  }

  function updateBot() {
    if (!state.bot || !state.accounts.length) return;
    const account = state.accounts[0];
    if (!account.current) return;
    const expires = account.expiresIn == null ? 0 : account.expiresIn;
    if (state.params && state.params.justCode) {
      const node = root.document.getElementById("code");
      node.textContent = account.current;
      node.setAttribute("data-next", account.next || "");
      node.setAttribute("data-expires-in", String(expires));
      root.document.title = account.current;
    }
    if (state.params && state.params.format === "json") {
      root.document.getElementById("json").textContent = JSON.stringify({
        code: account.current,
        next: account.next || "",
        expires_in: expires,
        period: account.period || 30,
        digits: account.digits,
      });
    }
  }

  function remoteError(name) {
    const error = new Error(name);
    error.code = name;
    return error;
  }

  async function loadRemote(raw) {
    const href = root.OtpTool.allowedRemoteUrl(raw);
    if (!href) {
      state.report = { kind: "key", key: "remoteBlocked", tone: "bad" };
      paintReport();
      chime("bad");
      return;
    }
    try {
      const response = await root.fetch(href, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        mode: "cors",
      });
      if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
        throw remoteError("remoteRedirect");
      }
      if (!response.ok) throw remoteError("remoteFetch");
      if (response.url && !root.OtpTool.allowedRemoteUrl(response.url)) throw remoteError("remoteBlocked");
      const blob = await response.blob();
      const leaf = new URL(href).pathname.split("/").pop() || "remote.bin";
      await handleFiles([new File([blob], leaf, { type: blob.type || "" })]);
    } catch (error) {
      if (error && (error.code === "remoteRedirect" || error.code === "remoteFetch" || error.code === "remoteBlocked")) {
        state.report = { kind: "key", key: error.code, tone: "bad" };
      } else {
        state.report = { kind: "key", key: "remoteCors", tone: "bad" };
      }
      paintReport();
      chime("bad");
    }
  }

  async function bootParams(params) {
    if (params.secret) {
      const parsed = root.OtpTool.parsePayload(params.secret);
      const accounts = [];
      for (let i = 0; i < parsed.accounts.length; i += 1) accounts.push(tune(parsed.accounts[i], params));
      if (accounts.length) appendAccounts(accounts, {});
      else {
        state.report = { kind: "key", key: parsed.errors[0] || "badOtp", tone: "bad" };
        paintReport();
        chime("bad");
      }
    }
    if (params.url) await loadRemote(params.url);
  }

  function init() {
    const params = root.OtpTool.readPageParams();
    state.params = params;
    state.bot = !!(params.justCode || params.format === "json");
    if (params.lang === "pt") root.OtpI18n.use("pt-BR");
    else if (params.lang === "en") root.OtpI18n.use("en");
    else root.OtpI18n.use(root.OtpI18n.detect());
    const zone = acceptZone(params.tz);
    if (zone) state.timeZone = zone;
    if (state.bot) {
      state.muted = true;
      root.document.body.classList.add("is-bot");
      if (params.justCode) root.document.getElementById("code").hidden = false;
      if (params.format === "json") root.document.getElementById("json").hidden = false;
    }
    root.OtpI18n.apply(root.document);
    fillZones();
    syncInputToggle();
    syncMute();
    renderResults();
    const banner = root.document.getElementById("webcrypto");
    banner.hidden = !!state.webcrypto;
    paintClocks(Date.now());

    root.document.getElementById("skip").addEventListener("click", function () {
      const target = root.document.getElementById("results");
      if (target) target.focus();
    });
    root.document.getElementById("mute").addEventListener("click", function () {
      state.muted = !state.muted;
      syncMute();
    });
    root.document.getElementById("lang-pt").addEventListener("click", function () {
      setLanguage("pt-BR");
    });
    root.document.getElementById("lang-en").addEventListener("click", function () {
      setLanguage("en");
    });
    root.document.getElementById("tz").addEventListener("change", function (event) {
      state.timeZone = event.target.value || "America/Sao_Paulo";
      void refreshCodes();
    });
    root.document.getElementById("clear").addEventListener("click", clearAll);
    root.document.getElementById("decode-text").addEventListener("click", decodeText);
    root.document.getElementById("toggle-input").addEventListener("click", function () {
      state.inputRevealed = !state.inputRevealed;
      syncInputToggle();
    });
    const field = root.document.getElementById("fallback");
    field.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        decodeText();
      }
    });
    const input = root.document.getElementById("file");
    input.addEventListener("change", function () {
      const files = Array.from(input.files || []);
      input.value = "";
      void handleFiles(files);
    });
    const drop = root.document.getElementById("drop");
    ["dragenter", "dragover"].forEach(function (type) {
      drop.addEventListener(type, function (event) {
        event.preventDefault();
        drop.classList.add("is-hot");
      });
    });
    drop.addEventListener("dragleave", function () {
      drop.classList.remove("is-hot");
    });
    drop.addEventListener("drop", function (event) {
      event.preventDefault();
      drop.classList.remove("is-hot");
      const files = event.dataTransfer && event.dataTransfer.files;
      if (files && files.length) void handleFiles(files);
    });
    root.addEventListener(
      "paste",
      function (event) {
        const items = event.clipboardData && event.clipboardData.items;
        if (!items) return;
        const files = [];
        for (let i = 0; i < items.length; i += 1) {
          const item = items[i];
          if (item.kind === "file" && item.type && item.type.indexOf("image/") === 0) {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
        if (!files.length) return;
        event.preventDefault();
        void handleFiles(files);
      },
      true
    );
    root.setInterval(function () {
      void refreshCodes();
    }, 500);
    if (params.secret || params.url) void bootParams(params);
  }

  init();
})(typeof globalThis !== "undefined" ? globalThis : window);
