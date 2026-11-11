(function (root) {
  const STRINGS = {
    en: {
      title: "OTP QR decoder",
      subtitle: "Read a setup QR in this tab. The secret is not uploaded.",
      kicker: "On this device only",
      langLabel: "Language",
      skip: "Skip to codes",
      clockHeading: "Clocks",
      clockNote:
        "Codes use UTC and this device's clock. The timezone only changes how the validity window is written. Compare UTC with a clock you trust.",
      clockDevice: "Device",
      clockUtc: "UTC",
      clockRef: "Reference",
      tzLabel: "Reference timezone",
      tzHelp: "Kept in memory until you close this tab. Not written to disk.",
      tzCommon: "Common",
      tzAll: "All",
      inputHeading: "Add a code",
      dropTitle: "Drop an image or PDF, or choose a file",
      dropHelp:
        "PNG, JPEG, WebP, or a PDF (every page). Paste a screenshot with Ctrl+V or ⌘V. No camera. New files are added until you press Clear.",
      fallbackLabel: "Or paste an otpauth link or a Base32 secret",
      fallbackHelp: "This box is cleared after a successful decode.",
      decodeText: "Decode text",
      showInput: "Show text",
      hideInput: "Hide text",
      resultsHeading: "Codes",
      clear: "Clear",
      empty: "No codes yet.",
      webcrypto:
        "This browser does not offer WebCrypto in this context, so live codes cannot be computed. The secret can still be read.",
      statusReading: "Reading {n} file(s)…",
      statusPage: "Rendering PDF page {page} of {pages}…",
      statusAdded: "Added {n} account(s).",
      statusNoQr: "No QR code found.",
      statusIgnored: "Ignored {n} QR code(s) that were not OTP setup codes.",
      statusHigherZoom: "A PDF page had to be rendered at a higher zoom before a QR code appeared.",
      statusCleared: "Cleared from this tab.",
      statusDecodeEmpty: "Nothing to decode.",
      statusPdfFail: "Could not read this PDF.",
      statusPdfPassword: "This PDF is password-protected. This tool does not open protected PDFs.",
      statusImageFail: "Could not read this image.",
      statusPdfFile:
        "Opening a PDF from a file:// address is usually blocked. Use the hosted page or a local static server.",
      statusCopiedSecret: "Secret copied.",
      statusCopiedUri: "otpauth link copied.",
      statusCopiedFp: "Fingerprint copied.",
      statusCopyFail: "Copy failed. Press Show and select the text. Some browsers only allow the clipboard on HTTPS or localhost.",
      statusIgnoredUrl: "Ignored data in the page address. Addresses leak. Paste the code into the box if you meant to decode it.",
      badOtp: "Could not read that as an otpauth link or a Base32 secret.",
      secretHidden: "Hidden",
      showSecret: "Show",
      hideSecret: "Hide",
      copySecret: "Copy secret",
      copyUri: "Copy otpauth",
      copyFp: "Copy fingerprint",
      current: "Current",
      next: "Next",
      countdown: "Refreshes in {n}s",
      hotpNote: "HOTP uses a counter, not the clock.",
      windowUntil: "Valid from {start} until {end} ({zone}). The end time is the first moment of the next code.",
      windowHotp: "Code for counter {current}. The next code is counter {next}.",
      fingerprint: "Secret fingerprint",
      fingerprintHelp:
        "First 8 hex characters of SHA-256 of the Base32 secret (uppercase, no spaces, no padding). Compare this instead of the secret. It is a short check value, not the full hash.",
      assumed: "This text did not include an algorithm, digit count, or period. Using SHA-1, 6 digits, and 30 seconds.",
      migrationPeriod: "This Google Authenticator export does not include a period. Using 30 seconds.",
      unsupportedAlgo: "MD5 is not computed here (WebCrypto has no MD5). The secret is available to copy; no code was produced.",
      metaTotp: "TOTP · {algo} · {digits} digits · {period}s",
      metaHotp: "HOTP · {algo} · {digits} digits · counter {counter}",
      manualAccount: "Pasted secret",
      privacyHeading: "How we protect your data",
      privacyLead:
        "The point of this page is to read a 2FA setup code without sending the secret anywhere.",
      p1: "Decoding, PDF rendering, and the TOTP math all run in this tab, on this device.",
      p2: "The page may fetch a file only from https://arquivos.n3wizards.com or https://minio.n3wizards.com, and only when the address asks for one. Every other host is blocked. There is no analytics.",
      p3: "Scripts and styles are files shipped with this page. jsQR 1.4.0 (Apache-2.0) and PDF.js 6.5.438 (Apache-2.0) are stored in this project. There is no CDN and no web font.",
      p4: "Nothing is written to localStorage, sessionStorage, IndexedDB, or cookies. Language and timezone live in memory for this tab only.",
      p5: "Clear drops the decoded secrets from the page. Closing the tab does the same. Clear cannot erase the system clipboard if you already copied a secret, and it cannot delete a screenshot.",
      p6: "Secrets stay masked until you press Show. The fingerprint is not the secret.",
      p7: "There is no camera.",
      verifyHeading: "How to verify",
      v1: "Open DevTools → Network, reload, and decode a code. You should only see this site's own files: the page, CSS, JS, and, for a PDF, the PDF.js worker. No other host. Then set the browser offline and decode an image again.",
      v2: "View the page source and find the Content-Security-Policy tag. connect-src lists only arquivos.n3wizards.com and minio.n3wizards.com. There are no third-party script URLs.",
      v3: "After Clear, the secret is gone from the page. It is not stored for the next visit.",
      timeHeading: "Codes and time",
      t1: "A TOTP code is a function of the secret and the UTC time step. Changing the timezone menu does not change the code.",
      t2: "The device clock is the only clock available. It is not corrected from the internet, on purpose.",
      t3: "The validity window is that same UTC interval, written in the reference timezone. The default is America/Sao_Paulo.",
      fileHeading: "Opening the saved page from disk",
      f1: "Image decode uses ordinary script files, so a saved copy opened as file:// still reads PNG, JPEG, and WebP in current Chrome and Firefox.",
      f2: "PDF decode loads PDF.js as a module and a worker. Browsers usually block that from file://. Use the hosted page, or run python3 -m http.server in the saved folder and open the localhost address.",
      f3: "Live codes and clipboard copy need WebCrypto. Current Chrome and Firefox treat file:// as a secure context. If a browser does not, parsing still works and the codes are not computed. localhost is a secure context.",
      learnMore: "Learn more",
      mute: "Mute",
      muted: "Muted",
      copyLink: "Copy link",
      statusLinkCopied: "Link copied. The link contains the secret.",
      remoteBlocked: "That file was not requested. Only arquivos.n3wizards.com and minio.n3wizards.com over HTTPS are allowed.",
      remoteCors: "Could not fetch the file. The bucket must allow this page's origin in CORS. See the README.",
      remoteRedirect: "That file redirects somewhere else, so it was not downloaded.",
      remoteFetch: "The file server returned an error.",
      footer: "Nailton Gomes · MIT · jsQR 1.4.0 · PDF.js 6.5.438. Secrets stay in this tab.",
    },
    "pt-BR": {
      title: "Decodificador de QR OTP",
      subtitle: "Leia um QR de configuração nesta aba. O segredo não é enviado.",
      kicker: "Só neste aparelho",
      langLabel: "Idioma",
      skip: "Ir para os códigos",
      clockHeading: "Relógios",
      clockNote:
        "Os códigos usam UTC e o relógio deste aparelho. O fuso só muda como a janela de validade é escrita. Compare o UTC com um relógio em que você confia.",
      clockDevice: "Aparelho",
      clockUtc: "UTC",
      clockRef: "Referência",
      tzLabel: "Fuso de referência",
      tzHelp: "Fica na memória até você fechar esta aba. Não é gravado no disco.",
      tzCommon: "Comuns",
      tzAll: "Todos",
      inputHeading: "Adicionar um código",
      dropTitle: "Solte uma imagem ou PDF, ou escolha um arquivo",
      dropHelp:
        "PNG, JPEG, WebP ou um PDF (todas as páginas). Cole uma captura com Ctrl+V ou ⌘V. Sem câmera. Arquivos novos entram na lista até você limpar.",
      fallbackLabel: "Ou cole um link otpauth ou um segredo em Base32",
      fallbackHelp: "Este campo é apagado depois de uma leitura bem-sucedida.",
      decodeText: "Decodificar texto",
      showInput: "Mostrar texto",
      hideInput: "Ocultar texto",
      resultsHeading: "Códigos",
      clear: "Limpar",
      empty: "Nenhum código ainda.",
      webcrypto:
        "Este navegador não oferece WebCrypto neste contexto, então os códigos ao vivo não podem ser calculados. O segredo ainda pode ser lido.",
      statusReading: "Lendo {n} arquivo(s)…",
      statusPage: "Renderizando a página {page} de {pages} do PDF…",
      statusAdded: "{n} conta(s) adicionada(s).",
      statusNoQr: "Nenhum QR encontrado.",
      statusIgnored: "{n} QR ignorado(s) porque não eram códigos de configuração OTP.",
      statusHigherZoom: "Uma página do PDF precisou de mais zoom para o QR aparecer.",
      statusCleared: "Apagado desta aba.",
      statusDecodeEmpty: "Nada para decodificar.",
      statusPdfFail: "Não foi possível ler este PDF.",
      statusPdfPassword: "Este PDF pede senha. Esta ferramenta não abre PDFs protegidos.",
      statusImageFail: "Não foi possível ler esta imagem.",
      statusPdfFile:
        "Abrir um PDF num endereço file:// costuma ser bloqueado. Use a página publicada ou um servidor local.",
      statusCopiedSecret: "Segredo copiado.",
      statusCopiedUri: "Link otpauth copiado.",
      statusCopiedFp: "Impressão copiada.",
      statusCopyFail:
        "A cópia falhou. Use Mostrar e selecione o texto. Em alguns navegadores a área de transferência só funciona em HTTPS ou localhost.",
      statusIgnoredUrl:
        "Ignorei dados no endereço da página. Endereços vazam. Cole o código no campo se era isso que você queria ler.",
      badOtp: "Não consegui ler isso como um link otpauth nem como um segredo Base32.",
      secretHidden: "Oculto",
      showSecret: "Mostrar",
      hideSecret: "Ocultar",
      copySecret: "Copiar segredo",
      copyUri: "Copiar otpauth",
      copyFp: "Copiar impressão",
      current: "Atual",
      next: "Próximo",
      countdown: "Atualiza em {n} s",
      hotpNote: "HOTP usa contador, não o relógio.",
      windowUntil: "Válido de {start} até {end} ({zone}). O horário final é o primeiro instante do próximo código.",
      windowHotp: "Código do contador {current}. O próximo é o contador {next}.",
      fingerprint: "Impressão do segredo",
      fingerprintHelp:
        "Primeiros 8 caracteres hexadecimais do SHA-256 do segredo em Base32 (maiúsculas, sem espaços e sem =). Compare isto em vez do segredo. É uma checagem curta, não o hash inteiro.",
      assumed: "Este texto não traz algoritmo, dígitos nem período. Usamos SHA-1, 6 dígitos e 30 segundos.",
      migrationPeriod: "A exportação do Google Authenticator não inclui o período. Usamos 30 segundos.",
      unsupportedAlgo:
        "MD5 não é calculado aqui (o WebCrypto não oferece MD5). O segredo pode ser copiado; nenhum código foi gerado.",
      metaTotp: "TOTP · {algo} · {digits} dígitos · {period} s",
      metaHotp: "HOTP · {algo} · {digits} dígitos · contador {counter}",
      manualAccount: "Segredo colado",
      privacyHeading: "Como protegemos os seus dados",
      privacyLead: "Esta página existe para ler um QR de 2FA sem enviar o segredo a lugar nenhum.",
      p1: "A decodificação, a renderização do PDF e a conta TOTP acontecem nesta aba, neste aparelho.",
      p2: "A página só busca um arquivo em https://arquivos.n3wizards.com ou https://minio.n3wizards.com, e só quando o endereço pede isso. Qualquer outro host é bloqueado. Não há análise de uso.",
      p3: "Scripts e estilos são arquivos desta página. jsQR 1.4.0 (Apache-2.0) e PDF.js 6.5.438 (Apache-2.0) estão neste projeto. Não há CDN nem fonte da web.",
      p4: "Nada é gravado em localStorage, sessionStorage, IndexedDB ou cookies. Idioma e fuso ficam só na memória desta aba.",
      p5: "Limpar tira os segredos decodificados da página. Fechar a aba faz o mesmo. Limpar não apaga a área de transferência do sistema se você já copiou um segredo, nem apaga uma captura de tela.",
      p6: "O segredo fica oculto até você tocar em Mostrar. A impressão não é o segredo.",
      p7: "Não há câmera.",
      verifyHeading: "Como verificar",
      v1: "Abra DevTools → Rede, recarregue e decodifique um código. Você deve ver só os arquivos deste site: a página, o CSS, o JS e, num PDF, o worker do PDF.js. Nenhum outro host. Depois coloque o navegador offline e decodifique uma imagem de novo.",
      v2: "Veja o código-fonte e ache a tag Content-Security-Policy. connect-src lista só arquivos.n3wizards.com e minio.n3wizards.com. Não há scripts de terceiros.",
      v3: "Depois de Limpar, o segredo some da página. Ele não fica guardado para a próxima visita.",
      timeHeading: "Códigos e hora",
      t1: "Um código TOTP é função do segredo e do passo de tempo UTC. Mudar o fuso não muda o código.",
      t2: "O relógio do aparelho é o único disponível. De propósito, ele não é corrigido pela internet.",
      t3: "A janela de validade é esse mesmo intervalo UTC, escrito no fuso de referência. O padrão é America/Sao_Paulo.",
      fileHeading: "Abrir a página salva do disco",
      f1: "A leitura de imagem usa scripts comuns, então uma cópia salva aberta como file:// ainda lê PNG, JPEG e WebP no Chrome e no Firefox atuais.",
      f2: "A leitura de PDF carrega o PDF.js como módulo e um worker. Os navegadores em geral bloqueiam isso em file://. Use a página publicada, ou rode python3 -m http.server na pasta salva e abra o endereço localhost.",
      f3: "Códigos ao vivo e copiar para a área de transferência precisam de WebCrypto. Chrome e Firefox atuais tratam file:// como contexto seguro. Se um navegador não tratar, a leitura do segredo continua e os códigos não são calculados. localhost é um contexto seguro.",
      learnMore: "Saiba mais",
      mute: "Silenciar",
      muted: "Silenciado",
      copyLink: "Copiar link",
      statusLinkCopied: "Link copiado. O link contém o segredo.",
      remoteBlocked: "Esse arquivo não foi pedido. Só arquivos HTTPS em arquivos.n3wizards.com e minio.n3wizards.com são permitidos.",
      remoteCors: "Não foi possível buscar o arquivo. O bucket precisa liberar a origem desta página no CORS. Veja o README.",
      remoteRedirect: "Esse arquivo redireciona para outro lugar, então não foi baixado.",
      remoteFetch: "O servidor do arquivo retornou um erro.",
      footer: "Nailton Gomes · MIT · jsQR 1.4.0 · PDF.js 6.5.438. Os segredos ficam nesta aba.",
    },
  };

  let lang = "pt-BR";

  function detect() {
    const list = root.navigator.languages && root.navigator.languages.length
      ? root.navigator.languages
      : [root.navigator.language || ""];
    for (let i = 0; i < list.length; i += 1) {
      const value = String(list[i] || "").toLowerCase();
      if (value.startsWith("pt")) return "pt-BR";
      if (value.startsWith("en")) return "en";
    }
    return "pt-BR";
  }

  function t(key, vars) {
    const table = STRINGS[lang] || STRINGS["pt-BR"];
    let text = table[key] || STRINGS["pt-BR"][key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (name) {
        text = text.split("{" + name + "}").join(String(vars[name]));
      });
    }
    return text;
  }

  function apply(scope) {
    const rootNode = scope || root.document;
    root.document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
    root.document.title = t("title");
    rootNode.querySelectorAll("[data-i18n]").forEach(function (node) {
      node.textContent = t(node.getAttribute("data-i18n"));
    });
    rootNode.querySelectorAll("[data-i18n-aria]").forEach(function (node) {
      node.setAttribute("aria-label", t(node.getAttribute("data-i18n-aria")));
    });
    const pt = root.document.getElementById("lang-pt");
    const en = root.document.getElementById("lang-en");
    if (pt) pt.setAttribute("aria-pressed", lang === "pt-BR" ? "true" : "false");
    if (en) en.setAttribute("aria-pressed", lang === "en" ? "true" : "false");
  }

  root.OtpI18n = {
    detect: detect,
    t: t,
    apply: apply,
    use: function (next) {
      lang = next === "en" ? "en" : "pt-BR";
      return lang;
    },
    get: function () {
      return lang;
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
