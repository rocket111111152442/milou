# -*- coding: utf-8 -*-
from common import *
from blocks import *

HERO = page_hero(
    "Contact",
    ["Contact", "<em>&amp; commandes</em>"],
    "Une question, une commande, un conseil pour accorder un vin à vos raviolis&nbsp;? Appelez-nous, écrivez-nous ou passez directement à la boutique.",
    "mp-cave-vins.webp", "Intérieur de la boutique Maison Pastier, cave à vins",
    ctas=f'<a class="btn btn--light magnetic" href="tel:{PHONE_TEL}">{ico("phone")} {PHONE_TXT}</a><a class="btn btn--ghost-light magnetic" href="{DIR_URL}" target="_blank" rel="noopener">Itinéraire</a>',
    floaters="".join([floater("ravioli", "5%", "22%", 60, 0.05, -10), floater("nest", "45%", "12%", 54, 0.08, 0), floater("glass", "40%", "80%", 56, 0.06, 12)]),
)

CARDS = f'''<section class="section bg-creme">
  <div class="container">
    <div class="contact-cards">
      <a class="c-card c-card--accent" href="tel:{PHONE_TEL}" data-reveal>
        <span class="feature__icon">{ico("phone")}</span><h3>Téléphone</h3><p>Commandes, questions, disponibilités du jour.</p><span class="v">{PHONE_TXT}</span>
      </a>
      <a class="c-card" href="{DIR_URL}" target="_blank" rel="noopener" data-reveal>
        <span class="feature__icon">{ico("pin")}</span><h3>Adresse</h3><p>{ADDRESS_1}<br>{ADDRESS_2}</p><span class="v">Itinéraire →</span>
      </a>
      <div class="c-card" data-reveal>
        <span class="feature__icon">{ico("clock")}</span><h3>Horaires</h3><p>Mar – Sam : 8h30 – 13h · 16h30 – 19h<br>Dimanche : 8h30 – 13h · Lundi : fermé</p>
        <span class="status-pill" data-status style="width:max-content;background:var(--canard-100);box-shadow:none"><i></i><span data-status-text>Horaires</span></span>
      </div>
      <div class="c-card" data-reveal>
        <span class="feature__icon">{ico("instagram")}</span><h3>Réseaux</h3><p>Nouveautés et ravioli du terroir du moment.</p>
        <div class="socials" style="margin-top:0">
          <a href="{INSTA}" target="_blank" rel="noopener" aria-label="Instagram" style="box-shadow:inset 0 0 0 1px var(--line);color:var(--canard-700)">{ico("instagram")}</a>
          <a href="{FB}" target="_blank" rel="noopener" aria-label="Facebook" style="box-shadow:inset 0 0 0 1px var(--line);color:var(--canard-700)">{ico("facebook")}</a>
          <a href="{MAPS_URL}" target="_blank" rel="noopener" aria-label="Google Maps" style="box-shadow:inset 0 0 0 1px var(--line);color:var(--canard-700)">{ico("pin")}</a>
        </div>
      </div>
    </div>
  </div>
</section>'''

FORM = f'''<section class="section bg-creme" style="padding-top:0">
  <div class="container">
    <div class="visit__grid">
      <div class="visit__info">
        <div class="section-head" style="margin-bottom:0">
          <span class="eyebrow">Écrivez-nous</span>
          <h2 data-split>Un message, <em>une question</em>&nbsp;?</h2>
          <p class="lead" data-reveal>Votre message s’ouvre dans l’application SMS de votre téléphone, prêt à être envoyé à la boutique. Pour commander une box, utilisez plutôt notre <a class="link-arrow" href="repas.html#commande" style="padding-bottom:0">composeur de box</a>.</p>
        </div>
        {hours_table()}
      </div>
      <form class="order__builder light-form" data-contact data-reveal>
        <div class="form-grid" style="grid-template-columns:1fr">
          <label class="input">Votre prénom<input id="c-name" type="text" autocomplete="given-name" placeholder="Prénom"></label>
          <label class="input">Votre message<textarea id="c-msg" rows="7" placeholder="Bonjour, j’aimerais savoir…" required></textarea></label>
        </div>
        <div class="btn-row">
          <button class="btn magnetic" type="submit">{ico("sms")} Envoyer par SMS</button>
          <a class="btn btn--ghost magnetic" href="tel:{PHONE_TEL}">{ico("phone")} Appeler</a>
        </div>
        <p style="margin-top:18px;font-size:.85rem;color:var(--ink-soft)">Aucune donnée n’est enregistrée par ce site : le message part directement de votre téléphone.</p>
      </form>
    </div>
  </div>
</section>'''

MAP = f'''<section class="section bg-creme-2">
  <div class="container">
    <div class="section-head section-head--split">
      <div style="display:grid;gap:22px">
        <span class="eyebrow">Accès</span>
        <h2 data-split>En plein centre <em>de Six-Fours</em></h2>
      </div>
      <p class="lead" data-reveal>Au 54 rue République, 83140 Six-Fours-les-Plages.</p>
    </div>
    <div class="map" data-reveal style="min-height:520px">
      <iframe title="Plan d’accès à Maison Pastier" src="{EMBED_URL}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      <span class="map__hint">Cliquer pour explorer</span>
      <a class="map__card" href="{DIR_URL}" target="_blank" rel="noopener"><img src="assets/img/favicon.svg" alt="" width="48" height="48"><span><strong>Maison Pastier</strong><span>Itinéraire depuis ma position →</span></span></a>
    </div>
  </div>
</section>'''

MAIN = "\n".join([HERO, CARDS, FORM, MAP])

build("contact.html",
      "Contact & commandes · Maison Pastier · Six-Fours-les-Plages",
      "Contactez Maison Pastier, fabrique de pâtes fraîches au 54 rue République à Six-Fours-les-Plages : 06 64 97 42 82. Horaires, plan d’accès et commandes.",
      "contact", MAIN, with_ld=True)
