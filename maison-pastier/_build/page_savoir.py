# -*- coding: utf-8 -*-
from common import *
from blocks import *

HERO = page_hero(
    "Savoir-faire",
    ["L’art des", "<em>pâtes fraîches</em>"],
    "Fabriquer des pâtes fraîches, c’est un métier de gestes simples et de patience. Chez Maison Pastier, elles sont préparées chaque jour avec des produits de qualité et un savoir-faire traditionnel.",
    "un-boule-pate.webp", "Boule de pâte fraîche farinée",
    ctas=f'<a class="btn btn--light magnetic" href="#etapes">Les étapes {ARROW}</a><a class="btn btn--ghost-light magnetic" href="#minuteur">Minuteur de cuisson</a>',
    floaters="".join([floater("wheat", "6%", "20%", 70, 0.05, -12), floater("egg", "46%", "14%", 50, 0.08, 18), floater("rolling", "40%", "80%", 64, 0.06, 0), floater("fusilli", "90%", "72%", 56, 0.07, 30)]),
)


def why(icon, title, text):
    return f'<article class="tip" data-reveal><span class="feature__icon">{ico(icon)}</span><h3>{title}</h3><p>{text}</p></article>'


WHY = f'''<section class="section bg-creme">
  <div class="container">
    <div class="section-head section-head--split">
      <div style="display:grid;gap:22px">
        <span class="eyebrow">Le métier</span>
        <h2 data-split>Pourquoi le <em>frais</em> change tout</h2>
      </div>
      <p class="lead" data-reveal>Contrairement aux pâtes sèches, les pâtes fraîches ne sont pas déshydratées : elles gardent une texture tendre et une surface légèrement rugueuse qui accroche la sauce. Et elles cuisent en quelques minutes.</p>
    </div>
    <div class="tips">
      {why("calendar", "Fabriquées chaque jour", "Nos pâtes sont façonnées chaque jour sur place, dans la boutique de la rue République.")}
      {why("clock", "Cuisson express", "Quelques minutes dans l’eau bouillante suffisent : idéal pour un repas rapide mais soigné.")}
      {why("leaf", "Du goût, simplement", "Des ingrédients de qualité, des sauces maison et des produits du terroir français pour les accompagner.")}
    </div>
  </div>
</section>'''


def tl(n, icon, img, alt, title, text, items=()):
    lis = "".join(f"<li>{x}</li>" for x in items)
    return f'''<article class="tl-step">
  <span class="tl-step__dot">{ico(icon)}</span>
  <figure class="tl-step__media" data-reveal-img><img src="assets/img/{img}" alt="{alt}" width="900" height="720" loading="lazy"></figure>
  <div class="tl-step__copy" data-reveal>
    <span class="tl-step__num" aria-hidden="true">0{n}</span>
    <h3>{title}</h3>
    <p>{text}</p>
    {f"<ul>{lis}</ul>" if lis else ""}
  </div>
</article>'''


TIMELINE = f'''<section class="section bg-creme" id="etapes" style="padding-top:0">
  <div class="container">
    <div class="section-head section-head--center">
      <span class="eyebrow">Étape par étape</span>
      <h2 data-split>Le geste <em>artisan</em></h2>
      <p class="lead" data-reveal>Six étapes, de la farine à votre assiette. Le métier de fabricant de pâtes fraîches, expliqué simplement.</p>
    </div>
    <div class="timeline">
      <span class="timeline__line" aria-hidden="true"><i></i></span>
      {tl(1, "egg", "un-farine-oeufs.webp", "Fontaine de farine et jaunes d’œufs", "Choisir les ingrédients", "Tout commence avec très peu de choses : de la farine et des œufs. Comme il y a peu d’ingrédients, chacun compte.", ["Farine de blé de qualité", "Œufs frais", "Pour les raviolis : des farces cuisinées"])}
      {tl(2, "dough", "un-petrissage.webp", "Mains pétrissant la pâte", "Pétrir &amp; laisser reposer", "On mélange puis on pétrit jusqu’à obtenir une pâte lisse et élastique. Le repos détend la pâte : elle sera plus facile à étaler et plus tendre à la cuisson.")}
      {tl(3, "rolling", "un-laminage.webp", "Pâte passée au laminoir", "Laminer", "La pâte passe au laminoir, cran après cran, jusqu’à la finesse voulue : très fine pour les raviolis, un peu plus épaisse pour les tagliatelles.")}
      {tl(4, "cutter", "mp-preparation.webp", "Pâtes fraîches sortant de la machine chez Maison Pastier", "Façonner", "Découpe des rubans, extrusion des formes courtes comme les rigatoni ou les fusilli : chaque forme demande son outil et son geste.")}
      {tl(5, "ravioli", "mp-raviolis-plateaux.webp", "Plateaux de raviolis faits maison", "Farcir &amp; souder", "Pour les raviolis, la farce est déposée sur une feuille de pâte, recouverte d’une seconde, puis chaque pièce est découpée et soudée pour bien garder le cœur.")}
      {tl(6, "nest", "un-nids.webp", "Nids de tagliatelles fraîches", "Fraîches du jour", "Les pâtes rejoignent la vitrine le jour même. À vous de jouer : quelques minutes dans l’eau bouillante, et c’est prêt.")}
    </div>
  </div>
</section>'''


def shape(icon, title, text, ideal):
    return f'''<article class="shape" data-reveal>
  <span class="shape__icon" data-draw-icon>{ico(icon)}</span>
  <h3>{title}</h3>
  <p>{text}</p>
  <dl><dt>Idéal avec</dt><dd>{ideal}</dd></dl>
</article>'''


SHAPES = f'''<section class="section bg-canard on-dark" id="formes">
  <div class="container">
    <div class="section-head section-head--split">
      <div style="display:grid;gap:22px">
        <span class="eyebrow">Petit lexique</span>
        <h2 data-split>À chaque forme <em>sa sauce</em></h2>
      </div>
      <p class="lead" data-reveal>Une forme n’est jamais choisie au hasard : rubans, spirales ou tubes ne retiennent pas la sauce de la même façon. Voici les nôtres.</p>
    </div>
    <div class="shapes">
      {shape("nest", "Tagliatelles", "Longs rubans plats, originaires d’Émilie-Romagne.", "Sauces crémeuses, cèpe, truffe")}
      {shape("fusilli", "Fusilli", "Des spirales dont le nom vient de « fuso », le fuseau autour duquel on les enroulait.", "Pesto, poivronnade, sauces épaisses")}
      {shape("rigatoni", "Rigatoni", "Gros tubes striés (« rigati ») qui retiennent la sauce dedans comme dehors.", "Sauces généreuses, jus de la daube")}
      {shape("ravioli", "Raviolis", "Des pâtes farcies. En Provence, les raviolis à la daube sont une vraie tradition.", "Jus de la daube, sauce truffe")}
      {shape("gnocchi", "Gnocchis", "Petites quenelles moelleuses, traditionnellement à base de pomme de terre et de farine.", "Gorgonzola, cèpe")}
    </div>
  </div>
</section>'''


def preset(icon, name, seconds, tip=""):
    m, s = divmod(seconds, 60)
    t = f' data-tip="{tip}"' if tip else ""
    return f'<button class="timer__preset" type="button" aria-pressed="false" data-name="{name}" data-seconds="{seconds}"{t}>{ico(icon)}<strong>{name}</strong><span>{m}:{s:02d}</span></button>'


TIMER = f'''<section class="section bg-creme-2" id="minuteur">
  <div class="container">
    <div class="timer" data-timer data-reveal>
      <div>
        <span class="eyebrow">Minuteur de cuisson</span>
        <h2 data-split style="margin-top:20px">Le temps <em>parfait</em></h2>
        <p class="lead" style="margin-top:20px">Plongez vos pâtes dans une grande casserole d’eau bouillante salée, puis lancez le minuteur. Les temps sont indicatifs : goûtez toujours avant d’égoutter, et n’hésitez pas à nous demander conseil en boutique.</p>
        <div class="timer__presets" role="group" aria-label="Type de pâtes">
          {preset("nest", "Tagliatelles", 150)}
          {preset("fusilli", "Fusilli", 210)}
          {preset("rigatoni", "Rigatoni", 240)}
          {preset("ravioli", "Raviolis", 240, "C’est prêt ! Égouttez délicatement les raviolis.")}
          {preset("gnocchi", "Gnocchis", 120, "C’est prêt ! Les gnocchis remontent à la surface : égouttez-les.")}
        </div>
      </div>
      <div class="timer__dial">
        <div class="timer__ring">
          <svg viewBox="0 0 300 300" aria-hidden="true"><circle class="bg" cx="150" cy="150" r="140"/><circle class="fg" cx="150" cy="150" r="140"/></svg>
          <div class="timer__readout" aria-live="polite"><span class="timer__time">2:30</span><span class="timer__label">Tagliatelles</span></div>
        </div>
        <div class="timer__controls">
          <button class="btn magnetic" type="button" data-timer-start>Lancer</button>
          <button class="btn btn--ghost magnetic" type="button" data-timer-reset>Réinitialiser</button>
        </div>
        <p class="timer__msg" role="status"></p>
      </div>
    </div>
  </div>
</section>'''


def tip(icon, title, text):
    return f'<article class="tip" data-reveal><span class="feature__icon">{ico(icon)}</span><h3>{title}</h3><p>{text}</p></article>'


TIPS = f'''<section class="section bg-creme-2" style="padding-top:0" id="conseils">
  <div class="container">
    <div class="section-head">
      <span class="eyebrow">Nos conseils</span>
      <h2 data-split>Réussir ses pâtes <em>fraîches</em></h2>
    </div>
    <div class="tips">
      {tip("pot", "Beaucoup d’eau", "Comptez environ 1 litre d’eau pour 100 g de pâtes, et une dizaine de grammes de sel par litre, ajoutés à l’ébullition.")}
      {tip("bowl", "La bonne quantité", "En plat principal, comptez environ 120 à 150 g de pâtes fraîches par personne.")}
      {tip("jar", "On ne rince pas", "L’amidon aide la sauce à napper. Gardez une louche d’eau de cuisson pour lier la sauce si besoin.")}
      {tip("leaf", "La sauce d’abord", "Faites chauffer la sauce pendant la cuisson. Un pot de sauce maison est prévu pour deux portions de pâtes.")}
      {tip("clock", "Conservation", "Les pâtes fraîches se gardent au réfrigérateur et se dégustent rapidement. Demandez-nous la durée exacte en boutique.")}
      {tip("snow", "Congélation", "Les pâtes fraîches se congèlent bien. Faites-les cuire directement, sans décongélation, en prolongeant un peu la cuisson.")}
    </div>
  </div>
</section>'''


def qa(q, a):
    return f'<details><summary>{q}</summary><div class="faq__a"><p>{a}</p></div></details>'


FAQ = f'''<section class="section bg-creme" id="faq">
  <div class="container" style="max-width:980px">
    <div class="section-head section-head--center">
      <span class="eyebrow">Questions fréquentes</span>
      <h2 data-split>Vos <em>questions</em></h2>
    </div>
    <div class="faq" data-reveal>
      {qa("Les pâtes sont-elles fabriquées sur place ?", "Oui. Nos pâtes fraîches sont façonnées chaque jour sur place, dans notre boutique du 54 rue République à Six-Fours-les-Plages.")}
      {qa("Quels raviolis trouve-t-on en boutique ?", "Une base toujours disponible : daube de joue de bœuf provençale, mortadelle brousse et pistache, figatelli, épinard brousse, jambon truffe et ricotta. S’y ajoute un ravioli du terroir, inspiré d’un plat français, renouvelé toutes les deux semaines.")}
      {qa("Comment commander une box repas ?", f"Par téléphone au <a href=\"tel:{PHONE_TEL}\">{PHONE_TXT}</a>, ou en composant votre box sur notre page <a href=\"repas.html#commande\">Repas &amp; tarifs</a> puis en nous l’envoyant par SMS. Votre commande est validée une fois confirmée par la boutique.")}
      {qa("Proposez-vous des repas le soir ?", "Nos box sont disponibles le midi. Le service du soir arrive bientôt : suivez-nous sur Instagram pour être prévenus.")}
      {qa("D’où viennent vos produits d’épicerie ?", "Nous sélectionnons des produits issus de producteurs français : rillettes du Sud-Ouest, tartinades, moutardes parfumées (noix, cèpes…), terrines, condiments et douceurs sucrées.")}
      {qa("Quels sont vos horaires ?", "Du mardi au samedi de 8h30 à 13h et de 16h30 à 19h, le dimanche de 8h30 à 13h. Fermé le lundi.")}
    </div>
  </div>
</section>'''

MAIN = "\n".join([HERO, WHY, TIMELINE, SHAPES, TIMER, TIPS, FAQ, marquee(MARQUEE_MAIN, cls="wood")])

build("savoir-faire.html",
      "Savoir-faire · L’art des pâtes fraîches · Maison Pastier",
      "Le métier de fabricant de pâtes fraîches expliqué : ingrédients, pétrissage, laminage, façonnage, formes de pâtes, temps de cuisson et conseils de Maison Pastier à Six-Fours-les-Plages.",
      "savoir-faire", MAIN)
