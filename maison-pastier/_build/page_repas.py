# -*- coding: utf-8 -*-
from common import *
from blocks import *

HERO = page_hero(
    "Repas &amp; tarifs",
    ["Repas", "<em>à emporter</em>"],
    "Des repas savoureux et faits maison : box repas le midi, bientôt disponibles le soir, avec pâtes fraîches, gnocchis et sauces artisanales. À emporter ou à commander.",
    "mp-box-gnocchis.webp", "Box repas de gnocchis maison au parmesan",
    ctas=f'<a class="btn btn--light magnetic" href="#commande">Composer ma box {ARROW}</a><a class="btn btn--ghost-light magnetic" href="#tarifs">Voir les tarifs</a>',
    floaters="".join([floater("bowl", "5%", "20%", 66, 0.05, -10), floater("cheese", "45%", "12%", 52, 0.08, 14), floater("soda", "40%", "80%", 54, 0.06, -12), floater("gnocchi", "91%", "72%", 56, 0.07, 22)]),
)


def how(icon, title, text):
    return f'<article class="how__item" data-reveal><span class="feature__icon">{ico(icon)}</span><h3>{title}</h3><p>{text}</p></article>'


HOW = f'''<section class="section bg-creme">
  <div class="container">
    <div class="section-head section-head--split">
      <div style="display:grid;gap:22px">
        <span class="eyebrow">Nos repas du midi</span>
        <h2 data-split>Une box, <em>trois gestes</em></h2>
      </div>
      <p class="lead" data-reveal>Nos box repas, disponibles chaque midi, sont idéales pour une pause rapide et gourmande. Préparées à base de pâtes fraîches ou de gnocchis maison, elles sont toujours accompagnées d’une sauce savoureuse et d’un généreux parmesan.</p>
    </div>
    <div class="how">
      {how("nest", "Choisissez la base", "Pâtes fraîches, gnocchis maison ou raviolis artisanaux.")}
      {how("jar", "Ajoutez la sauce", "Gorgonzola, cèpe ou truffe : nos sauces sont préparées chaque jour.")}
      {how("cheese", "Parmesan &amp; boisson", "Toujours un généreux parmesan. En menu, une boisson fraîche : eau ou soda.")}
    </div>
  </div>
</section>'''

DUO = f'''<section class="section bg-creme" style="padding-top:0">
  <div class="container">
    <div class="feature">
      <div class="feature__media"><div class="feature__frame" data-reveal-img data-inner-parallax><img src="assets/img/mp-pates-sauce.webp" alt="Pâtes fraîches, sauce maison et parmesan en box" width="900" height="1100" loading="lazy"></div></div>
      <div class="feature__copy">
        <span class="eyebrow">Pâtes fraîches &amp; sauces maison</span>
        <h2 data-split>Une pause repas, <em>un vrai plaisir</em></h2>
        <p class="lead" data-reveal>Nos pâtes fraîches artisanales s’accompagnent de sauces gourmandes préparées chaque jour : gorgonzola, cèpe ou truffe.</p>
      </div>
    </div>
    <div class="feature feature--rev">
      <div class="feature__media"><div class="feature__frame" data-reveal-img data-inner-parallax><img src="assets/img/mp-gnocchis-box.webp" alt="Gnocchis maison, sauce et parmesan" width="900" height="1100" loading="lazy"></div></div>
      <div class="feature__copy">
        <span class="eyebrow">Les gnocchis maison</span>
        <h2 data-split>Moelleux <em>et fondants</em></h2>
        <p class="lead" data-reveal>Nos gnocchis frais sont accompagnés des mêmes sauces maison. Un plat réconfortant, idéal pour varier vos envies gourmandes.</p>
      </div>
    </div>
  </div>
</section>'''


def choice(name, value, label, small="", icon=None, checked=False):
    i = ico(icon) if icon else ""
    s = f"<small>{small}</small>" if small else ""
    return f'<label class="choice"><input type="radio" name="{name}" value="{value}"{" checked" if checked else ""}><span>{i}{label}{s}</span></label>'


ORDER = f'''<section class="section bg-creme-2" id="commande">
  <div class="container">
    <div class="section-head section-head--split">
      <div style="display:grid;gap:22px">
        <span class="eyebrow">Commande</span>
        <h2 data-split>Composez <em>votre box</em></h2>
      </div>
      <p class="lead" data-reveal>Préparez votre commande ici puis envoyez-la par SMS en un geste : le message est pré-rempli. Elle est validée une fois confirmée par la boutique.</p>
    </div>
    <div class="order">
      <form class="order__builder" data-order data-reveal onsubmit="return false">
        <fieldset class="field">
          <legend>1. La base</legend>
          <div class="choices">
            {choice("base", "pates", "Pâtes fraîches", "8,50 €", "nest", True)}
            {choice("base", "gnocchis", "Gnocchis", "8,50 €", "gnocchi")}
            {choice("base", "raviolis", "Raviolis", "9,50 €", "ravioli")}
          </div>
        </fieldset>
        <fieldset class="field">
          <legend>2. La sauce maison</legend>
          <div class="choices">
            {choice("sauce", "gorgonzola", "Gorgonzola", checked=True)}
            {choice("sauce", "cèpe", "Cèpe")}
            {choice("sauce", "truffe", "Truffe")}
          </div>
        </fieldset>
        <fieldset class="field">
          <legend>3. La formule</legend>
          <div class="choices choices--2">
            {choice("formule", "seule", "Box seule", "avec parmesan", checked=True)}
            {choice("formule", "menu", "En menu", "+ 1,00 € · boisson")}
          </div>
        </fieldset>
        <fieldset class="field drink-field" hidden>
          <legend>Boisson</legend>
          <div class="choices choices--2">
            {choice("drink", "eau", "Eau", icon="bottle", checked=True)}
            {choice("drink", "soda", "Soda", icon="soda")}
          </div>
        </fieldset>
        <div class="field">
          <label>4. Quantité</label>
          <div class="qty"><button type="button" data-step="-1" aria-label="Retirer une box">−</button><output data-qty aria-live="polite">1</output><button type="button" data-step="1" aria-label="Ajouter une box">+</button></div>
        </div>
        <div class="order__add">
          <p class="order__unit">Sous-total&nbsp;: <strong data-unit>8,50 €</strong></p>
          <button class="btn magnetic" type="button" data-add>Ajouter au panier {ARROW}</button>
        </div>
      </form>
      <aside class="order__summary on-dark" aria-label="Récapitulatif de commande" data-reveal>
        <h3>Votre commande</h3>
        <div class="cart" data-cart aria-live="polite"></div>
        <div class="cart__total"><span>Total</span><strong data-total>0,00 €</strong></div>
        <div class="form-grid">
          <label class="input">Prénom<input id="order-name" type="text" autocomplete="given-name" placeholder="Votre prénom"></label>
          <label class="input">Heure de retrait<input id="order-time" type="time" min="08:30" max="13:00" step="300"></label>
          <label class="input input--full">Précision<input id="order-note" type="text" placeholder="Allergie, demande particulière…"></label>
        </div>
        <div class="order__actions">
          <a class="btn btn--light" data-send href="sms:{PHONE_TEL}">{ico("sms")} Envoyer par SMS</a>
          <button class="btn btn--ghost-light" type="button" data-copy>{ico("copy")} Copier le récapitulatif</button>
          <a class="btn btn--ghost-light" href="tel:{PHONE_TEL}">{ico("phone")} Appeler la boutique</a>
        </div>
        <p class="order__fine">« Envoyer par SMS » ouvre l’application de messagerie de votre téléphone avec la commande pré-remplie, à destination du {PHONE_TXT}. Sur ordinateur, copiez le récapitulatif ou appelez-nous.</p>
      </aside>
    </div>
  </div>
</section>'''

SOON = f'''<section class="section bg-creme-2" style="padding-top:0">
  <div class="container">
    <div class="soon bg-canard on-dark" data-reveal>
      <div style="display:grid;gap:16px;max-width:620px">
        <span class="eyebrow eyebrow--light">Bientôt</span>
        <h2>Les box arrivent <em>le soir</em></h2>
        <p class="lead">Nos box repas seront bientôt disponibles le soir. Suivez-nous sur Instagram pour être les premiers informés.</p>
        <div class="btn-row"><a class="btn btn--light magnetic" href="{INSTA}" target="_blank" rel="noopener">{ico("instagram")} @maisonpastier</a></div>
      </div>
      <span class="moon" data-draw-icon>{ico("moon")}</span>
    </div>
  </div>
</section>'''

MAIN = "\n".join([HERO, HOW, DUO, tarifs(), ORDER, SOON])

build("repas.html",
      "Repas à emporter & tarifs des box · Maison Pastier Six-Fours",
      "Box repas du midi à emporter à Six-Fours-les-Plages : pâtes fraîches ou gnocchis 8,50 €, raviolis 9,50 €, en menu avec boisson à partir de 9,50 €. Commandez par téléphone ou par SMS.",
      "repas", MAIN)
