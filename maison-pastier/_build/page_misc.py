# -*- coding: utf-8 -*-
from common import *
from blocks import *

CREDITS = [
    ("Fontaine de farine et œufs", "Wendy Rake", "1556910116-e220f7127371"),
    ("Pétrissage", "Simona Sergi", "1606854428857-5121b55a2661"),
    ("Laminage", "Jorge Zapata", "1447279506476-3faec8071eee"),
    ("Découpe des tagliatelles", "Margaret Jaszowska", "1615502731859-ff87646c51bd"),
    ("Tagliatelles", "Karen Sewell", "1606091484089-089fa86fad4f"),
    ("Nids de tagliatelles", "Kate Mishchankova", "1708514193930-2977def8669a"),
    ("Boule de pâte", "Tamara Gak", "1598634549802-dcc558705f19"),
]
credits_html = "".join(f"<li>{t} : {a} / Unsplash</li>" for t, a, _ in CREDITS)

LEGAL = f'''<section class="page-hero bg-canard on-dark" style="padding-bottom:70px">
  <div class="container page-hero__copy">
    <nav class="breadcrumb" aria-label="Fil d’Ariane" data-hero-fade><a href="index.html">Accueil</a><span>/</span><span aria-current="page">Mentions légales</span></nav>
    <h1><span class="line"><span>Mentions <em>légales</em></span></span></h1>
  </div>
</section>
<section class="section bg-creme">
  <div class="container legal">
    <p class="notice">{ico("info")}<span>Les éléments surlignés sont à compléter par l’exploitant avant la mise en ligne définitive du site.</span></p>
    <h2>Éditeur du site</h2>
    <p>Maison Pastier — <mark>[forme juridique et raison sociale]</mark><br>{ADDRESS_1}, {ADDRESS_2}<br>Téléphone : {PHONE_TXT}<br>SIRET : <mark>[numéro SIRET]</mark><br>Directeur de la publication : <mark>[nom du responsable]</mark></p>
    <h2>Hébergement</h2>
    <p>Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com</p>
    <h2>Données personnelles</h2>
    <p>Ce site ne dépose aucun cookie de suivi et n’enregistre aucune donnée. Les formulaires de commande et de contact ne transmettent rien à un serveur : ils ouvrent l’application SMS de votre téléphone avec un message pré-rempli, que vous choisissez d’envoyer ou non.</p>
    <p>La carte d’accès est fournie par Google Maps, dont l’affichage peut entraîner un dépôt de cookies par Google. Les polices de caractères sont chargées depuis Google Fonts.</p>
    <h2>Propriété intellectuelle</h2>
    <p>Le logo, les textes et les photographies de la boutique sont la propriété de Maison Pastier. Toute reproduction sans autorisation est interdite.</p>
    <h2 id="credits">Crédits photos</h2>
    <p>Photographies de la boutique et des produits : Maison Pastier.<br>Photographies d’illustration du métier (licence Unsplash) :</p>
    <ul>{credits_html}</ul>
  </div>
</section>'''

build("mentions-legales.html", "Mentions légales · Maison Pastier",
      "Mentions légales, données personnelles et crédits photos du site de Maison Pastier, fabrique de pâtes fraîches à Six-Fours-les-Plages.",
      "legal", LEGAL)

NOTFOUND = f'''<section class="page-hero bg-canard on-dark" style="min-height:100svh;display:flex;align-items:center">
  <div class="hero__floaters" aria-hidden="true">{HERO_FLOATERS}</div>
  <div class="container page-hero__copy" style="justify-items:start">
    <span class="eyebrow eyebrow--light" data-hero-fade>Erreur 404</span>
    <h1><span class="line"><span>Cette page a fondu</span></span><span class="line"><span><em>dans la casserole.</em></span></span></h1>
    <p class="lead" data-hero-fade>La page demandée n’existe pas ou a été déplacée. Les pâtes, elles, sont toujours là.</p>
    <div class="btn-row" data-hero-fade><a class="btn btn--light magnetic" href="index.html">Retour à l’accueil {ARROW}</a><a class="btn btn--ghost-light magnetic" href="produits.html">Nos produits</a></div>
  </div>
</section>'''

build("404.html", "Page introuvable · Maison Pastier", "Cette page n’existe pas.", "404", NOTFOUND, base=True)
