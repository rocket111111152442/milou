# -*- coding: utf-8 -*-
from common import *
from blocks import *

LOGO_INLINE = open(os.path.join(HERE, "logo-inline.svg"), encoding="utf-8").read()

INTRO = f'''<div class="intro" id="intro" aria-hidden="true">
  <div class="intro__layer intro__layer--wood wood"></div>
  <div class="intro__layer intro__layer--main">
    <div class="intro__center">
      <div class="intro__logo">{LOGO_INLINE}</div>
      <p class="intro__tag"><span>Fabrique artisanale de pâtes fraîches</span></p>
    </div>
    <div class="intro__meta">
      <span>Six-Fours-les-Plages<br>Var · France</span>
      <span class="intro__count"><span data-intro-count>00</span></span>
    </div>
    <button class="intro__skip" type="button">Passer l’intro</button>
    <span class="intro__bar"></span>
  </div>
</div>'''

SPIN_TEXT = "Fait maison • Chaque jour • Six-Fours • "

HERO = f'''<section class="hero bg-canard on-dark">
  <div class="hero__floaters" aria-hidden="true">{HERO_FLOATERS}</div>
  <div class="container hero__grid">
    <div class="hero__copy">
      <span class="eyebrow eyebrow--light" data-hero-fade>Fabrique artisanale · Six-Fours-les-Plages</span>
      <h1 class="hero__title"><span class="line"><span>Pâtes fraîches,</span></span><span class="line"><span><em>façonnées</em></span></span><span class="line"><span>chaque jour.</span></span></h1>
      <p class="lead hero__lead" data-hero-fade>Raviolis, tagliatelles, gnocchis et sauces maison préparés sur place, une sélection de produits du terroir français et des box repas à emporter.</p>
      <div class="btn-row hero__ctas" data-hero-fade>
        <a class="btn btn--light magnetic" href="produits.html">Découvrir nos produits {ARROW}</a>
        <a class="btn btn--ghost-light magnetic" href="repas.html#commande">Composer ma box</a>
      </div>
      <a class="hero__rating" href="{MAPS_URL}" target="_blank" rel="noopener" data-hero-fade>{stars()}<strong>5,0</strong><span>31 avis Google</span></a>
    </div>
    <div class="hero__visual">
      <div class="arch"><img src="assets/img/mp-preparation.webp" alt="Pâtes fraîches sortant de la machine chez Maison Pastier" width="900" height="1350" fetchpriority="high"></div>
      <div class="hero__bubble"><img src="assets/img/mp-raviolis.webp" alt="Raviolis maison" width="400" height="494"></div>
      <div class="spin-badge" aria-hidden="true">
        <svg class="spin-text" viewBox="0 0 120 120"><defs><path id="spin-path" d="M60 60m-46 0a46 46 0 1 1 92 0a46 46 0 1 1-92 0"/></defs><text><textPath href="#spin-path">{SPIN_TEXT}{SPIN_TEXT}</textPath></text></svg>
        {ico("ravioli")}
      </div>
    </div>
  </div>
  <div class="hero__scroll" aria-hidden="true"><span>Défiler</span><i></i></div>
</section>'''

ABOUT = f'''<section class="section bg-creme" id="maison">
  <div class="container">
    <div class="about__grid">
      <div class="about__copy">
        <span class="eyebrow" data-reveal>La Maison</span>
        <p class="manifest" data-highlight>Maison Pastier est votre adresse gourmande à Six-Fours-les-Plages. Une enseigne <em>conviviale et créative</em> : pâtes artisanales fraîches, produits locaux de qualité et box repas savoureuses, dans un univers <em>authentique et généreux</em>.</p>
        <p class="lead" data-reveal>Que ce soit pour un repas, une pause gourmande ou vos courses du quotidien, on vous accueille au 54 rue République, en plein centre de Six-Fours.</p>
        <div class="btn-row" data-reveal>
          <a class="btn magnetic" href="savoir-faire.html">Notre savoir-faire {ARROW}</a>
          <a class="link-arrow" href="#visite" style="align-self:center">Horaires &amp; accès {ARROW}</a>
        </div>
      </div>
      <div class="about__media">
        <figure class="m1" data-reveal-img data-cursor="Fait main"><img src="assets/img/mp-raviolis-plateaux.webp" alt="Plateaux de raviolis frais faits maison" width="800" height="1200" loading="lazy"></figure>
        <figure class="m2" data-speed="0.12" data-reveal-img><img src="assets/img/mp-pates-sauce.webp" alt="Box de pâtes fraîches, sauce maison et parmesan" width="700" height="1050" loading="lazy"></figure>
        <img class="stamp" src="assets/img/logo-blanc.svg" alt="" width="130" height="130" data-speed="-0.25" loading="lazy">
      </div>
    </div>
    <div class="stats">
      <div class="stat" data-reveal><span class="stat__num"><span data-count="5">5</span></span><p>recettes de raviolis toujours disponibles</p></div>
      <div class="stat" data-reveal><span class="stat__num"><span data-count="2">2</span><small>sem.</small></span><p>un nouveau ravioli du terroir toutes les deux semaines</p></div>
      <div class="stat" data-reveal><span class="stat__num"><span data-count="6">6</span><small>j/7</small></span><p>ouvert du mardi au dimanche matin</p></div>
      <div class="stat" data-reveal><span class="stat__num"><span data-count="5" data-decimals="1">5,0</span><small>/5</small></span><p>sur Google, d’après 31 avis clients</p></div>
    </div>
  </div>
</section>'''


def ucard(n, href, img, alt, title, text, tags, w=900, h=1200):
    t = "".join(f'<span class="tag tag--light">{x}</span>' for x in tags)
    return f'''<a class="u-card" href="{href}" data-reveal data-cursor="Découvrir">
  <span class="u-card__img"><img src="assets/img/{img}" alt="{alt}" width="{w}" height="{h}" loading="lazy"></span>
  <span class="u-card__num">0{n}</span>
  <span class="u-card__go">{ARROW}</span>
  <h3>{title}</h3>
  <p>{text}</p>
  {f'<span class="u-card__tags">{t}</span>' if tags else ""}
</a>'''


UNIVERS = f'''<section class="section bg-creme-2" id="univers">
  <div class="container">
    <div class="section-head section-head--split">
      <div style="display:grid;gap:22px">
        <span class="eyebrow">Nos univers</span>
        <h2 data-split>Tout ce qui fait <em>une belle assiette</em></h2>
      </div>
      <p class="lead" data-reveal>Pâtes artisanales, terrines, tartinades, condiments, douceurs sucrées et spécialités locales : chaque produit est issu du terroir français et choisi avec soin pour apporter du goût et de la fraîcheur à vos repas.</p>
    </div>
    <div class="univers">
      {ucard(1, "produits.html#pates", "un-nids.webp", "Nids de tagliatelles fraîches", "Pâtes fraîches", "Tagliatelles, rigatoni, fusilli : façonnées chaque jour sur place, pour garder tout le goût du fait maison.", ["Tagliatelles", "Rigatoni", "Fusilli"])}
      {ucard(2, "produits.html#raviolis", "mp-raviolis.webp", "Raviolis frais", "Raviolis maison", "Une base toujours disponible et un ravioli du terroir renouvelé toutes les deux semaines.", ["Daube", "Figatelli", "Truffe"], 400, 494)}
      {ucard(3, "produits.html#gnocchis", "mp-gnocchis-box.webp", "Gnocchis maison et parmesan", "Gnocchis", "Légers et moelleux, réalisés à partir de recettes traditionnelles.", [])}
      {ucard(4, "produits.html#sauces", "mp-sauces.webp", "Sauces maison sur le comptoir en bois", "Sauces maison", "En pot, prévues pour deux portions : daube, gorgonzola, cèpe, truffe…", [])}
      {ucard(5, "produits.html#epicerie", "mp-epicerie.webp", "Étagères de l’épicerie fine", "Épicerie fine", "Rillettes du Sud-Ouest, tartinades, moutardes parfumées, douceurs sucrées…", [], 600, 300)}
      {ucard(6, "produits.html#cave", "mp-cave-vins.webp", "La cave à vins de Maison Pastier", "Cave à vins", "Rouges puissants, blancs fruités, rosés élégants : des vignobles français choisis avec soin.", [])}
    </div>
  </div>
</section>'''

STRAND = "M0 90 C 120 20, 240 160, 360 90 S 560 10, 700 70 C 780 110, 760 160, 700 150 C 640 140, 660 60, 760 50 S 960 140, 1100 90 S 1340 20, 1480 90 S 1720 160, 1860 90 C 1940 50, 1960 10, 1900 20 C 1840 30, 1880 120, 1980 120 S 2240 40, 2400 90"


def step(n, icon, img, alt, title, text):
    return f'''<article class="step">
  <span class="step__num" aria-hidden="true">0{n}</span>
  <figure class="step__img"><img src="assets/img/{img}" alt="{alt}" width="800" height="1000" loading="lazy"></figure>
  <h3>{ico(icon)}{title}</h3>
  <p>{text}</p>
</article>'''


PROCESS = f'''<section class="process bg-canard on-dark" data-process id="geste">
  <div class="process__pin">
    <div class="container process__head">
      <div style="display:grid;gap:22px">
        <span class="eyebrow">Le métier</span>
        <h2 data-split>De la farine <em>à la vitrine</em></h2>
      </div>
      <div class="process__progress" aria-hidden="true">
        <span><b>Étape <span data-process-count>01</span></b><b>05</b></span>
        <div class="process__bar"><i></i></div>
      </div>
    </div>
    <div class="process__viewport">
      <div class="process__track" data-process-track>
        <svg class="process__strand" viewBox="0 0 2400 180" preserveAspectRatio="none" aria-hidden="true"><path d="{STRAND}" vector-effect="non-scaling-stroke"/></svg>
        {step(1, "egg", "un-farine-oeufs.webp", "Fontaine de farine et jaunes d’œufs", "Les ingrédients", "Farine et œufs : peu d’ingrédients, choisis avec soin. Ce sont eux qui font tout le goût de la pâte.")}
        {step(2, "dough", "un-petrissage.webp", "Mains pétrissant la pâte sur un plan de travail en bois", "Le pétrissage", "La pâte est travaillée jusqu’à devenir lisse et souple, puis on la laisse reposer pour qu’elle se détende.")}
        {step(3, "rolling", "un-laminage.webp", "Pâte passée au laminoir", "Le laminage", "Passée et repassée au laminoir, elle s’affine cran après cran jusqu’à l’épaisseur voulue.")}
        {step(4, "cutter", "un-decoupe.webp", "Découpe de tagliatelles fraîches à la main", "Le façonnage", "Rubans découpés, formes extrudées, raviolis farcis puis soudés : chaque forme a son outil et son geste.")}
        {step(5, "nest", "un-tagliatelles.webp", "Tagliatelles fraîches prêtes à être vendues", "La vitrine", "Les pâtes rejoignent la boutique le jour même. Chez vous, quelques minutes de cuisson suffisent.")}
        <article class="step step--end">
          <h3>Envie d’en savoir <em>plus</em>&nbsp;?</h3>
          <p>Les formes, les temps de cuisson, la conservation : tous nos conseils pour réussir vos pâtes fraîches.</p>
          <a class="btn btn--light magnetic" href="savoir-faire.html">Le savoir-faire {ARROW}</a>
        </article>
      </div>
    </div>
  </div>
</section>'''

RAVIOLIS = [
    ("Daube de joue de bœuf provençale", "La grande tradition provençale : une daube longuement mijotée, enfermée dans une pâte fine.", "Idée d’accord : jus de la daube", "2"),
    ("Mortadelle, brousse &amp; pistache", "Le parfum de la mortadelle, le moelleux de la brousse et le croquant de la pistache.", "Toujours disponible", "0"),
    ("Figatelli", "La saucisse de foie corse, pour un ravioli au caractère bien affirmé.", "Toujours disponible", "0"),
    ("Épinard &amp; brousse", "Un grand classique, tout en douceur et en fraîcheur.", "Toujours disponible", "0"),
    ("Jambon, truffe &amp; ricotta", "L’élégance de la truffe, la douceur de la ricotta et le goût du jambon.", "Toujours disponible", "1"),
]


def carte():
    items = ""
    for i, (name, text, tag, img) in enumerate(RAVIOLIS):
        items += f'''<li class="carte__item{" is-open" if i == 0 else ""}" data-img="{img}">
  <button class="carte__btn" type="button" aria-expanded="{"true" if i == 0 else "false"}"><span class="n">0{i + 1}</span><span class="name">{name}</span><span class="plus" aria-hidden="true"></span></button>
  <div class="carte__detail"><div><p>{text}<br><span class="tag tag--wood">{tag}</span></p></div></div>
</li>'''
    items += f'''<li class="carte__item carte__item--special" data-img="2">
  <button class="carte__btn" type="button" aria-expanded="false"><span class="n">★</span><span class="name">Le ravioli <em>du terroir</em></span><span class="plus" aria-hidden="true"></span></button>
  <div class="carte__detail"><div><p>Inspiré d’un plat français et renouvelé toutes les deux semaines pour varier les saveurs. Demandez celui du moment en boutique&nbsp;!<br><span class="tag">Renouvelé toutes les 2 semaines</span></p></div></div>
</li>'''
    return f'''<section class="section bg-creme" id="raviolis" data-carte>
  <div class="container carte__grid">
    <div class="carte__media" data-reveal>
      <div class="carte__frame">
        <img data-carte-img="0" class="is-active" src="assets/img/mp-raviolis.webp" alt="Raviolis frais maison" width="400" height="494" loading="lazy">
        <img data-carte-img="1" src="assets/img/mp-ravioli-jambon.webp" alt="Raviolis au jambon et à la truffe" width="375" height="434" loading="lazy">
        <img data-carte-img="2" src="assets/img/mp-raviolis-plateaux.webp" alt="Plateaux de raviolis faits maison" width="800" height="1200" loading="lazy">
        <div class="carte__caption">{ico("ravioli")}<span data-carte-caption>Daube de joue de bœuf provençale</span></div>
      </div>
    </div>
    <div class="carte__list">
      <span class="eyebrow">La carte des raviolis</span>
      <h2 data-split>Nos raviolis <em>maison</em></h2>
      <p class="lead" data-reveal>Une base incontournable, toujours disponible, et un ravioli du terroir inspiré d’un plat français, renouvelé toutes les deux semaines.</p>
      <ol class="carte__items" data-reveal>{items}</ol>
    </div>
  </div>
</section>'''


SAUCES_SECTION = f'''<section class="section bg-creme" id="sauces">
  <div class="container sauces__grid">
    <div class="sauces__photo">
      <div class="frame" data-reveal-img data-inner-parallax><img src="assets/img/mp-sauces.webp" alt="Sauces maison présentées sur le comptoir, avec leurs ardoises" width="800" height="1200" loading="lazy"></div>
      <p class="note-card" data-speed="0.15">En pot, pour deux portions de pâtes<small>Préparées artisanalement à partir d’ingrédients frais.</small></p>
    </div>
    <div>
      <span class="eyebrow">Sauces maison</span>
      <h2 data-split style="margin-top:22px">La touche <em>qui change tout</em></h2>
      <p class="lead" data-reveal style="margin-top:24px">Apportez encore plus de saveurs à vos repas avec nos sauces maison, préparées artisanalement à partir d’ingrédients frais et de qualité.</p>
      {jars()}
      <p style="margin-top:34px" data-reveal><a class="link-arrow" href="produits.html#sauces">Toutes nos sauces {ARROW}</a></p>
    </div>
  </div>
</section>'''


def wine(color, title, text):
    return f'<div class="wine" data-reveal><span class="wine__dot" style="--wine:{color}">{ico("glass")}</span><div><strong>{title}</strong><span>{text}</span></div></div>'


CAVE = f'''<section class="section cave bg-canard on-dark" id="cave">
  <div class="container cave__grid">
    <div class="cave__img" data-reveal-img data-inner-parallax data-cursor="Santé&nbsp;!"><img src="assets/img/mp-cave-vins.webp" alt="La cave à vins de Maison Pastier, meuble bleu canard" width="900" height="1200" loading="lazy"></div>
    <div>
      <span class="eyebrow">Cave à vins</span>
      <h2 data-split style="margin-top:22px">Des vins français <em>à marier</em> avec nos pâtes</h2>
      <p class="lead" data-reveal style="margin-top:24px">Une sélection de vins issus de vignobles reconnus et de domaines familiaux. Chaque bouteille reflète la richesse et la diversité du terroir.</p>
      <div class="wines">
        {wine("#6d1f2a", "Rouges puissants", "Pour les raviolis à la daube et les sauces généreuses.")}
        {wine("#cdb46a", "Blancs fruités", "Avec les sauces crémeuses : gorgonzola, cèpe, truffe.")}
        {wine("#df9a95", "Rosés élégants", "Pour les beaux jours et les assiettes du Sud.")}
      </div>
    </div>
  </div>
</section>'''

REVIEWS = f'''<section class="section bg-creme" style="padding-top:0">
  <div class="container">
    <div class="reviews" data-reveal>
      <div class="reviews__score">
        <span class="reviews__num"><span data-count="5" data-decimals="1">5,0</span></span>
        <span class="reviews__stars" aria-label="Note de 5 sur 5">{"".join('<svg viewBox="0 0 24 24" aria-hidden="true"><path class="s-bg" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/><path class="s-fg" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/></svg>' for _ in range(5))}</span>
        <span class="reviews__count">31 avis sur Google</span>
      </div>
      <div class="reviews__copy">
        <span class="eyebrow">Vos avis</span>
        <h2 data-split>Noté <em>5,0 sur 5</em> par nos clients</h2>
        <p class="lead">Merci à toutes celles et ceux qui ont pris le temps de partager leur expérience. Vous êtes passés à la boutique&nbsp;? Votre avis nous aide énormément.</p>
        <div class="btn-row">
          <a class="btn magnetic" href="{MAPS_URL}" target="_blank" rel="noopener">Lire les avis {ARROW}</a>
          <a class="btn btn--ghost magnetic" href="{MAPS_URL}" target="_blank" rel="noopener">Laisser un avis</a>
        </div>
      </div>
    </div>
  </div>
</section>'''

GALLERY_IMGS = [("mp-raviolis.webp", "Raviolis frais"), ("mp-salade-pesto.webp", "Salade de pâtes au pesto et burrata"),
                ("mp-gnocchis.webp", "Gnocchis maison"), ("mp-cave-vins-large.webp", "La cave à vins"),
                ("mp-epicerie.webp", "L’épicerie fine"), ("mp-ravioli-jambon.webp", "Raviolis et jambon")]
GALLERY = f'''<section class="section bg-creme" style="padding-top:0">
  <div class="container">
    <div class="section-head section-head--center">
      <span class="eyebrow">@maisonpastier</span>
      <h2 data-split>Suivez <em>la fabrique</em></h2>
      <p class="lead" data-reveal>Nouveautés, ravioli du terroir du moment, coulisses de la fabrication : rendez-vous sur Instagram.</p>
    </div>
    <div class="gallery">{"".join(f'<a href="{INSTA}" target="_blank" rel="noopener" data-reveal aria-label="{alt}, voir sur Instagram"><img src="assets/img/{img}" alt="{alt}" width="400" height="400" loading="lazy"></a>' for img, alt in GALLERY_IMGS)}</div>
  </div>
</section>'''

MAIN = "\n".join([
    HERO,
    marquee(MARQUEE_MAIN),
    ABOUT,
    UNIVERS,
    PROCESS,
    carte(),
    tarifs(),
    SAUCES_SECTION,
    CAVE,
    marquee([("sun", "Six-Fours-les-Plages"), ("ravioli", "Fait maison"), ("calendar", "Chaque jour"), ("leaf", "Produits du terroir")], cls="bg-creme-2 marquee--canard-text", reverse=True),
    REVIEWS,
    GALLERY,
    visit(),
])

build("index.html",
      "Maison Pastier · Pâtes fraîches artisanales à Six-Fours-les-Plages",
      "Fabrique artisanale de pâtes fraîches à Six-Fours-les-Plages : raviolis, tagliatelles, gnocchis, sauces maison, épicerie fine, cave à vins et box repas à emporter.",
      "index", MAIN, intro=INTRO, with_ld=True)
