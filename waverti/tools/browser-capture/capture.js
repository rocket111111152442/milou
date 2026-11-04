/** Executed in the active tab by Chrome. Keep this function self-contained. */
export function capturePage(href, urlOnly = false, expectedUrl) {
  let url;
  try {
    url = new URL(href ?? location.href);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.href.length > 2048) {
    return null;
  }

  const observation = {
    version: 2,
    url: url.href,
    price: null,
    currency: null,
    availability: "unknown",
    observedAt: new Date().toISOString(),
  };
  if (urlOnly) return observation;

  function comparableUrl(value) {
    const comparable = new URL(value, url);
    const tracking = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|_ga|igshid|yclid)$/i;
    for (const key of [...comparable.searchParams.keys()]) if (tracking.test(key)) comparable.searchParams.delete(key);
    return comparable.href;
  }

  const background = typeof expectedUrl === "string";
  const httpStatus = background ? performance.getEntriesByType("navigation")[0]?.responseStatus : undefined;
  if (background) {
    if (comparableUrl(url.href) !== expectedUrl) return { error: "page_changed" };
    const blocked = [401, 403, 429, 451].includes(httpStatus) ||
      /(?:captcha|robot check|access denied|verify you are human|connexion|sign in)/i.test(document.title) ||
      Boolean(document.querySelector('form[action*="validateCaptcha"], form[action*="captcha"], #challenge-form, #captchacharacters'));
    if (blocked) return { error: "access_restricted" };
    if (httpStatus !== 200) return { error: "navigation_unverified" };
  }

  function result(reading, source) {
    return background ? { reading, source, httpStatus, loadedUrl: url.href } : reading;
  }

  if (!["amazon.fr", "www.amazon.fr"].includes(url.host)) {
    return result({ ...observation, ...structuredOffer() }, "jsonld");
  }

  const asin = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([a-z0-9]{10})(?:\/|$)/i)?.[1];
  if (!asin) return result(observation, "selector");
  const canonical = new URL("https://www.amazon.fr/dp/" + asin.toUpperCase());
  for (const [key, value] of url.searchParams) {
    if (!/^(?:utm_.*|tag|ref|ref_|linkCode|qid|sr)$/i.test(key)) canonical.searchParams.append(key, value);
  }
  canonical.hash = url.hash;

  function isVisible(element) {
    if (!element || element.closest("[hidden], .aok-hidden")) return false;
    if (![...element.getClientRects()].some((rect) => rect.width > 1 && rect.height > 1)) return false;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0 ||
          style.contentVisibility === "hidden") return false;
    }
    return true;
  }

  function visibleText(box, selector) {
    return Array.from(box.querySelectorAll(selector)).find(isVisible)?.innerText.trim() ?? "";
  }

  function eurAmount(text) {
    const match = text.trim().match(/^(\d+(?:[\s\u00a0\u202f]\d{3})*)(?:[,.](\d{2}))?\s*(?:€|EUR)$/i);
    if (!match) return null;
    const cents = Number(match[1].replace(/\s/g, "")) * 100 + Number(match[2] ?? 0);
    return Number.isSafeInteger(cents) && cents > 0 && cents <= 10_000_000_000 ? cents : null;
  }

  function structuredOffer() {
    const products = new Set();
    const currencies = new Set(Intl.supportedValuesOf("currency"));
    const schemaType = (value, type) => [value].flat().some((entry) =>
      typeof entry === "string" && [type, "https://schema.org/" + type, "http://schema.org/" + type].includes(entry));
    const asList = (value) => Array.isArray(value) ? value : [value];

    function collect(value, depth = 0) {
      if (!value || depth > 4 || products.size > 1) return;
      for (const item of asList(value).slice(0, 64)) {
        if (!item || typeof item !== "object") continue;
        if (schemaType(item["@type"], "Product")) products.add(item);
        collect(item["@graph"], depth + 1);
        collect(item.mainEntity, depth + 1);
      }
    }

    let remaining = 500_000;
    for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json" i]')).slice(0, 20)) {
      const raw = script.textContent;
      if (raw.length > remaining) break;
      remaining -= raw.length;
      try {
        collect(JSON.parse(raw));
      } catch {
        // Broken publisher markup is not a reliable source.
      }
    }
    if (products.size !== 1) return {};

    const product = products.values().next().value;
    const offers = asList(product.offers);
    if (!offers.length || offers.length > 12 || offers.some((offer) => !schemaType(offer?.["@type"], "Offer"))) return {};
    if (background) {
      const matches = (value) => typeof value === "string" && value.trim() !== "" && comparableUrl(value) === expectedUrl;
      try {
        if (product.url !== undefined && !matches(product.url)) return {};
        if (offers.some((offer) => offer.url !== undefined && !matches(offer.url))) return {};
        if (!product.url && new URL(expectedUrl).search && !offers.every((offer) => matches(offer.url))) return {};
      } catch {
        return {};
      }
    } else if (typeof product.url === "string") {
      try {
        const productUrl = new URL(product.url, url);
        if (productUrl.origin !== url.origin || productUrl.pathname !== url.pathname ||
            (productUrl.search && productUrl.search !== url.search)) return {};
      } catch {
        return {};
      }
    }
    const amounts = new Set(offers.map((offer) => {
      const raw = String(offer.price ?? "");
      const price = /^\d+(?:\.\d{1,3})?$/.test(raw) ? Number(raw) : 0;
      const currency = String(offer.priceCurrency ?? "").toUpperCase();
      return price > 0 && price <= 100_000_000 && currencies.has(currency) ? JSON.stringify([price, currency]) : null;
    }));
    const [price, currency] = amounts.size === 1 && !amounts.has(null)
      ? JSON.parse(amounts.values().next().value)
      : [null, null];
    const available = new Set(offers.map((offer) => {
      const status = typeof offer.availability === "string"
        ? offer.availability.replace(/^https?:\/\/schema\.org\//, "")
        : "";
      if (["InStock", "LimitedAvailability"].includes(status)) return "in_stock";
      if (["OutOfStock", "SoldOut", "Discontinued"].includes(status)) return "out_of_stock";
      if (["PreOrder", "PreSale"].includes(status)) return "preorder";
      return "unknown";
    }));
    return { price, currency, availability: available.size === 1 ? available.values().next().value : "unknown" };
  }

  const prices = new Set();
  const priceContainers = [
    "#corePrice_feature_div .a-price",
    "#corePriceDisplay_desktop_feature_div .a-price",
    "#corePriceDisplay_mobile_feature_div .a-price",
  ];
  for (const box of document.querySelectorAll(priceContainers.join(", "))) {
    if (!box.matches(".priceToPay, .apex-pricetopay-value") ||
        box.closest(".a-text-price, [data-a-strike='true'], del, s, strike") || !isVisible(box)) continue;

    const whole = visibleText(box, ".a-price-whole").replace(/[.,]$/, "");
    const fraction = visibleText(box, ".a-price-fraction");
    const symbol = visibleText(box, ".a-price-symbol");
    const amount = whole && symbol && (fraction || !box.querySelector(".a-price-fraction"))
      ? eurAmount(whole + (fraction ? "," + fraction : "") + symbol)
      : eurAmount(visibleText(box, ".a-offscreen"));
    if (amount !== null) prices.add(amount);
  }

  const stock = new Set();
  for (const box of document.querySelectorAll("#availability, #outOfStock")) {
    if (!isVisible(box)) continue;
    const textNodes = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    let visible = "";
    for (let node = textNodes.nextNode(); node && visible.length < 500; node = textNodes.nextNode()) {
      if (node.textContent.trim() && isVisible(node.parentElement)) visible += " " + node.textContent;
    }
    const text = visible.slice(0, 500).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ");
    const unavailable = /\b(?:indisponible|rupture de stock|pas en stock|non disponible|out of stock|unavailable)\b/g;
    if (unavailable.test(text)) {
      stock.add("out_of_stock");
    }
    if (/\b(?:precommande|pre-commande|pre-order|preorder)\b/.test(text)) {
      stock.add("preorder");
    }
    const current = text.replace(unavailable, "").replace(/\b(?:de nouveau en stock|back in stock)\b/g, "");
    if (/\b(?:en stock|in stock)\b/.test(current)) {
      stock.add("in_stock");
    }
  }

  const price = prices.size === 1 ? prices.values().next().value / 100 : null;
  const availability = stock.size === 1 ? stock.values().next().value : "unknown";
  return result({
    ...observation,
    url: canonical.href.length <= 2048 ? canonical.href : url.href,
    price,
    currency: price === null ? null : "EUR",
    availability,
  }, "selector");
}
