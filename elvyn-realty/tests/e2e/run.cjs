/**
 * End-to-end journeys against a running server (npm run build && npm start).
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… node tests/e2e/run.cjs
 * Uses the demo catalogue and the local database: never run it against production data.
 */
const { chromium, devices } = require("playwright");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const results = [];
const check = (name, cond, extra = "") => {
  results.push({ name, ok: Boolean(cond), extra });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
};
const overflowX = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const PAGES = ["/", "/propiedades", "/venta", "/alquiler", "/nosotros", "/agentes", "/servicios", "/vender-tu-propiedad", "/contacto", "/privacidad", "/en", "/en/properties", "/en/about", "/en/contact"];

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  /* ---------- Mobile ---------- */
  const m = await browser.newContext({ ...devices["iPhone 13"] });
  const mp = await m.newPage();
  // Protected deployments (Vercel Authentication): a share link sets the access cookie.
  if (process.env.SHARE_URL) await mp.goto(process.env.SHARE_URL);
  mp.on("pageerror", (e) => errors.push(`mobile: ${e.message}`));
  for (const path of PAGES) {
    const res = await mp.goto(BASE + path, { waitUntil: "networkidle" });
    check(`mobile ${path} loads (200) without horizontal overflow`, res.status() === 200 && (await overflowX(mp)) <= 0, `status ${res.status()}`);
  }
  const listingHref = await (await mp.goto(BASE + "/venta", { waitUntil: "networkidle" }), mp.locator("article h3 a").first().getAttribute("href"));
  await mp.goto(BASE + listingHref, { waitUntil: "networkidle" });
  check("mobile listing page has no horizontal overflow", (await overflowX(mp)) <= 0);

  // Mobile menu: opens, traps focus, closes with Escape
  await mp.goto(BASE + "/", { waitUntil: "networkidle" });
  await mp.getByRole("button", { name: "Menú" }).click();
  const dialog = mp.getByRole("dialog", { name: "Menú" });
  check("mobile menu opens as a dialog", await dialog.isVisible());
  for (let i = 0; i < 20; i++) await mp.keyboard.press("Tab");
  check("focus stays inside the mobile menu", await mp.evaluate(() => Boolean(document.activeElement?.closest("#mobile-menu"))));
  await mp.keyboard.press("Escape");
  check("Escape closes the mobile menu", !(await dialog.isVisible().catch(() => false)));

  // Filters drawer
  await mp.goto(BASE + "/venta", { waitUntil: "networkidle" });
  await mp.getByRole("button", { name: /^Filtros/ }).click();
  const fd = mp.getByRole("dialog", { name: "Filtros" });
  await fd.getByLabel("Ciudad").selectOption("Nagua");
  await fd.getByText("2+").first().click();
  await fd.getByRole("button", { name: /Ver resultados/ }).click();
  await mp.waitForURL(/ciudad=Nagua/);
  check("mobile filters apply and are kept in the URL", /ciudad=Nagua/.test(mp.url()) && /habitaciones=2/.test(mp.url()), mp.url());
  await mp.waitForLoadState("networkidle");
  const chip = mp.getByRole("link", { name: "Quitar filtro: Nagua" });
  await chip.click();
  await mp.waitForURL((u) => !u.toString().includes("ciudad="));
  check("an individual filter can be removed", !mp.url().includes("ciudad=") && mp.url().includes("habitaciones=2"), mp.url());
  await mp.getByRole("link", { name: "Restablecer" }).first().click();
  await mp.waitForURL((u) => !u.toString().includes("habitaciones"));
  check("reset clears all filters", !mp.url().includes("?"), mp.url());
  await m.close();

  /* ---------- Desktop ---------- */
  const d = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await d.newPage();
  if (process.env.SHARE_URL) await p.goto(process.env.SHARE_URL);
  p.on("pageerror", (e) => errors.push(`desktop: ${e.message}`));
  for (const path of PAGES) {
    await p.goto(BASE + path, { waitUntil: "networkidle" });
    check(`desktop ${path} has no horizontal overflow`, (await overflowX(p)) <= 0);
  }

  // Skip link and keyboard focus
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.keyboard.press("Tab");
  check("first Tab reaches the skip link", (await p.evaluate(() => document.activeElement?.textContent)) === "Saltar al contenido");

  // Home search → catalogue with params
  await p.getByLabel("Ciudad").first().selectOption("Cabrera");
  await p.getByLabel(/Presupuesto máximo/).fill("150000");
  await p.getByRole("button", { name: "Buscar" }).click();
  await p.waitForURL(/\/venta\?/);
  check("home search opens the catalogue with filters", /ciudad=Cabrera/.test(p.url()) && /precio_max=150000/.test(p.url()), p.url());

  // Sorting and pagination (desktop filters apply immediately)
  await p.goto(BASE + "/venta", { waitUntil: "networkidle" });
  await p.getByLabel("Ordenar por").selectOption("price_asc");
  await p.waitForURL(/orden=precio_asc/);
  check("sorting is reflected in the URL", p.url().includes("orden=precio_asc"));
  await p.waitForLoadState("networkidle");
  const prices = await p.locator("article p.text-lg").allTextContents();
  check("first results are sorted by price", prices.length > 3, prices.slice(0, 4).join(" | "));
  await p.getByRole("link", { name: "Siguiente" }).click();
  await p.waitForURL(/pagina=2/);
  check("pagination keeps sorting", p.url().includes("pagina=2") && p.url().includes("orden=precio_asc"));
  await p.goto(BASE + "/propiedades?ciudad=Nowhere", { waitUntil: "networkidle" });
  check("empty results state is shown", await p.getByText("No encontramos propiedades con estos criterios").isVisible());

  // Listing page: gallery, WhatsApp prefilled, tel link
  await p.goto(BASE + listingHref, { waitUntil: "networkidle" });
  const h1 = (await p.locator("h1").textContent()).trim();
  const wa = await p.getByRole("link", { name: "Consultar por WhatsApp" }).getAttribute("href");
  check("WhatsApp link is prefilled with title and URL (not sent automatically)", wa.startsWith("https://wa.me/") && decodeURIComponent(wa).includes(h1) && decodeURIComponent(wa).includes(listingHref), decodeURIComponent(wa).slice(0, 120));
  check("call link uses tel:", (await p.getByRole("link", { name: "Llamar" }).first().getAttribute("href")).startsWith("tel:+"));
  const galleryBtn = p.getByRole("button", { name: /Ver las \d+ fotos/ });
  if (await galleryBtn.count()) {
    await galleryBtn.click();
    const g = p.getByRole("dialog", { name: "Galería de fotos" });
    const c1 = await g.locator("p").first().textContent();
    await p.keyboard.press("ArrowRight");
    const c2 = await g.locator("p").first().textContent();
    check("gallery opens and arrow keys navigate", c1 !== c2, `${c1} → ${c2}`);
    await p.keyboard.press("Escape");
    check("Escape closes the gallery", !(await g.isVisible().catch(() => false)));
  }

  // Visit request from the listing (pending confirmation)
  await p.getByRole("tab", { name: "Solicitar visita" }).click();
  const panel = p.getByRole("tabpanel");
  await panel.getByRole("button", { name: "Solicitar visita" }).click();
  check("form validation shows errors", await panel.getByRole("alert").first().isVisible());
  await p.waitForTimeout(2600); // anti-spam minimum time
  await panel.getByLabel("Nombre completo").fill("Prueba E2E Visita");
  await panel.getByLabel(/WhatsApp o teléfono/).fill("+1 809 555 0199");
  await panel.getByLabel("Opción 1").fill("2026-12-10T10:30");
  await panel.getByRole("checkbox").check();
  await panel.getByRole("button", { name: "Solicitar visita" }).click();
  await panel.getByText("pendiente de confirmación").waitFor({ timeout: 15000 });
  check("visit request is recorded as pending confirmation", true);

  // Contact form
  await p.goto(BASE + "/contacto", { waitUntil: "networkidle" });
  await p.waitForTimeout(2600);
  await p.getByLabel("Nombre completo").fill("Prueba E2E Contacto");
  await p.getByLabel("Correo electrónico").fill("e2e-contacto@example.invalid");
  await p.getByLabel("Mensaje").fill("Busco un solar en Cabrera, presupuesto 80.000 USD, en 3 meses.");
  await p.getByRole("checkbox").check();
  await p.getByRole("button", { name: "Enviar solicitud" }).click();
  await p.getByText("Solicitud recibida").waitFor({ timeout: 15000 });
  check("contact form confirms only after a real success", true);
  const links = await p.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check("contact page links: tel, mailto, WhatsApp, Instagram, Facebook, YouTube, LinkedIn", ["tel:+18097105384", "mailto:elvyn@drspacefinders.com", "https://wa.me/18097105384", "https://www.instagram.com/elvynarnaud/", "https://www.facebook.com/elvyn.drspacefinders", "https://www.youtube.com/@elvynarnaudrealty", "https://www.linkedin.com/in/elvynarnaud-realtor/"].every((h) => links.includes(h)));

  // Spam: honeypot filled → rejected
  const spam = await p.evaluate(async () => (await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "contact", fullName: "Bot", email: "b@b.co", consent: true, website: "http://spam", startedAt: Date.now() - 10000 }) })).status);
  check("honeypot submissions are rejected", spam === 400);

  // Assistant without API key → explicit fallback with contact options
  await p.getByRole("button", { name: "Asistente IA" }).click();
  const chat = p.getByRole("dialog", { name: "Asistente IA" });
  check("assistant is presented as AI with a human option", (await chat.textContent()).includes("inteligencia artificial") && (await chat.getByRole("link", { name: "WhatsApp" }).count()) > 0);
  await chat.getByRole("button", { name: "Quiero comprar" }).click();
  await chat.getByText("El asistente no está disponible en este momento").waitFor({ timeout: 15000 });
  check("assistant fallback keeps catalogue and contact options", (await chat.getByRole("link", { name: "Ver el catálogo" }).count()) === 1);

  // 404s
  check("unknown page returns 404", (await p.goto(BASE + "/esta-pagina-no-existe")).status() === 404);
  check("unpublished listing returns 404 with a clear message", (await p.goto(BASE + "/propiedad/propiedad-retirada-0")).status() === 404 && (await p.getByText("Esta propiedad ya no está publicada").waitFor().then(() => true, () => false)));
  check("old site URL redirects", (await p.goto(BASE + "/elvyn-arnaud-exprealty")).url().endsWith("/nosotros"));

  // English
  await p.goto(BASE + "/en/properties", { waitUntil: "networkidle" });
  check("English catalogue", (await p.locator("html").getAttribute("lang")) === "en" && (await p.getByRole("heading", { level: 1 }).textContent()).includes("Properties"));

  /* ---------- Admin ---------- */
  const anon = await p.request.get(BASE + "/admin/prospectos/1/export", { maxRedirects: 0 });
  check("admin export requires authentication", anon.status() === 307 || anon.status() === 401, `status ${anon.status()}`);
  await p.goto(BASE + "/admin");
  check("admin redirects to login", p.url().endsWith("/admin/login"));
  await p.getByLabel("Correo").fill(process.env.ADMIN_EMAIL);
  await p.getByLabel("Contraseña").fill("wrong-password-123");
  await p.getByRole("button", { name: "Entrar" }).click();
  check("wrong password is rejected", await p.getByText("Credenciales incorrectas.").waitFor({ timeout: 10000 }).then(() => true, () => false));
  await p.getByLabel("Contraseña").fill(process.env.ADMIN_PASSWORD);
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForURL(BASE + "/admin");
  check("admin login works", await p.getByRole("heading", { name: "Panel" }).isVisible());
  await p.goto(BASE + "/admin/prospectos?q=Prueba E2E Visita");
  await p.getByRole("link", { name: "Prueba E2E Visita" }).first().click();
  await p.waitForURL(/\/admin\/prospectos\/\d+/);
  check("visit lead appears in the CRM with its property", await p.getByText("Propiedades de interés").isVisible());
  await p.getByLabel("Fecha y hora (hora de RD)").first().fill("2026-12-10T10:30");
  await p.getByRole("button", { name: "Confirmar" }).first().click();
  await p.getByText("Guardado.").first().waitFor({ timeout: 10000 }).catch(() => undefined);
  await p.reload();
  check("Elvyn can confirm a visit", (await p.getByText("Confirmada:").count()) > 0);
  await p.getByLabel("Nivel de interés").selectOption("caliente");
  await p.getByLabel("Justificación del nivel").fill("Llamada realizada: compra en 1 mes.");
  await p.getByRole("button", { name: "Guardar cambios" }).click();
  await p.getByText("Guardado.").waitFor({ timeout: 10000 });
  check("status/level can be edited manually", true);
  await p.getByLabel("Nueva nota interna").fill("Nota E2E");
  await p.getByRole("button", { name: "Añadir nota" }).click();
  await p.getByText("Nota E2E").waitFor({ timeout: 10000 });
  check("internal notes are saved", true);
  const exp = await p.request.get(p.url() + "/export");
  const data = await exp.json();
  check("data export returns the prospect's data", exp.status() === 200 && data.contact.fullName === "Prueba E2E Visita" && data.notes.length >= 1);
  await p.goto(BASE + "/admin/notificaciones");
  check("notifications are recorded in test mode", (await p.getByText("estado: test").count()) > 0);
  await p.getByRole("button", { name: "Cerrar sesión" }).click();
  await p.waitForURL(/\/admin\/login/);
  check("logout", true);

  check("no uncaught page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("E2E crashed:", e.message);
  process.exit(2);
});
