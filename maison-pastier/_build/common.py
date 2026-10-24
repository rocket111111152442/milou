# -*- coding: utf-8 -*-
"""Éléments partagés (head, header, menu, footer, pictos) pour générer les pages statiques."""
import json, re, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
SITE = os.environ.get("SITE_URL", "https://maison-pastier.vercel.app").rstrip("/")

PHONE_TEL = "+33664974282"
PHONE_TXT = "06 64 97 42 82"
ADDRESS_1 = "54 rue République"
ADDRESS_2 = "83140 Six-Fours-les-Plages"
MAPS_URL = "https://maps.app.goo.gl/MPqmu2Xg8sTMtsq7A"
DIR_URL = "https://www.google.com/maps/dir/?api=1&amp;destination=Maison+Pastier,+54+Rue+R%C3%A9publique,+83140+Six-Fours-les-Plages"
EMBED_URL = "https://maps.google.com/maps?q=Maison%20Pastier%2C%2054%20Rue%20R%C3%A9publique%2C%2083140%20Six-Fours-les-Plages&amp;z=17&amp;output=embed"
INSTA = "https://www.instagram.com/maisonpastier/"
FB = "https://www.facebook.com/p/Maison-Pastier-61578283412855/"

# --------------------------------------------------------------------------
# Pictos : (viewBox, contenu). Les pâtes sont dessinées en 64×64.
# --------------------------------------------------------------------------
def g(body, w="2.6"):
    return f'<g stroke-width="{w}">{body}</g>'

ICONS = {
    # UI 24×24
    "arrow": ("0 0 24 24", '<path d="M4 12h16M14 6l6 6-6 6"/>'),
    "phone": ("0 0 24 24", '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
    "pin": ("0 0 24 24", '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
    "clock": ("0 0 24 24", '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.5V12l3.5 2"/>'),
    "instagram": ("0 0 24 24", '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>'),
    "facebook": ("0 0 24 24", '<path d="M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H5.5v3.5H8V21h3.5v-7.5H14l.6-3.5h-3.1V7.8c0-.8.5-1.3 1.3-1.3H15z"/>'),
    "sms": ("0 0 24 24", '<path d="M21 12a8 8 0 0 1-11.8 7L4 20.5l1.5-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>'),
    "copy": ("0 0 24 24", '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>'),
    "info": ("0 0 24 24", '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5h.01"/>'),
    "route": ("0 0 24 24", '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>'),
    "star": ("0 0 24 24", '<path fill="currentColor" stroke="none" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/>'),
    # Pâtes & cuisine 64×64
    "ravioli": ("0 0 64 64", g('<rect x="9" y="9" width="46" height="46" rx="6"/><path d="M9 17h4M9 25h4M9 33h4M9 41h4M9 49h4M51 17h4M51 25h4M51 33h4M51 41h4M51 49h4M17 9v4M25 9v4M33 9v4M41 9v4M49 9v4M17 51v4M25 51v4M33 51v4M41 51v4M49 51v4"/><rect x="18" y="18" width="28" height="28" rx="9"/><path d="M26 29c1.6-2 3.6-3 6-3"/>')),
    "farfalle": ("0 0 64 64", g('<path d="M32 28C25 20 15 15 8 14c1.5 9 1.5 27 0 36 7-1 17-6 24-14 7 8 17 13 24 14-1.5-9-1.5-27 0-36-7 1-17 6-24 14z"/><path d="M29 29c1.5 2 1.5 4 0 6M35 29c-1.5 2-1.5 4 0 6M13 21c.8 7 .8 15 0 22M51 21c-.8 7-.8 15 0 22"/>')),
    "fusilli": ("0 0 64 64", g('<rect x="23" y="5" width="18" height="54" rx="9"/><path d="M24 17c5-1 10-4 16-8M24 27c5-1 10-4 16-8M24 37c5-1 10-4 16-8M24 47c5-1 10-4 16-8M25 56c5-1 9-3 14-7"/>')),
    "rigatoni": ("0 0 64 64", g('<ellipse cx="32" cy="13" rx="12" ry="5"/><path d="M20 13v38c0 2.8 5.4 5 12 5s12-2.2 12-5V13"/><path d="M26 18.5v36M32 19v37M38 18.5v36"/>')),
    "nest": ("0 0 64 64", g('<path d="M32 32m-3 0a3 3 0 1 1 6 0a6 6 0 1 1-12 0a9 9 0 1 1 18 0a12 12 0 1 1-24 0a15 15 0 1 1 30 0a18 18 0 1 1-36 0"/>')),
    "gnocchi": ("0 0 64 64", g('<path d="M12 34c0-9 9-16 20-16s20 7 20 16-9 14-20 14-20-5-20-14z"/><path d="M21 23c-2 6-2 15 0 21M28.5 20c-1.5 8-1.5 19 0 27M35.5 20c1.5 8 1.5 19 0 27M43 23c2 6 2 15 0 21"/>')),
    "wheat": ("0 0 64 64", g('<path d="M32 59V16M32 16c0-4 1-7 3-10"/><path d="M32 24c-6-1-9-5-9-10 5 0 9 3 9 8zM32 24c6-1 9-5 9-10-5 0-9 3-9 8zM32 35c-6-1-9-5-9-10 5 0 9 3 9 8zM32 35c6-1 9-5 9-10-5 0-9 3-9 8zM32 46c-6-1-9-5-9-10 5 0 9 3 9 8zM32 46c6-1 9-5 9-10-5 0-9 3-9 8z"/>')),
    "egg": ("0 0 64 64", g('<path d="M32 7c9 0 19 15 19 28a19 19 0 0 1-38 0C13 22 23 7 32 7z"/><path d="M23 33c0-6 2.5-11 6-14"/>')),
    "dough": ("0 0 64 64", g('<path d="M8 46c0-13 11-24 24-24s24 11 24 24c0 5-4 8-9 8H17c-5 0-9-3-9-8z"/><path d="M21 36c4-3 10-4 15-2M27 45c4-2 9-2 13 0"/><path d="M14 16h.01M48 12h.01M40 8h.01M22 10h.01"/>')),
    "rolling": ("0 0 64 64", g('<path d="M17 39l22-22a5 5 0 0 1 7 0l1 1a5 5 0 0 1 0 7L25 47a5 5 0 0 1-7 0l-1-1a5 5 0 0 1 0-7z"/><path d="M15 49l-7 7M49 15l7-7M30 26l8 8"/>')),
    "cutter": ("0 0 64 64", g('<circle cx="22" cy="42" r="14"/><circle cx="22" cy="42" r="4"/><path d="M22 28v4M22 52v4M8 42h4M32 42h4M12 32l3 3M29 49l3 3M12 52l3-3"/><path d="M32 32l16-16a3.5 3.5 0 0 1 5 5L37 37"/>')),
    "jar": ("0 0 64 64", g('<rect x="20" y="8" width="24" height="9" rx="2"/><path d="M18 21c0-2 1.5-4 4-4h20c2.5 0 4 2 4 4v31c0 3-2.5 5-5 5H23c-2.5 0-5-2-5-5z"/><path d="M18 31h28M18 47h28"/>')),
    "bottle": ("0 0 64 64", g('<path d="M28 6h8v12c0 3 7 6 7 13v24c0 2-1.5 3-3.5 3h-15c-2 0-3.5-1-3.5-3V31c0-7 7-10 7-13z"/><path d="M21 36h22v12H21z"/>')),
    "glass": ("0 0 64 64", g('<path d="M19 7h26c0 15-4.5 24-13 24S19 22 19 7z"/><path d="M20 16h24M32 31v22M23 57h18"/>')),
    "bowl": ("0 0 64 64", g('<path d="M7 30h50c0 12-10.5 22-25 22S7 42 7 30z"/><path d="M24 22c-2-3 2-5 0-8M32 22c-2-3 2-5 0-8M40 22c-2-3 2-5 0-8M20 58h24"/>')),
    "cheese": ("0 0 64 64", g('<path d="M7 44V33L40 14l17 12v18z"/><path d="M7 33h50"/><circle cx="20" cy="39" r="2.5"/><circle cx="36" cy="37" r="3"/><circle cx="47" cy="40" r="2"/>')),
    "soda": ("0 0 64 64", g('<rect x="21" y="9" width="22" height="48" rx="5"/><path d="M21 18h22M21 48h22M29 5h6"/>')),
    "pot": ("0 0 64 64", g('<path d="M10 27h44M14 27v19c0 5 4 9 9 9h18c5 0 9-4 9-9V27M5 31h9M50 31h9"/><path d="M24 19c-2-3 2-5 0-8M32 19c-2-3 2-5 0-8M40 19c-2-3 2-5 0-8"/>')),
    "snow": ("0 0 64 64", g('<path d="M32 6v52M9.5 19l45 26M9.5 45l45-26M26 10l6 6 6-6M26 54l6-6 6 6M10 27l8-2-2-8M54 37l-8 2 2 8M10 37l8 2-2 8M54 27l-8-2 2-8"/>')),
    "leaf": ("0 0 64 64", g('<path d="M12 52C12 29 27 13 53 11c0 26-15 41-41 41z"/><path d="M12 52l22-22M26 38h9M34 30v-9"/>')),
    "moon": ("0 0 64 64", g('<path d="M46 42A20 20 0 0 1 24 13a21 21 0 1 0 22 29z"/><path d="M46 12v6M43 15h6M54 26v4M52 28h4"/>')),
    "hand": ("0 0 64 64", g('<path d="M20 30V14a3.5 3.5 0 0 1 7 0v13M27 26V10a3.5 3.5 0 0 1 7 0v16M34 26V13a3.5 3.5 0 0 1 7 0v15M41 28v-8a3.5 3.5 0 0 1 7 0v16c0 12-7 20-17 20-8 0-12-4-16-10l-6-10a3.5 3.5 0 0 1 6-3.5L20 36"/>')),
    "basket": ("0 0 64 64", g('<path d="M8 26h48l-5 28H13z"/><path d="M20 26l8-16M44 26l-8-16M22 34v12M32 34v12M42 34v12"/>')),
    "sun": ("0 0 64 64", g('<circle cx="32" cy="32" r="11"/><path d="M32 6v7M32 51v7M6 32h7M51 32h7M13.6 13.6l5 5M45.4 45.4l5 5M13.6 50.4l5-5M45.4 18.6l5-5"/>')),
    "calendar": ("0 0 64 64", g('<rect x="9" y="13" width="46" height="42" rx="6"/><path d="M9 25h46M21 7v12M43 7v12M20 35h6M30 35h6M40 35h4M20 45h6M30 45h6"/>')),
}


def ico(name, cls="ico", extra=""):
    vb, body = ICONS[name]
    return f'<svg class="{cls}" viewBox="{vb}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"{extra}>{body}</svg>'


def stars(n=5):
    return '<span class="stars" aria-hidden="true">' + "".join(ico("star") for _ in range(n)) + "</span>"


ARROW = ico("arrow")

# --------------------------------------------------------------------------
# Navigation
# --------------------------------------------------------------------------
NAV = [
    ("index", "index.html", "Accueil"),
    ("savoir-faire", "savoir-faire.html", "Savoir-faire"),
    ("produits", "produits.html", "Produits"),
    ("repas", "repas.html", "Repas &amp; tarifs"),
    ("contact", "contact.html", "Contact"),
]

FONTS = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,400&family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Oswald:wght@400;500&display=swap"

HEAD_SCRIPT = ("<script>(function(d){var h=d.documentElement;h.classList.add('js');try{"
               "if(matchMedia('(prefers-reduced-motion: reduce)').matches)h.classList.add('reduce-motion');"
               "if(sessionStorage.getItem('mp-intro'))h.classList.add('intro-seen');"
               "if(sessionStorage.getItem('mp-nav')){sessionStorage.removeItem('mp-nav');"
               "if(!h.classList.contains('reduce-motion'))h.classList.add('is-entering');}"
               "}catch(e){}})(document);</script>")

HOURS_ROWS = [
    (2, "Mardi", "8h30 – 13h00 · 16h30 – 19h00"),
    (3, "Mercredi", "8h30 – 13h00 · 16h30 – 19h00"),
    (4, "Jeudi", "8h30 – 13h00 · 16h30 – 19h00"),
    (5, "Vendredi", "8h30 – 13h00 · 16h30 – 19h00"),
    (6, "Samedi", "8h30 – 13h00 · 16h30 – 19h00"),
    (0, "Dimanche", "8h30 – 13h00"),
    (1, "Lundi", "Fermé"),
]


def hours_table(title="Horaires d’ouverture"):
    rows = "".join(
        f'<tr data-hours-row="{d}"{" class=\"is-closed\"" if v == "Fermé" else ""}><th scope="row">{n}</th><td>{v}</td></tr>'
        for d, n, v in HOURS_ROWS)
    return f'''<div class="hours" data-reveal>
  <div class="hours__head"><h3>{title}</h3><span class="status-pill" data-status><i></i><span data-status-text>Horaires</span></span></div>
  <table><caption class="sr-only">{title}</caption><tbody>{rows}</tbody></table>
</div>'''


def jsonld():
    data = {
        "@context": "https://schema.org",
        "@type": ["Store", "FoodEstablishment"],
        "name": "Maison Pastier",
        "description": "Fabrique artisanale de pâtes fraîches, raviolis, gnocchis, sauces maison, épicerie fine, cave à vins et box repas à emporter à Six-Fours-les-Plages.",
        "telephone": "+33 6 64 97 42 82",
        "servesCuisine": ["Pâtes fraîches", "Raviolis", "Gnocchis"],
        "priceRange": "€",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "54 Rue République",
            "postalCode": "83140",
            "addressLocality": "Six-Fours-les-Plages",
            "addressRegion": "Var",
            "addressCountry": "FR",
        },
        "geo": {"@type": "GeoCoordinates", "latitude": 43.09269, "longitude": 5.84006},
        "openingHoursSpecification": [
            {"@type": "OpeningHoursSpecification", "dayOfWeek": ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], "opens": "08:30", "closes": "13:00"},
            {"@type": "OpeningHoursSpecification", "dayOfWeek": ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], "opens": "16:30", "closes": "19:00"},
            {"@type": "OpeningHoursSpecification", "dayOfWeek": "Sunday", "opens": "08:30", "closes": "13:00"},
        ],
        "sameAs": [INSTA, FB, MAPS_URL],
    }
    if SITE:
        data["url"] = SITE + "/"
        data["image"] = SITE + "/assets/img/og-image.jpg"
        data["logo"] = SITE + "/assets/img/apple-touch-icon.png"
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>"


def head(title, desc, with_ld=False):
    og_img = (SITE + "/assets/img/og-image.jpg") if SITE else "assets/img/og-image.jpg"
    return f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#0d4a54">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Maison Pastier">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{og_img}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="assets/css/style.css">
{HEAD_SCRIPT}
{jsonld() if with_ld else ""}
</head>'''


def header(active):
    links = "".join(
        f'<a href="{href}"{" aria-current=\"page\"" if key == active else ""}><span data-text="{label}">{label}</span></a>'
        for key, href, label in NAV)
    mlinks = "".join(
        f'<a href="{href}"{" aria-current=\"page\"" if key == active else ""}><small>0{i + 1}</small><span>{label}</span></a>'
        for i, (key, href, label) in enumerate(NAV))
    return f'''<header class="site-header" data-header>
  <a class="brand" href="index.html" aria-label="Maison Pastier, retour à l’accueil">
    <img class="brand-logo brand-logo--light" src="assets/img/logo-blanc.svg" alt="" width="54" height="53">
    <img class="brand-logo brand-logo--dark" src="assets/img/logo-canard.svg" alt="" width="54" height="53">
    <span class="brand-text"><strong>Maison Pastier</strong><small>Fabrique de pâtes fraîches</small></span>
  </a>
  <nav class="main-nav" aria-label="Navigation principale">{links}</nav>
  <div class="header-actions">
    <span class="status-pill" data-status><i></i><span data-status-text>Horaires</span></span>
    <a class="btn btn--sm magnetic" href="tel:{PHONE_TEL}">{ico("phone")} Appeler</a>
    <button class="burger" type="button" aria-expanded="false" aria-controls="mobile-menu"><span></span><span></span><span class="sr-only">Ouvrir le menu</span></button>
  </div>
</header>
<div class="mobile-menu" id="mobile-menu" aria-hidden="true">
  <nav aria-label="Navigation mobile">{mlinks}</nav>
  <div class="mobile-menu__foot">
    <span class="status-pill" data-status style="width:max-content"><i></i><span data-status-text>Horaires</span></span>
    <p>{ADDRESS_1}, {ADDRESS_2}</p>
    <a href="tel:{PHONE_TEL}">{PHONE_TXT}</a>
    <div class="socials">
      <a href="{INSTA}" target="_blank" rel="noopener" aria-label="Instagram">{ico("instagram")}</a>
      <a href="{FB}" target="_blank" rel="noopener" aria-label="Facebook">{ico("facebook")}</a>
    </div>
  </div>
</div>'''


CURTAIN = '''<div class="curtain" aria-hidden="true">
  <div class="curtain__panel"></div><div class="curtain__panel"></div><div class="curtain__panel"></div><div class="curtain__panel"></div>
  <img class="curtain__logo" src="assets/img/logo-blanc.svg" alt="">
</div>'''


def footer():
    navlinks = "".join(f'<li><a href="{href}">{label}</a></li>' for _, href, label in NAV)
    return f'''<footer class="site-footer bg-canard">
  <div class="container footer__cta">
    <h2 data-split>Une envie de <em>pâtes fraîches</em>&nbsp;?</h2>
    <div class="btn-row" style="align-items:center;gap:26px">
      <a class="footer__phone" href="tel:{PHONE_TEL}">{PHONE_TXT}</a>
      <a class="btn btn--light magnetic" href="{DIR_URL}" target="_blank" rel="noopener">Itinéraire {ARROW}</a>
    </div>
  </div>
  <div class="container footer__grid">
    <div class="footer__brand">
      <img src="assets/img/logo-blanc.svg" alt="Maison Pastier, fabrique de pâtes fraîches" width="120" height="118" loading="lazy">
      <p>Fabrique artisanale de pâtes fraîches, sauces maison, épicerie fine et cave à vins à Six-Fours-les-Plages.</p>
    </div>
    <div class="footer__col">
      <h4>Navigation</h4>
      <ul>{navlinks}</ul>
    </div>
    <div class="footer__col">
      <h4>Horaires</h4>
      <dl>
        <dt>Mar – Sam</dt><dd>8h30 – 13h · 16h30 – 19h</dd>
        <dt>Dimanche</dt><dd>8h30 – 13h</dd>
        <dt>Lundi</dt><dd>Fermé</dd>
      </dl>
    </div>
    <div class="footer__col">
      <h4>Contact</h4>
      <ul>
        <li><a href="{MAPS_URL}" target="_blank" rel="noopener">{ADDRESS_1}<br>{ADDRESS_2}</a></li>
        <li><a href="tel:{PHONE_TEL}">{PHONE_TXT}</a></li>
      </ul>
      <div class="socials">
        <a href="{INSTA}" target="_blank" rel="noopener" aria-label="Instagram">{ico("instagram")}</a>
        <a href="{FB}" target="_blank" rel="noopener" aria-label="Facebook">{ico("facebook")}</a>
        <a href="{MAPS_URL}" target="_blank" rel="noopener" aria-label="Google Maps">{ico("pin")}</a>
      </div>
    </div>
  </div>
  <div class="footer__giant" aria-hidden="true">Maison Pastier</div>
  <div class="container footer__bottom">
    <p>© <span data-year>2026</span> Maison Pastier · Six-Fours-les-Plages</p>
    <nav aria-label="Liens légaux"><a href="mentions-legales.html">Mentions légales</a><a href="mentions-legales.html#credits">Crédits photos</a></nav>
  </div>
</footer>
<button class="to-top" type="button" aria-label="Revenir en haut de la page">
  <svg class="ring" viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="25.5" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>
  {ico("arrow", "arrow")}
</button>'''


SCRIPTS = '''<script src="assets/vendor/gsap.min.js" defer></script>
<script src="assets/vendor/ScrollTrigger.min.js" defer></script>
<script src="assets/vendor/lenis.min.js" defer></script>
<script src="assets/js/main.js" defer></script>'''


def frtypo(html):
    """Espaces insécables avant : ? ! ; dans le texte (hors balises)."""
    parts = re.split(r"(<[^>]+>)", html)
    out = []
    for p in parts:
        if p.startswith("<"):
            out.append(p)
        else:
            p = re.sub(r" ([:?!;»])", "\u00a0\\1", p)
            p = re.sub(r"(«) ", "\\1\u00a0", p)
            out.append(p)
    return "".join(out)


def page_hero(crumb, lines, lead, img, alt, ctas="", floaters=""):
    h1 = "".join(f'<span class="line"><span>{l}</span></span>' for l in lines)
    return f'''<section class="page-hero bg-canard on-dark">
  <div class="hero__floaters" aria-hidden="true">{floaters}</div>
  <div class="container page-hero__grid">
    <div class="page-hero__copy">
      <nav class="breadcrumb" aria-label="Fil d’Ariane" data-hero-fade><a href="index.html">Accueil</a><span>/</span><span aria-current="page">{crumb}</span></nav>
      <h1>{h1}</h1>
      <p class="lead" data-hero-fade>{lead}</p>
      {f'<div class="btn-row" data-hero-fade>{ctas}</div>' if ctas else ""}
    </div>
    <div class="arch"><img src="assets/img/{img}" alt="{alt}" width="800" height="1100" fetchpriority="high"></div>
  </div>
</section>'''


def floater(name, left, top, size, depth, rot=0):
    return f'<span class="floater" data-depth="{depth}" style="left:{left};top:{top};width:{size}px;height:{size}px;transform:rotate({rot}deg)">{ico(name)}</span>'


def build(filename, title, desc, active, main, intro="", with_ld=False, base=False):
    body = f'''<body class="page-{active}">
<a class="skip-link" href="#main">Aller au contenu</a>
{intro}
{CURTAIN}
{header(active)}
<main id="main">
{main}
</main>
{footer()}
{SCRIPTS}
</body>
</html>
'''
    html = head(title, desc, with_ld) + "\n" + frtypo(body)
    if base:
        html = html.replace("<meta charset=\"utf-8\">", "<meta charset=\"utf-8\">\n<base href=\"/\">", 1)
    with open(os.path.join(OUT, filename), "w", encoding="utf-8") as f:
        f.write(html)
    print("écrit", filename, len(html) // 1024, "Ko")
