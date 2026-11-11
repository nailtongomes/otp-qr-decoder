(function (root) {
  const OtpTool = root.OtpTool || (root.OtpTool = {});

  function normAlgo(value) {
    const text = String(value || "SHA1")
      .trim()
      .toUpperCase()
      .replace(/-/g, "");
    if (text === "SHA1" || text === "SHA256" || text === "SHA512" || text === "MD5") return text;
    throw OtpTool.codeError("badOtp");
  }

  function normDigits(value) {
    if (value == null || String(value).trim() === "") return 6;
    const text = String(value).trim();
    if (!/^[0-9]+$/.test(text)) throw OtpTool.codeError("badOtp");
    const number = Number(text);
    if (number === 6 || number === 8) return number;
    throw OtpTool.codeError("badOtp");
  }

  function normPeriod(value) {
    if (value == null || String(value).trim() === "") return 30;
    const text = String(value).trim();
    if (!/^[0-9]+$/.test(text)) throw OtpTool.codeError("badOtp");
    const number = Number(text);
    if (number >= 1 && number <= 86400) return number;
    throw OtpTool.codeError("badOtp");
  }

  function normCounter(value) {
    if (value == null || String(value).trim() === "") throw OtpTool.codeError("badOtp");
    const text = String(value).trim();
    if (!/^[0-9]+$/.test(text)) throw OtpTool.codeError("badOtp");
    return BigInt(text);
  }

  function splitLabel(name, issuer) {
    let account = name || "";
    let who = issuer || "";
    if (who && account.startsWith(who + ":")) account = account.slice(who.length + 1);
    else if (!who && account.includes(":")) {
      const index = account.indexOf(":");
      who = account.slice(0, index);
      account = account.slice(index + 1);
    }
    return { issuer: who.trim(), name: account.trim() };
  }

  function finish(account) {
    account.base32 = OtpTool.base32Encode(account.secret);
    if (account.algorithm === "MD5") account.unsupported = "unsupportedAlgo";
    account.uri = buildUri(account);
    return account;
  }

  function buildUri(account) {
    const labelName = account.name || "account";
    const label = account.issuer
      ? encodeURIComponent(account.issuer) + ":" + encodeURIComponent(labelName)
      : encodeURIComponent(labelName);
    const params = new URLSearchParams();
    params.set("secret", account.base32);
    if (account.issuer) params.set("issuer", account.issuer);
    params.set("algorithm", account.algorithm);
    params.set("digits", String(account.digits));
    if (account.type === "hotp") params.set("counter", account.counter.toString());
    else params.set("period", String(account.period || 30));
    return "otpauth://" + account.type + "/" + label + "?" + params.toString();
  }

  function accountFromRecord(fields, assumptions) {
    const names = splitLabel(fields.name, fields.issuer);
    const type = fields.type;
    const account = {
      type: type,
      issuer: names.issuer,
      name: names.name,
      nameKey: names.name ? "" : "manualAccount",
      secret: fields.secret,
      algorithm: fields.algorithm,
      digits: fields.digits,
      period: type === "totp" ? fields.period : null,
      counter: type === "hotp" ? fields.counter : null,
      assumptions: assumptions || [],
      unsupported: "",
    };
    return finish(account);
  }

  function mapMigration(record) {
    let algorithm = "SHA1";
    if (record.algorithm === 2) algorithm = "SHA256";
    else if (record.algorithm === 3) algorithm = "SHA512";
    else if (record.algorithm === 4) algorithm = "MD5";
    else if (record.algorithm !== 0 && record.algorithm !== 1) throw OtpTool.codeError("badOtp");

    let digits = 6;
    if (record.digits === 2) digits = 8;
    else if (record.digits !== 0 && record.digits !== 1) throw OtpTool.codeError("badOtp");

    let type = "totp";
    if (record.type === 1) type = "hotp";
    else if (record.type !== 0 && record.type !== 2) throw OtpTool.codeError("badOtp");

    if (!record.secret || !record.secret.length) throw OtpTool.codeError("badOtp");
    const assumptions = [];
    if (type === "totp") assumptions.push("migrationPeriod");
    return accountFromRecord(
      {
        type: type,
        name: record.name,
        issuer: record.issuer,
        secret: record.secret,
        algorithm: algorithm,
        digits: digits,
        period: 30,
        counter: record.counter < 0n ? 0n : record.counter,
      },
      assumptions
    );
  }

  // URLSearchParams turns "+" into a space. Base64 secrets in migration
  // links often contain a literal "+". Read the query without that rule.
  function rawQuery(uri, name) {
    const queryStart = uri.indexOf("?");
    if (queryStart < 0) return null;
    const hash = uri.indexOf("#", queryStart);
    const query = uri.slice(queryStart + 1, hash === -1 ? uri.length : hash);
    const parts = query.split("&");
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      const eq = part.indexOf("=");
      const rawKey = eq === -1 ? part : part.slice(0, eq);
      const rawValue = eq === -1 ? "" : part.slice(eq + 1);
      let key;
      try {
        key = decodeURIComponent(rawKey);
      } catch (error) {
        continue;
      }
      if (key !== name) continue;
      try {
        return decodeURIComponent(rawValue);
      } catch (error) {
        throw OtpTool.codeError("badOtp");
      }
    }
    return null;
  }

  function bytesFromBase64(input) {
    const cleaned = String(input || "")
      .replace(/\s/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    if (!cleaned || /[^A-Za-z0-9+/=]/.test(cleaned)) throw OtpTool.codeError("badOtp");
    const pad = cleaned.length % 4 === 0 ? cleaned : cleaned + "====".slice(cleaned.length % 4);
    let binary;
    try {
      binary = atob(pad);
    } catch (error) {
      throw OtpTool.codeError("badOtp");
    }
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }

  function parseMigrationUri(uri) {
    const data = rawQuery(uri, "data");
    if (!data) throw OtpTool.codeError("badOtp");
    const records = OtpTool.decodeMigration(bytesFromBase64(data));
    if (!records.length) throw OtpTool.codeError("badOtp");
    const accounts = [];
    for (let i = 0; i < records.length; i += 1) accounts.push(mapMigration(records[i]));
    return accounts;
  }

  function parseOtpauth(uri) {
    let url;
    try {
      url = new URL(uri);
    } catch (error) {
      throw OtpTool.codeError("badOtp");
    }
    const type = (url.hostname || "").toLowerCase();
    if (type !== "totp" && type !== "hotp") throw OtpTool.codeError("badOtp");
    let label = url.pathname.replace(/^\/+/, "");
    try {
      label = decodeURIComponent(label);
    } catch (error) {
      /* keep the raw path */
    }
    const secretParam = url.searchParams.get("secret");
    if (!secretParam) throw OtpTool.codeError("badOtp");
    const secret = OtpTool.base32Decode(secretParam);
    const names = splitLabel(label, url.searchParams.get("issuer") || "");
    return accountFromRecord(
      {
        type: type,
        name: names.name,
        issuer: names.issuer,
        secret: secret,
        algorithm: normAlgo(url.searchParams.get("algorithm")),
        digits: normDigits(url.searchParams.get("digits")),
        period: type === "totp" ? normPeriod(url.searchParams.get("period")) : null,
        counter: type === "hotp" ? normCounter(url.searchParams.get("counter")) : null,
      },
      []
    );
  }

  function accountFromBase32(text) {
    const normalized = OtpTool.normalizeBase32(text);
    if (normalized.length < 8) throw OtpTool.codeError("badOtp");
    const secret = OtpTool.base32Decode(normalized);
    return accountFromRecord(
      {
        type: "totp",
        name: "",
        issuer: "",
        secret: secret,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        counter: null,
      },
      ["assumed"]
    );
  }

  function parsePayload(text) {
    const accounts = [];
    const errors = [];
    const raw = String(text || "")
      .replace(/^\uFEFF/, "")
      .trim();
    if (!raw) return { accounts: accounts, errors: errors };
    if (raw.length > 100000) {
      errors.push("badOtp");
      return { accounts: accounts, errors: errors };
    }
    const uris = raw.match(/otpauth(?:-migration)?:\/\/[^\s]+/gi);
    if (uris && uris.length) {
      for (let i = 0; i < uris.length; i += 1) {
        const uri = uris[i];
        try {
          if (/^otpauth-migration:/i.test(uri)) {
            const parsed = parseMigrationUri(uri);
            for (let j = 0; j < parsed.length; j += 1) accounts.push(parsed[j]);
          } else {
            accounts.push(parseOtpauth(uri));
          }
        } catch (error) {
          errors.push(error && error.code ? error.code : "badOtp");
        }
      }
      return { accounts: accounts, errors: errors };
    }
    try {
      accounts.push(accountFromBase32(raw));
    } catch (error) {
      errors.push(error && error.code ? error.code : "badOtp");
    }
    return { accounts: accounts, errors: errors };
  }

  OtpTool.parsePayload = parsePayload;
  OtpTool.buildUri = buildUri;
})(typeof globalThis !== "undefined" ? globalThis : window);
