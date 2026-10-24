# -*- coding: utf-8 -*-
"""Blocs réutilisés sur plusieurs pages (tarifs, sauces, visite, marquee…)."""
from common import *


def marquee(items, cls="wood marquee--tilt", reverse=False, speed=1):
    inner = "".join(f'<span class="marquee__item">{ico(i)}{t}</span>' for i, t in items)
    rev = ' data-reverse="1"' if reverse else ""
    html = f'''<div class="marquee {cls}" data-marquee="{speed}"{rev} aria-label="{" · ".join(t for _, t in items)}">
  <div class="marquee__track"><div class="marquee__group">{inner}</div></div>
</div>'''
    return f'<div class="marquee-wrap">{html}</div>' if "marquee--tilt" in cls else html


MARQUEE_MAIN = [("ravioli", "Raviolis maison"), ("nest", "Tagliatelles"), ("gnocchi", "Gnocchis"),
                ("jar", "Sauces maison"), ("leaf", "Épicerie fine"), ("glass", "Cave à vins"), ("bowl", "Box du midi")]


def price_card(title, icon, seule, menu, items, feat=False, ribbon=""):
    e, c = f"{seule:.2f}".split(".")
    lis = "".join(f'<li{" class=\"menu-only\"" if m else ""}>{t}</li>' for t, m in items)
    rib = f'<span class="ribbon">{ribbon}</span>' if ribbon else ""
    return f'''<article class="price-card{" price-card--feat" if feat else ""}" data-reveal>
  {rib}
  <div class="price-card__head">
    <h3>{title}</h3>
    <span class="price-card__icon">{ico(icon)}</span>
  </div>
  <p class="price" data-price data-seule="{seule:.2f}" data-menu="{menu:.2f}" aria-live="polite"><span class="price__euros">{e}</span><span class="price__cents">,{c}</span><sup>€</sup></p>
  <ul>{lis}</ul>
</article>'''


def tarifs(section_id="tarifs", head_level="h2"):
    return f'''<section class="section tarifs wood on-dark" id="{section_id}" data-formule-scope="seule">
  <div class="container">
    <div class="tarifs__top">
      <div class="section-head" style="margin:0">
        <span class="eyebrow">Box du midi</span>
        <{head_level} data-split>Nos <em>tarifs</em></{head_level}>
        <p class="lead">Box repas préparées chaque midi, à emporter, et bientôt disponibles le soir. Toujours avec une sauce maison et un généreux parmesan.</p>
      </div>
      <div class="switch" data-switch data-state="seule" role="group" aria-label="Formule">
        <span class="switch__thumb" aria-hidden="true"></span>
        <button type="button" data-formule="seule" aria-pressed="true">Box seule</button>
        <button type="button" data-formule="menu" aria-pressed="false">En menu</button>
      </div>
    </div>
    <div class="price-cards">
      {price_card("Pâtes ou gnocchis", "gnocchi", 8.5, 9.5, [("Pâtes fraîches ou gnocchis maison", 0), ("Sauce maison au choix", 0), ("Parmesan", 0), ("Boisson : eau ou soda", 1)])}
      {price_card("Raviolis", "ravioli", 9.5, 10.5, [("Raviolis maison", 0), ("Sauce maison au choix", 0), ("Parmesan", 0), ("Boisson : eau ou soda", 1)], feat=True, ribbon="Signature")}
    </div>
    <div class="tarifs__note" data-reveal>
      <p>Commandez par téléphone au <strong><a href="tel:{PHONE_TEL}">{PHONE_TXT}</a></strong> ou composez votre box en ligne.</p>
      <a class="btn btn--light magnetic" href="repas.html#commande">Composer ma box {ARROW}</a>
    </div>
  </div>
</section>'''


SAUCES = [("Jus de la daube", "#5b2a1c"), ("Poivronnade à l’ail confit", "#c2502f"),
          ("Sauce gorgonzola", "#e6dfc3"), ("Sauce cèpe", "#9a7046"), ("Sauce truffe", "#3b332b")]


def jar_svg():
    return ('<svg viewBox="0 0 80 100" aria-hidden="true"><rect class="jar-lid" x="18" y="6" width="44" height="14" rx="3"/>'
            '<path class="jar-glass" d="M14 26c0-4 3-6 6-6h40c3 0 6 2 6 6v58c0 5-4 9-9 9H23c-5 0-9-4-9-9z"/>'
            '<path class="jar-fill" d="M17 40h46v44c0 4-3 6-6 6H23c-3 0-6-2-6-6z"/>'
            '<rect class="jar-label" x="22" y="50" width="36" height="24" rx="3"/>'
            '<path d="M28 59h24M31 65h18" stroke="#8a5a33" stroke-width="1.5" stroke-linecap="round"/></svg>')


def jars():
    return '<ul class="jars" data-jars>' + "".join(
        f'<li class="jar" style="--jar:{c}">{jar_svg()}<span>{n}</span></li>' for n, c in SAUCES) + "</ul>"


def visit(title_tag="h2"):
    return f'''<section class="section bg-creme-2" id="visite">
  <div class="container">
    <div class="section-head section-head--split">
      <div style="display:grid;gap:22px">
        <span class="eyebrow">Nous trouver</span>
        <{title_tag} data-split>Rendez-vous <em>à la boutique</em></{title_tag}>
      </div>
      <p class="lead" data-reveal>Maison Pastier vous accueille avec authenticité et gourmandise. Entre pâtes fraîches et box repas, nous réunissons tradition et saveurs modernes, pour vos courses, vos repas rapides ou vos envies gourmandes.</p>
    </div>
    <div class="visit__grid">
      <div class="visit__info">
        <div class="info-list" data-reveal>
          <div class="info-row"><span class="ico-wrap">{ico("pin")}</span><div><small>Adresse</small><a href="{MAPS_URL}" target="_blank" rel="noopener">{ADDRESS_1}, {ADDRESS_2}</a></div></div>
          <div class="info-row"><span class="ico-wrap">{ico("phone")}</span><div><small>Téléphone</small><a href="tel:{PHONE_TEL}">{PHONE_TXT}</a></div></div>
          <div class="info-row"><span class="ico-wrap">{ico("instagram")}</span><div><small>Instagram</small><a href="{INSTA}" target="_blank" rel="noopener">@maisonpastier</a></div></div>
        </div>
        {hours_table()}
      </div>
      <div class="map" data-reveal>
        <iframe title="Plan d’accès à Maison Pastier, 54 rue République à Six-Fours-les-Plages" src="{EMBED_URL}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        <span class="map__hint">Cliquer pour explorer</span>
        <a class="map__card" href="{DIR_URL}" target="_blank" rel="noopener">
          <img src="assets/img/favicon.svg" alt="" width="48" height="48">
          <span><strong>Maison Pastier</strong><span>Itinéraire depuis ma position →</span></span>
        </a>
      </div>
    </div>
  </div>
</section>'''


HERO_FLOATERS = "".join([
    floater("farfalle", "4%", "18%", 70, 0.05, -18),
    floater("fusilli", "44%", "12%", 58, 0.08, 24),
    floater("ravioli", "38%", "78%", 64, 0.06, 12),
    floater("rigatoni", "2%", "72%", 56, 0.09, -30),
    floater("nest", "88%", "82%", 66, 0.04, 0),
    floater("gnocchi", "92%", "16%", 52, 0.07, 20),
])
