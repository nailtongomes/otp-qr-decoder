(function (root) {
  const KEYS = ["secret", "url", "just_code", "format", "digits", "period", "algorithm", "lang", "tz"];
  const ALLOWED_ORIGINS = {
    "https://arquivos.n3wizards.com": true,
    "https://minio.n3wizards.com": true,
  };

  // Move supported keys off the query string before any other work. The query
  // is sent to the server; the fragment is not. Never log these values.
  function migrateQuery() {
    const current = new URL(root.location.href);
    if (!current.search) return;
    const incoming = current.searchParams;
    const hash = new URLSearchParams(current.hash.startsWith("#") ? current.hash.slice(1) : "");
    for (let i = 0; i < KEYS.length; i += 1) {
      const key = KEYS[i];
      if (!incoming.has(key)) continue;
      hash.set(key, incoming.get(key));
    }
    const nextHash = hash.toString();
    root.history.replaceState(null, "", current.pathname + (nextHash ? "#" + nextHash : ""));
  }

  function readPageParams() {
    migrateQuery();
    const hash = new URLSearchParams(root.location.hash.startsWith("#") ? root.location.hash.slice(1) : "");
    const format = (hash.get("format") || "").toLowerCase();
    return {
      secret: hash.get("secret") || "",
      url: hash.get("url") || "",
      justCode: hash.get("just_code") === "1",
      format: format === "json" ? "json" : "",
      digits: hash.get("digits") || "",
      period: hash.get("period") || "",
      algorithm: hash.get("algorithm") || "",
      lang: (hash.get("lang") || "").toLowerCase(),
      tz: hash.get("tz") || "",
    };
  }

  function allowedRemoteUrl(value) {
    let url;
    try {
      url = new URL(value);
    } catch (error) {
      return "";
    }
    if (url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    if (!ALLOWED_ORIGINS[url.origin]) return "";
    return url.href;
  }

  migrateQuery();
  const OtpTool = root.OtpTool || (root.OtpTool = {});
  OtpTool.readPageParams = readPageParams;
  OtpTool.allowedRemoteUrl = allowedRemoteUrl;
})(typeof globalThis !== "undefined" ? globalThis : window);
