# -*- coding: utf-8 -*-
from common import *
from blocks import *

HERO = page_hero(
    "Produits",
    ["Nos", "<em>produits</em>"],
    "Pâtes artisanales, sauces maison et cave à vins : chaque produit est sélectionné ou préparé avec passion. Savourez des recettes inspirées de la tradition&nbsp;!",
    "mp-pates-sauce.webp", "Box de pâtes fraîches, sauce maison et parmesan",
    ctas=f'<a class="btn btn--light magnetic" href="#pates">Explorer {ARROW}</a><a class="btn btn--ghost-light magnetic" href="tel:{PHONE_TEL}">{ico("phone")} {PHONE_TXT}</a>',
    floaters="".join([floater("ravioli", "6%", "22%", 64, 0.05, -14), floater("jar", "44%", "12%", 52, 0.08, 10), floater("bottle", "40%", "80%", 60, 0.06, -8), floater("farfalle", "92%", "70%", 58, 0.07, 26)]),
)

SUBNAV = f'''<nav class="subnav" aria-label="Rubriques produits" data-subnav>
  <div class="container">
    <a href="#pates">{ico("nest")}Pâtes</a>
    <a href="#raviolis">{ico("ravioli")}Raviolis</a>
    <a href="#gnocchis">{ico("gnocchi")}Gnocchis</a>
    <a href="#sauces">{ico("jar")}Sauces</a>
    <a href="#epicerie">{ico("basket")}Épicerie</a>
    <a href="#cave">{ico("glass")}Cave à vins</a>
  </div>
</nav>'''


def feature(fid, n, label, icon, title, text, img, alt, extra="", mini=None, rev=False, frame=""):
    mini_html = ""
    if mini:
        mini_html = f'<div class="feature__mini" data-speed="0.18"><img src="assets/img/{mini[0]}" alt="{mini[1]}" width="400" height="400" loading="lazy"></div>'
    return f'''<div class="feature{" feature--rev" if rev else ""}" id="{fid}">
  <div class="feature__media">
    <div class="feature__frame {frame}" data-reveal-img data-inner-parallax><img src="assets/img/{img}" alt="{alt}" width="900" height="1100" loading="lazy"></div>
    {mini_html}
  </div>
  <div class="feature__copy">
    <span class="feature__icon" data-reveal>{ico(icon)}</span>
    <span class="eyebrow">{n} — {label}</span>
    <h2 data-split>{title}</h2>
    <p class="lead" data-reveal>{text}</p>
    {extra}
  </div>
</div>'''


def chips(items):
    return '<div class="chips" data-reveal>' + "".join(f'<span class="chip">{ico(i)}{t}</span>' for i, t in items) + "</div>"


FLAVORS = [
    ("Daube de joue de bœuf provençale", "Toujours disponible"),
    ("Mortadelle, brousse &amp; pistache", "Toujours disponible"),
    ("Figatelli", "Toujours disponible"),
    ("Épinard &amp; brousse", "Toujours disponible"),
    ("Jambon, truffe &amp; ricotta", "Toujours disponible"),
]
flavors_html = '<div class="flavors" data-reveal>' + "".join(
    f'<div class="flavor">{ico("ravioli")}<strong>{n}</strong><span>{t}</span></div>' for n, t in FLAVORS) + \
    f'<div class="flavor flavor--special">{ico("calendar")}<strong>Le ravioli du terroir</strong><span>Toutes les 2 semaines</span></div></div>'

PRODUCTS = f'''<section class="section bg-creme">
  <div class="container">
    {feature("pates", "01", "Pâtes fraîches", "nest", "Pâtes artisanales <em>fraîches</em>",
             "Nos pâtes fraîches sont façonnées chaque jour sur place. Nos tagliatelles, rigatoni et fusilli accompagnent parfaitement nos sauces maison ou vos créations culinaires.",
             "mp-preparation.webp", "Pâtes fraîches sortant de la machine",
             extra=chips([("nest", "Tagliatelles"), ("rigatoni", "Rigatoni"), ("fusilli", "Fusilli")]) + f'<p data-reveal><a class="link-arrow" href="savoir-faire.html#minuteur">Temps de cuisson {ARROW}</a></p>',
             mini=("mp-salade-pesto.webp", "Salade de pâtes au pesto"))}
    {feature("raviolis", "02", "Raviolis", "ravioli", "Les raviolis <em>maison</em>",
             "Notre gamme de raviolis artisanaux propose une base incontournable, toujours disponible, à laquelle s’ajoutent des raviolis du terroir, inspirés d’un plat français et renouvelés toutes les deux semaines pour varier les saveurs.",
             "mp-raviolis-plateaux.webp", "Plateaux de raviolis faits maison", extra=flavors_html,
             mini=("mp-ravioli-jambon.webp", "Raviolis jambon et truffe"), rev=True)}
    {feature("gnocchis", "03", "Gnocchis", "gnocchi", "Les gnocchis <em>savoureux</em>",
             "Nos gnocchis, légers et savoureux, sont réalisés à partir de recettes traditionnelles. Leur texture moelleuse et leur goût délicat en font l’allié idéal d’un repas convivial et réconfortant.",
             "mp-gnocchis-box.webp", "Gnocchis maison et parmesan",
             extra=chips([("cheese", "Avec un généreux parmesan"), ("jar", "Sauce gorgonzola, cèpe ou truffe")]),
             mini=("mp-gnocchis.webp", "Gnocchis maison"))}
    {feature("sauces", "04", "Sauces maison", "jar", "Des sauces <em>en pot</em>",
             "Découvrez nos sauces maison en pot, prévues pour deux portions de pâtes. Des recettes gourmandes et raffinées, prêtes à sublimer vos plats.",
             "mp-sauces.webp", "Sauces maison avec leurs ardoises", extra=jars(), rev=True)}
    {feature("epicerie", "05", "Épicerie fine", "basket", "Des produits <em>d’exception</em>",
             "Nous sélectionnons des produits d’exception issus de producteurs français. Une gamme authentique qui reflète le meilleur du savoir-faire artisanal français.",
             "mp-epicerie.webp", "Étagères de l’épicerie fine de Maison Pastier",
             extra=chips([("jar", "Rillettes du Sud-Ouest"), ("leaf", "Tartinades"), ("jar", "Moutardes noix &amp; cèpes"), ("basket", "Terrines"), ("leaf", "Condiments"), ("sun", "Douceurs sucrées"), ("pin", "Spécialités locales")]),
             frame="feature__frame--wide")}
  </div>
</section>'''


def pairing(color, small, title, text):
    return f'<article class="pairing" data-reveal><span class="wine__dot" style="--wine:{color}">{ico("glass")}</span><small>{small}</small><h3>{title}</h3><p>{text}</p></article>'


CAVE = f'''<section class="section bg-canard on-dark" id="cave">
  <div class="container">
    <div class="cave__grid" style="margin-bottom:clamp(60px,8vw,110px)">
      <div class="cave__img" data-reveal-img data-inner-parallax><img src="assets/img/mp-cave-vins.webp" alt="La cave à vins de Maison Pastier" width="900" height="1200" loading="lazy"></div>
      <div>
        <span class="eyebrow">06 — Cave à vins</span>
        <h2 data-split style="margin-top:22px">Une cave <em>100&nbsp;% française</em></h2>
        <p class="lead" data-reveal style="margin-top:24px">Notre cave à vins met en avant des vignobles français soigneusement choisis, de domaines reconnus et familiaux. Blancs fruités, rouges puissants ou rosés délicats : chaque bouteille s’accorde avec nos pâtes, nos raviolis ou nos spécialités.</p>
        <p data-reveal style="margin-top:30px"><a class="btn btn--light magnetic" href="tel:{PHONE_TEL}">Un conseil&nbsp;? Appelez-nous {ARROW}</a></p>
      </div>
    </div>
    <div class="section-head">
      <span class="eyebrow">Idées d’accords</span>
      <h2 data-split>Quel vin <em>pour quelles pâtes</em>&nbsp;?</h2>
    </div>
    <div class="pairings">
      {pairing("#6d1f2a", "Rouges puissants", "Raviolis à la daube", "Un rouge structuré répond à la richesse de la daube et du jus de cuisson.")}
      {pairing("#cdb46a", "Blancs fruités", "Sauces crémeuses", "Gorgonzola, cèpe ou truffe : un blanc fruité apporte fraîcheur et rondeur.")}
      {pairing("#df9a95", "Rosés élégants", "Assiettes du Sud", "Poivronnade à l’ail confit, salades de pâtes : le rosé, évidemment.")}
    </div>
  </div>
</section>'''

NOTICE = f'''<section class="section bg-creme" style="padding-block:60px">
  <div class="container">
    <p class="notice" data-reveal>{ico("info")}<span>Les prix de nos produits sont affichés en boutique. Pour connaître le ravioli du terroir du moment ou les disponibilités du jour, appelez-nous au <a href="tel:{PHONE_TEL}"><strong>{PHONE_TXT}</strong></a>.</span></p>
  </div>
</section>'''

MAIN = "\n".join([HERO, SUBNAV, PRODUCTS, CAVE, NOTICE, visit()])

build("produits.html",
      "Nos produits · Pâtes fraîches, raviolis, sauces & vins · Maison Pastier",
      "Pâtes fraîches artisanales, raviolis maison, gnocchis, sauces maison en pot, épicerie fine et cave à vins française chez Maison Pastier à Six-Fours-les-Plages.",
      "produits", MAIN)
