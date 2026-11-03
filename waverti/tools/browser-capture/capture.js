/** Executed in the active tab by Chrome. Keep this function self-contained. */
export function captureAmazonProduct() {
  const asin = location.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([a-z0-9]{10})(?:\/|$)/i)?.[1];
  if (location.protocol !== "https:" || !["amazon.fr", "www.amazon.fr"].includes(location.host) || !asin) {
    return { ok: false, code: "not_product" };
  }

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
  if (price === null && availability === "unknown") return { ok: false, code: "unavailable" };
  return {
    ok: true,
    observation: {
      version: 1,
      url: "https://www.amazon.fr/dp/" + asin.toUpperCase(),
      price,
      currency: price === null ? null : "EUR",
      availability,
      observedAt: new Date().toISOString(),
    },
  };
}
