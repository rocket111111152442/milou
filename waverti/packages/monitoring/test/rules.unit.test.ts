/**
 * Moteur de règles : pages et documents de test CONTRÔLÉS (HTML et PDF construits ici), aucun service externe.
 * Chaque scénario enchaîne plusieurs contrôles pour vérifier les transitions, la déduplication et la confirmation.
 */
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parseRuleRequest, ruleConditionSchema, type PageObservation, type RuleConditionInput } from "@waverti/types";
import { extractPage } from "../src/extract/html";
import { extractPdfObservation, extractPdfText } from "../src/extract/pdf";
import { emptyMemory, evaluateRule, type RuleMemory } from "../src/compare/rules";
import { evaluatePage } from "../src/compare/evaluate";

const URL_ = "https://boutique.example/produit";
const day = 86_400_000;
const T0 = new Date("2026-11-01T10:00:00Z");

function page(body: string, opts: { head?: string; status?: number; selector?: string | null; responseMs?: number } = {}): PageObservation {
  return extractPage({
    html: `<!doctype html><html><head><title>Produit test</title>${opts.head ?? ""}</head><body>${body}</body></html>`,
    url: URL_,
    finalUrl: URL_,
    httpStatus: opts.status ?? 200,
    cssSelector: opts.selector ?? null,
    method: "http",
    responseMs: opts.responseMs,
  });
}

const product = (price: string, stock = "En stock", extra = "") =>
  page(`<main><h1>Casque audio</h1><p class="price">${price}</p><p>${stock}</p>${extra}<p>Description détaillée du produit, garantie deux ans.</p></main>`);

/** Rejoue une suite de contrôles et renvoie les évaluations. */
function run(rule: RuleConditionInput, steps: Array<PageObservation | { failure: string } | { status: number }>) {
  const r = ruleConditionSchema.parse(rule);
  let mem: RuleMemory = emptyMemory();
  let prev: PageObservation | null = null;
  return steps.map((s, i) => {
    const now = new Date(T0.getTime() + i * 3_600_000);
    const curr = "failure" in s ? null : "status" in s && !("kind" in s) ? page("<p>Erreur</p>", { status: s.status }) : (s as PageObservation);
    const out = evaluateRule({ rule: r, prev, curr, failure: "failure" in s ? { code: s.failure, message: "Délai dépassé." } : null, memory: mem, taskName: "Test", now });
    mem = out.memory;
    if (curr && curr.httpStatus < 400 && out.evaluation.outcome !== "error") prev = curr;
    return out.evaluation;
  });
}
const triggers = (evs: Array<{ triggered: boolean }>) => evs.map((e) => (e.triggered ? 1 : 0));
const rule = (conditions: RuleConditionInput["conditions"], extra: Partial<RuleConditionInput> = {}): RuleConditionInput => ({ type: "rule", conditions, ...extra });

describe("prix", () => {
  it("1. baisse de prix (par rapport au contrôle précédent)", () => {
    const ev = run(rule([{ type: "price_drop" }]), [product("249,00 €"), product("249,00 €"), product("229,00 €"), product("229,00 €")]);
    expect(triggers(ev)).toEqual([0, 0, 1, 0]);
    expect(ev[2]!.alert!.body).toMatch(/249,00.*229,00/);
  });

  it("2. hausse de prix d'au moins 5 €", () => {
    const ev = run(rule([{ type: "price_rise", minAmount: 5 }]), [product("100 €"), product("103 €"), product("110 €")]);
    expect(triggers(ev)).toEqual([0, 0, 1]);
  });

  it("3. passage sous un seuil : une seule alerte tant que le prix reste sous le seuil", () => {
    const ev = run(rule([{ type: "price_below", value: 200 }]), [product("249 €"), product("199 €"), product("189 €"), product("249 €"), product("195 €")]);
    expect(triggers(ev)).toEqual([0, 1, 0, 0, 1]);
  });

  it("4. réduction d'au moins 15 % par rapport au prix de départ", () => {
    const ev = run(rule([{ type: "price_drop", minPercent: 15, reference: "reference" }]), [product("200 €"), product("180 €"), product("169 €"), product("160 €")]);
    expect(triggers(ev)).toEqual([0, 0, 1, 0]);
    expect(ev[2]!.summary).toMatch(/15,5 %/);
  });

  it("prix atteignant une valeur cible (inférieur ou égal)", () => {
    expect(triggers(run(rule([{ type: "price_below", value: 100, orEqual: true }]), [product("120 €"), product("100 €")]))).toEqual([0, 1]);
  });

  it("promotion : seulement si le site affiche un prix barré, jamais déduite d'une simple baisse", () => {
    const promo = run(rule([{ type: "promotion" }]), [product("99 €"), product("79 €", "En stock", "<del>99 €</del>")]);
    expect(triggers(promo)).toEqual([0, 1]);
    const drop = run(rule([{ type: "promotion" }]), [product("99 €"), product("79 €")]);
    expect(triggers(drop)).toEqual([0, 0]);
  });

  it("devise différente : aucune comparaison hasardeuse", () => {
    const usd = page('<p>Prix</p><span itemprop="price" content="150"></span><meta itemprop="priceCurrency" content="USD">');
    const ev = run(rule([{ type: "price_below", value: 200 }]), [usd]);
    expect(ev[0]!.outcome).toBe("error");
    expect(ev[0]!.errorCode).toBe("currency_mismatch");
  });
});

describe("produits", () => {
  it("5. retour en stock et 6. rupture de stock", () => {
    const back = run(rule([{ type: "stock_is", state: "in_stock" }]), [product("50 €", "Rupture de stock"), product("50 €", "Rupture de stock"), product("50 €", "En stock")]);
    expect(triggers(back)).toEqual([0, 0, 1]);
    const out = run(rule([{ type: "stock_is", state: "out_of_stock" }]), [product("50 €"), product("50 €", "Épuisé")]);
    expect(triggers(out)).toEqual([0, 1]);
  });

  const catalog = (names: string[], extra = "") =>
    page(
      `<main><h1>Casques</h1><ul class="grid">${names
        .map((n) => `<li class="product-card"><a href="/p/${n.toLowerCase().replace(/\s+/g, "-")}"><h3>${n}</h3></a><span>${(n.length * 10).toFixed(2).replace(".", ",")} €</span></li>`)
        .join("")}</ul>${extra}</main><aside class="recommendations"><ul><li class="product-card"><a href="/p/pub-${Math.random()}">Produit sponsorisé</a></li></ul></aside>`,
    );

  it("7. nouveau produit dans une catégorie, sans faux positif dû à une réorganisation ou un retour", () => {
    const ev = run(rule([{ type: "item_added" }]), [
      catalog(["Alpha", "Bravo", "Charlie"]),
      catalog(["Charlie", "Alpha", "Bravo"]), // simple réorganisation
      catalog(["Alpha", "Bravo", "Charlie", "Delta"]), // nouveauté
      catalog(["Alpha", "Bravo", "Charlie"]), // Delta retiré
      catalog(["Alpha", "Bravo", "Charlie", "Delta"]), // Delta revient : pas une nouveauté
    ]);
    expect(triggers(ev)).toEqual([0, 0, 1, 0, 0]);
    expect(ev[2]!.alert!.body).toContain("Delta");
  });

  it("nouveau produit contenant un mot, avec exclusion", () => {
    const ev = run(rule([{ type: "item_added", contains: "pro" }], { exclude: ["reconditionné"] }), [
      catalog(["Alpha", "Bravo", "Charlie"]),
      catalog(["Alpha", "Bravo", "Charlie", "Delta Pro reconditionné"]),
      catalog(["Alpha", "Bravo", "Charlie", "Delta Pro reconditionné", "Echo"]),
      catalog(["Alpha", "Bravo", "Charlie", "Delta Pro reconditionné", "Echo", "Fox Pro"]),
    ]);
    expect(triggers(ev)).toEqual([0, 0, 0, 1]);
  });
});

describe("pages web", () => {
  const article = (sectionText: string, links = '<a href="/a">A</a>', extra = "") =>
    page(`<main><h1>Actualités</h1><section id="infos"><h2>Informations</h2><p>${sectionText}</p>${links}</section>${extra}</main><footer>Mis à jour à 10:42 — ${Math.random()}</footer>`, { selector: null });

  it("8. modification d'une section précise (sélecteur), sans alerte pour un changement ailleurs", () => {
    const sec = (t: string, other: string) =>
      page(`<main><section id="infos"><p>${t}</p></section><section id="autre"><p>${other}</p></section></main>`, { selector: "#infos" });
    const ev = run(rule([{ type: "page_changed", sensitivity: "any" }]), [sec("Horaires : 9 h - 18 h", "x"), sec("Horaires : 9 h - 18 h", "y changé"), sec("Horaires : 10 h - 19 h", "y changé")]);
    expect(triggers(ev)).toEqual([0, 0, 1]);
  });

  it("les éléments volatils (horloge, pied de page, publicité) ne déclenchent pas de modification significative", () => {
    const ev = run(rule([{ type: "page_changed" }]), [article("Texte stable de la page d'information, assez long pour être représentatif."), article("Texte stable de la page d'information, assez long pour être représentatif.")]);
    expect(triggers(ev)).toEqual([0, 0]);
  });

  it("9. apparition d'une phrase et 10. disparition d'une phrase, sans alerte répétée", () => {
    const appear = run(rule([{ type: "text_match", terms: ["inscriptions ouvertes"] }]), [
      article("Les inscriptions ouvriront bientôt."),
      article("Les inscriptions ouvertes jusqu'au 30 novembre."),
      article("Les inscriptions ouvertes jusqu'au 30 novembre."),
    ]);
    expect(triggers(appear)).toEqual([0, 1, 0]);
    const gone = run(rule([{ type: "text_absent", terms: ["complet"] }]), [article("Session complet."), article("Session complet."), article("Places disponibles.")]);
    expect(triggers(gone)).toEqual([0, 0, 1]);
  });

  it("mots-clés : ET / OU, mots entiers, joker, casse", () => {
    const p = article("Nouvelle version 2.4 disponible au téléchargement pour Windows.");
    const ok = (r: RuleConditionInput) => run(r, [p])[0]!.triggered;
    expect(ok(rule([{ type: "text_match", terms: ["version", "windows"], mode: "all" }]))).toBe(true);
    expect(ok(rule([{ type: "text_match", terms: ["version", "linux"], mode: "all" }]))).toBe(false);
    expect(ok(rule([{ type: "text_match", terms: ["linux", "windows"], mode: "any" }]))).toBe(true);
    expect(ok(rule([{ type: "text_match", terms: ["vers"], wholeWord: true }]))).toBe(false);
    expect(ok(rule([{ type: "text_match", terms: ["version 2.*"] }]))).toBe(true);
    expect(ok(rule([{ type: "text_match", terms: ["windows"], caseSensitive: true }]))).toBe(false);
    expect(ok(rule([{ type: "text_match", terms: ["Windows"], caseSensitive: true }]))).toBe(true);
  });

  it("11. nouveau lien", () => {
    const ev = run(rule([{ type: "link_added" }]), [
      article("Texte", '<a href="/a">A</a>'),
      article("Texte", '<a href="/a">A</a><a href="/b?utm_source=x">Nouveau dossier</a>'),
      article("Texte", '<a href="/a">A</a><a href="/b">Nouveau dossier</a>'),
    ]);
    expect(triggers(ev)).toEqual([0, 1, 0]);
  });

  it("nouvelle rubrique, modification du titre, d'un tableau, d'une phrase", () => {
    const h = run(rule([{ type: "heading_added" }]), [article("x"), article("x", "", "<h2>Nouvelle rubrique Emploi</h2>")]);
    expect(triggers(h)).toEqual([0, 1]);
    const tbl = (v: string) => article("x", "", `<table><tr><td>Tarif</td><td>${v}</td></tr></table>`);
    expect(triggers(run(rule([{ type: "table_changed" }]), [tbl("10 €"), tbl("10 €"), tbl("12 €")]))).toEqual([0, 0, 1]);
    const s = run(rule([{ type: "sentence_changed", term: "date limite" }]), [article("La date limite est le 1er mars."), article("La date limite est le 15 mars.")]);
    expect(triggers(s)).toEqual([0, 1]);
  });
});

describe("événements et documents", () => {
  const events = (dates: string[]) => page(`<main><h1>Agenda</h1>${dates.map((d) => `<p>Concert le ${d}</p>`).join("")}</main>`);

  it("12. nouvelle date à venir (les dates passées sont ignorées)", () => {
    const ev = run(rule([{ type: "date_added" }]), [events(["12 décembre 2026"]), events(["12 décembre 2026", "3 janvier 2020"]), events(["12 décembre 2026", "3 janvier 2020", "14/02/2027"])]);
    expect(triggers(ev)).toEqual([0, 0, 1]);
    expect(ev[2]!.alert!.body).toContain("14 février 2027");
  });

  it("13. nouvelle offre d'emploi (liste)", () => {
    const jobs = (titles: string[]) =>
      page(`<main><h1>Carrières</h1>${titles.map((t, i) => `<article class="job-offer"><a href="/jobs/${i}-${t.length}"><h2>${t}</h2></a><p>CDI — Paris</p></article>`).join("")}</main>`);
    const ev = run(rule([{ type: "item_added", contains: "développeur" }]), [jobs(["Comptable", "Commercial", "Juriste"]), jobs(["Comptable", "Commercial", "Juriste", "Développeur TypeScript"])]);
    expect(triggers(ev)).toEqual([0, 1]);
  });

  const docs = (files: Array<[string, string]>) => page(`<main><h1>Publications</h1><ul>${files.map(([t, h]) => `<li><a href="${h}">${t}</a></li>`).join("")}</ul></main>`);

  it("nouveau PDF publié dont le titre contient « résultats » ; changement de lien de téléchargement", () => {
    const ev = run(rule([{ type: "document_added", contains: "résultats" }]), [
      docs([["Rapport annuel", "/r2025.pdf"]]),
      docs([["Rapport annuel", "/r2025.pdf"], ["Calendrier", "/cal.pdf"]]),
      docs([["Rapport annuel", "/r2025.pdf"], ["Calendrier", "/cal.pdf"], ["Résultats du concours", "/res.pdf"]]),
    ]);
    expect(triggers(ev)).toEqual([0, 0, 1]);
    const link = run(rule([{ type: "document_link_changed" }]), [docs([["Règlement", "/reglement-v1.pdf"]]), docs([["Règlement", "/reglement-v2.pdf"]])]);
    expect(triggers(link)).toEqual([0, 1]);
  });

  it("formulaire d'inscription présent (ouverture d'une réservation)", () => {
    const ev = run(rule([{ type: "form_present" }]), [page("<main><p>Billetterie bientôt ouverte</p></main>"), page('<main><form><input type="email"><button>Réserver</button></form></main>')]);
    expect(triggers(ev)).toEqual([0, 1]);
  });
});

/** PDF minimal valide construit ici (texte compressé FlateDecode). */
function makePdf(text: string): Buffer {
  const content = deflateSync(Buffer.from(`BT /F1 12 Tf 72 712 Td (${text}) Tj ET`, "latin1"));
  const head = Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${content.length} /Filter /FlateDecode >>\nstream\n`, "latin1");
  return Buffer.concat([head, content, Buffer.from("\nendstream\nendobj\ntrailer\n<<>>\n%%EOF", "latin1")]);
}

describe("15. documents PDF", () => {
  it("texte extrait quand c'est possible, empreinte des octets, nouvelle version détectée", () => {
    const v1 = makePdf("Resultats du concours 2026 : liste des admis publiee.");
    expect(extractPdfText(v1)).toContain("Resultats du concours 2026");
    const o1 = extractPdfObservation({ body: v1, url: "https://ex.test/res.pdf", finalUrl: "https://ex.test/res.pdf", httpStatus: 200 });
    const o2 = extractPdfObservation({ body: makePdf("Resultats du concours 2026 : liste complementaire ajoutee ce jour."), url: "https://ex.test/res.pdf", finalUrl: "https://ex.test/res.pdf", httpStatus: 200 });
    expect(o1.contentKind).toBe("pdf");
    const ev = run(rule([{ type: "page_changed", sensitivity: "any" }]), [o1, o1, o2]);
    expect(triggers(ev)).toEqual([0, 0, 1]);
    const kw = run(rule([{ type: "text_match", terms: ["liste complementaire"] }]), [o1, o2]);
    expect(triggers(kw)).toEqual([0, 1]);
  });

  it("PDF illisible (flux non textuel ou chiffré) : texte déclaré indisponible, rien d'inventé", () => {
    const enc = Buffer.from("%PDF-1.4\n<< /Encrypt 5 0 R >>\n%%EOF");
    expect(extractPdfText(enc)).toBeNull();
    const noise = Buffer.concat([Buffer.from("%PDF-1.4\n<< /Length 50 /Filter /FlateDecode >>\nstream\n"), deflateSync(Buffer.from([0, 1, 2, 3, 250, 251])), Buffer.from("\nendstream")]);
    expect(extractPdfText(noise)).toBeNull();
  });
});

describe("disponibilité", () => {
  const up = (ms = 200) => page("<main><p>Service en ligne</p></main>", { responseMs: ms });

  it("16. site inaccessible (confirmé sur 2 contrôles) et 17. de nouveau disponible", () => {
    const ev = run(rule([{ type: "site_down" }], { category: "uptime", options: { notifyRecovery: true } }), [up(), { failure: "timeout" }, { failure: "timeout" }, { failure: "timeout" }, up()]);
    expect(triggers(ev)).toEqual([0, 0, 1, 0, 1]);
    expect(ev[2]!.alert!.title).toBe("Site inaccessible");
    expect(ev[4]!.alert!.title).toBe("Site de nouveau accessible");
  });

  it("une erreur 503 isolée ne déclenche ni panne ni « changement de contenu »", () => {
    const ev = run(rule([{ type: "page_changed", sensitivity: "any" }]), [up(), { status: 503 }, up()]);
    expect(triggers(ev)).toEqual([0, 0, 0]);
    expect(ev[1]!.outcome).toBe("error");
    const down = run(rule([{ type: "site_down" }]), [up(), { status: 503 }, up()]);
    expect(triggers(down)).toEqual([0, 0, 0]);
  });

  it("temps de réponse anormal confirmé, redirection inattendue", () => {
    expect(triggers(run(rule([{ type: "slow_response", ms: 1000 }]), [up(200), up(3000), up(3200), up(3100)]))).toEqual([0, 0, 1, 0]);
    const redir = (to: string) => ({ ...up(), finalUrl: to });
    expect(triggers(run(rule([{ type: "redirect_changed" }]), [redir(URL_), redir("https://autre.example/")]))).toEqual([0, 1]);
  });

  it("les conditions de disponibilité ne peuvent pas être combinées avec ET à des conditions de contenu", () => {
    expect(ruleConditionSchema.safeParse({ type: "rule", match: "all", conditions: [{ type: "site_down" }, { type: "price_below", value: 10 }] }).success).toBe(false);
    expect(ruleConditionSchema.safeParse({ type: "rule", match: "any", conditions: [{ type: "site_down" }, { type: "page_changed" }] }).success).toBe(true);
  });
});

describe("règles personnalisées", () => {
  it("18. ET : prix < 150 € ET en stock", () => {
    const r = rule([{ type: "price_below", value: 150 }, { type: "stock_is", state: "in_stock" }], { match: "all" });
    const ev = run(r, [product("140 €", "Rupture de stock"), product("140 €", "En stock"), product("145 €", "En stock"), product("160 €", "En stock"), product("149 €", "En stock")]);
    expect(triggers(ev)).toEqual([0, 1, 0, 0, 1]);
  });

  it("19. OU : nouveau PDF OU mot « inscription »", () => {
    const r = rule([{ type: "document_added" }, { type: "text_match", terms: ["inscription"] }], { match: "any" });
    const p = (body: string) => page(`<main>${body}</main>`);
    const ev = run(r, [p("<p>Rien</p>"), p('<p>Rien</p><a href="/doc.pdf">Guide</a>'), p('<p>Ouverture des inscription</p><a href="/doc.pdf">Guide</a>')]);
    expect(triggers(ev)).toEqual([0, 1, 1]);
  });

  it("groupes et exemple « page change ET le mot inscription apparaît »", () => {
    const r = rule([{ type: "page_changed", sensitivity: "any" }], { groups: [{ match: "any", conditions: [{ type: "text_match", terms: ["inscription"] }, { type: "text_match", terms: ["billetterie"] }] }] });
    const ev = run(r, [page("<main><p>Bientôt</p></main>"), page("<main><p>Bientôt, toujours</p></main>"), page("<main><p>La billetterie est ouverte</p></main>")]);
    expect(triggers(ev)).toEqual([0, 0, 1]);
  });

  it("confirmation : un changement fugace n'alerte pas, un changement durable alerte au contrôle suivant", () => {
    const r = rule([{ type: "page_changed", sensitivity: "any" }], { options: { confirm: true } });
    const a = page("<main><p>Version A du contenu</p></main>");
    const b = page("<main><p>Version B du contenu</p></main>");
    const flicker = run(r, [a, b, a]);
    expect(triggers(flicker)).toEqual([0, 0, 0]);
    expect(flicker[2]!.summary).toMatch(/non confirmé/);
    expect(triggers(run(r, [a, b, b]))).toEqual([0, 0, 1]);
    const items = rule([{ type: "item_added" }], { options: { confirm: true } });
    const cat = (n: number) => page(`<ul>${Array.from({ length: n }, (_, i) => `<li class="card"><a href="/x/${i}">Article ${i}</a></li>`).join("")}</ul>`);
    expect(triggers(run(items, [cat(3), cat(4), cat(4)]))).toEqual([0, 0, 1]);
  });

  it("20. délai minimal entre deux alertes", () => {
    const r = rule([{ type: "page_changed", sensitivity: "any" }], { options: { cooldownMinutes: 180 } });
    const v = (n: number) => page(`<main><p>Version ${n}</p></main>`);
    const ev = run(r, [v(1), v(2), v(3), v(4), v(5)]); // contrôles toutes les heures
    expect(triggers(ev)).toEqual([0, 1, 0, 0, 1]);
    expect(ev[2]!.summary).toMatch(/délai minimal/);
  });

  it("donnée absente : erreur explicite, pas d'alerte inventée", () => {
    const ev = run(rule([{ type: "price_below", value: 100 }]), [page("<main><p>Aucun prix ici</p></main>")]);
    expect(ev[0]).toMatchObject({ outcome: "error", errorCode: "price_not_found", triggered: false });
  });

  it("aucune exécution de code : un terme contenant une syntaxe d'expression régulière est traité littéralement", () => {
    const ev = run(rule([{ type: "text_match", terms: ["(a+)+$"] }]), [page("<p>aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!</p>")]);
    expect(ev[0]!.triggered).toBe(false);
  });
});

describe("25. compatibilité des anciennes surveillances", () => {
  it("l'empreinte historique et l'évaluation historique sont inchangées par l'enrichissement", () => {
    const html = "<html><head><title>T</title></head><body><nav>Menu</nav><p>Prix : 49,99 €</p><p>En stock</p></body></html>";
    const legacy = extractPage({ html, url: URL_, finalUrl: URL_, httpStatus: 200, method: "http", enrich: false });
    const rich = extractPage({ html, url: URL_, finalUrl: URL_, httpStatus: 200, method: "http" });
    expect(rich.textHash).toBe(legacy.textHash);
    expect(rich.excerpt).toBe(legacy.excerpt);
    expect(rich.price).toBe(legacy.price);
    expect(evaluatePage({ type: "price_below", threshold: 60, currency: "EUR" }, null, rich, "T").triggered).toBe(true);
  });

  it("une observation sans données enrichies (ancienne application desktop) ne provoque pas de fausse nouveauté", () => {
    const old = extractPage({ html: "<ul><li class='c'><a href='/1'>Un</a></li><li class='c'><a href='/2'>Deux</a></li><li class='c'><a href='/3'>Trois</a></li></ul>", url: URL_, finalUrl: URL_, httpStatus: 200, method: "http", enrich: false });
    const ev = run(rule([{ type: "item_added" }]), [old, page("<ul><li class='c'><a href='/1'>Un</a></li><li class='c'><a href='/2'>Deux</a></li><li class='c'><a href='/3'>Trois</a></li><li class='c'><a href='/4'>Quatre</a></li></ul>")]);
    expect(ev[0]!.outcome).toBe("error");
    expect(triggers(ev)).toEqual([0, 0]);
  });
});

describe("assistant en langage naturel (déterministe)", () => {
  it("« passe sous 100 € et revient en stock » → prix < 100 ET en stock", () => {
    const r = parseRuleRequest("Préviens-moi quand ce produit passe sous 100 € et revient en stock.");
    expect(r.rule).toMatchObject({ match: "all", conditions: [{ type: "price_below", value: 100 }, { type: "stock_is", state: "in_stock" }] });
  });
  it("baisse de 15 %, nouveau PDF contenant un mot, panne, mots entre guillemets", () => {
    expect(parseRuleRequest("une baisse d'au moins 15 % du prix").recognized[0]).toMatchObject({ type: "price_drop", minPercent: 15 });
    expect(parseRuleRequest("un nouveau PDF dont le titre contient « résultats »").recognized[0]).toMatchObject({ type: "document_added", contains: "résultats" });
    expect(parseRuleRequest("si le site est inaccessible").rule).toMatchObject({ category: "uptime", options: { notifyRecovery: true } });
    expect(parseRuleRequest("quand « Galaxy S27 » ou « Galaxy Fold 8 » apparaît").recognized[0]).toMatchObject({ type: "text_match", terms: ["Galaxy S27", "Galaxy Fold 8"] });
  });
  it("demande incomprise : aucune règle devinée", () => {
    const r = parseRuleRequest("fais quelque chose de bien");
    expect(r.rule).toBeNull();
    expect(r.notes[0]).toMatch(/Aucune condition/);
  });
  it("toute règle produite est valide", () => {
    for (const t of ["sous 50 € ou en promotion", "nouvelle date de concert", "nouvelle offre d'emploi", "si la page change"]) {
      const r = parseRuleRequest(t);
      expect(r.rule, t).not.toBeNull();
      expect(ruleConditionSchema.safeParse(r.rule).success, t).toBe(true);
    }
  });
});

void day;

describe("analyse de page : zones sélectionnables et suggestions", () => {
  it("propose des zones avec un sélecteur unique, sans les zones annexes", async () => {
    const { listBlocks } = await import("../src/extract/structure");
    const blocks = listBlocks(`<html><body><nav id="menu">Menu principal du site web</nav>
      <main><section id="tarifs"><h2>Nos tarifs</h2><p>Abonnement mensuel à partir de 9 €.</p></section>
      <div class="planning box"><h3>Planning</h3><p>Séances du lundi au vendredi.</p></div>
      <table><caption>Horaires</caption><tr><td>Lundi</td><td>9 h - 18 h</td></tr></table></main>
      <div class="cookie-banner" id="cookies">Nous utilisons des cookies sur ce site</div></body></html>`);
    const sels = blocks.map((b) => b.selector);
    expect(sels).toContain("#tarifs");
    expect(sels).toContain("div.planning.box");
    expect(blocks.find((b) => b.kind === "table")?.label).toBe("Horaires");
    expect(sels).not.toContain("#menu");
    expect(sels).not.toContain("#cookies");
    expect(blocks.find((b) => b.selector === "#tarifs")!.label).toBe("Nos tarifs");
  });

  it("ne suggère que ce qui a été réellement détecté", async () => {
    const { suggestRules } = await import("@waverti/types");
    const none = suggestRules({ title: "T", contentKind: "html", price: null, currency: null, regularPrice: null, availability: "unknown", items: [], documents: [], futureDates: [], headings: [], linksCount: 0, tablesCount: 0, signupForm: false, textSample: "Bonjour" });
    expect(none.map((s) => s.id)).toEqual(["change"]);
    const shop = suggestRules({ title: "T", contentKind: "html", price: 249, currency: "EUR", regularPrice: 299, availability: "out_of_stock", items: [], documents: [{ t: "Notice", u: "/n.pdf" }], futureDates: ["2027-01-10"], headings: [], linksCount: 1, tablesCount: 0, signupForm: false, textSample: "" });
    expect(shop.map((s) => s.id)).toEqual(expect.arrayContaining(["price-below", "price-15", "promo", "back-in-stock", "price-and-stock", "new-doc", "new-date"]));
    for (const s of shop) expect(ruleConditionSchema.safeParse(s.rule).success, s.id).toBe(true);
  });
});

describe("sélecteur proposé = zone réellement surveillée", () => {
  it("le sélecteur positionnel désigne la même zone à l'extraction", async () => {
    const { listBlocks } = await import("../src/extract/structure");
    const html = `<html><body><nav>Menu</nav><div><p>Annexe sans intérêt particulier</p></div><div><table><tr><td>Tarif réduit</td><td>12 €</td></tr></table></div></body></html>`;
    const table = listBlocks(html).find((b) => b.kind === "table")!;
    const obs = extractPage({ html, url: URL_, finalUrl: URL_, httpStatus: 200, method: "http", cssSelector: table.selector });
    expect(obs.selectorFound).toBe(true);
    expect(obs.excerpt).toContain("Tarif réduit");
    expect(obs.excerpt).not.toContain("Annexe");
  });
});
