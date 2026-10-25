"""Rapport HTML lisible, généré localement (aucune ressource chargée depuis Internet)."""

from __future__ import annotations

from datetime import datetime
from html import escape
from statistics import mean

from .analyse import LIBELLES_NIVEAUX, Constat, champ_total_wifi, distance_approximative, mes_reseaux
from .exposition import champ_v_m, formater_mhz, formater_nombre, formater_v_m

CSS = """
:root{--fond:#f6f6f3;--carte:#fff;--texte:#1d1d1b;--doux:#5d5c57;--bord:#e1e0da;
--imp:#a8221a;--imp-f:#fbe7e4;--ver:#8f5300;--ver-f:#fdf0d8;--ok:#1b6e40;--ok-f:#e2f2e8;
--info:#2d5a86;--info-f:#e5edf6;--nm:#64635e;--nm-f:#ecebe6;--trait:#2d5a86}
@media (prefers-color-scheme:dark){:root{--fond:#161615;--carte:#20201e;--texte:#ecebe6;--doux:#a5a49d;
--bord:#363531;--imp:#ff8a7e;--imp-f:#3d1d1a;--ver:#f4b65a;--ver-f:#3a2b12;--ok:#6fcf97;--ok-f:#16301f;
--info:#8ab8e6;--info-f:#1a2a3b;--nm:#a5a49d;--nm-f:#2a2a27;--trait:#8ab8e6}}
*{box-sizing:border-box}
body{margin:0;background:var(--fond);color:var(--texte);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1000px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:1.7rem;margin:0 0 4px}h2{font-size:1.25rem;margin:36px 0 12px}h3{font-size:1.05rem;margin:20px 0 8px}
p{margin:6px 0}.doux{color:var(--doux)}small{color:var(--doux)}
.carte{background:var(--carte);border:1px solid var(--bord);border-radius:10px;padding:16px 18px;margin:12px 0}
.synthese{font-size:1.1rem}
.constat{border-left:5px solid var(--nm);padding:10px 14px;margin:10px 0;background:var(--carte);border-radius:0 8px 8px 0;border-top:1px solid var(--bord);border-right:1px solid var(--bord);border-bottom:1px solid var(--bord)}
.constat .titre{font-weight:600}.constat .action{margin-top:6px}
.badge{display:inline-block;font-size:.78rem;font-weight:600;padding:1px 8px;border-radius:999px;margin-right:6px;vertical-align:1px}
.n-important{border-left-color:var(--imp)}.b-important{background:var(--imp-f);color:var(--imp)}
.n-a_verifier{border-left-color:var(--ver)}.b-a_verifier{background:var(--ver-f);color:var(--ver)}
.n-normal{border-left-color:var(--ok)}.b-normal{background:var(--ok-f);color:var(--ok)}
.n-info{border-left-color:var(--info)}.b-info{background:var(--info-f);color:var(--info)}
.n-non_mesure{border-left-color:var(--nm)}.b-non_mesure{background:var(--nm-f);color:var(--nm)}
.compteurs{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.tableau{overflow-x:auto;border:1px solid var(--bord);border-radius:8px;background:var(--carte)}
table{border-collapse:collapse;width:100%;font-size:.9rem}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--bord);vertical-align:top}
th{font-weight:600;color:var(--doux);white-space:nowrap}tr:last-child td{border-bottom:0}
td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
code,.mono{font-family:ui-monospace,Consolas,monospace;font-size:.85rem}
details{margin:10px 0}summary{cursor:pointer;font-weight:600}
ul{padding-left:22px}li{margin:3px 0}
svg text{fill:var(--doux);font-size:11px}
"""


def _e(x) -> str:
    return escape("" if x is None else str(x))


def _date(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso).strftime("%d/%m/%Y à %H:%M")
    except (TypeError, ValueError):
        return _e(iso)


def _badge(niveau: str) -> str:
    return f'<span class="badge b-{niveau}">{LIBELLES_NIVEAUX[niveau]}</span>'


def _tableau(entetes: list[str], lignes: list[list[str]], numeriques: set[int] = frozenset()) -> str:
    if not lignes:
        return '<p class="doux">Rien à afficher.</p>'
    tete = "".join(f"<th>{h}</th>" for h in entetes)
    corps = "".join("<tr>" + "".join(
        f'<td class="num">{c}</td>' if i in numeriques else f"<td>{c}</td>" for i, c in enumerate(ligne)
    ) + "</tr>" for ligne in lignes)
    return f'<div class="tableau"><table><thead><tr>{tete}</tr></thead><tbody>{corps}</tbody></table></div>'


def _constats(constats: list[Constat]) -> str:
    blocs = []
    for c in constats:
        action = f'<div class="action"><strong>Que faire :</strong> {_e(c.action)}</div>' if c.action else ""
        detail = f"<div>{_e(c.detail)}</div>" if c.detail else ""
        blocs.append(f'<div class="constat n-{c.niveau}"><div class="titre">{_badge(c.niveau)}'
                     f'<span class="doux">{_e(c.domaine)} · </span>{_e(c.titre)}</div>{detail}{action}</div>')
    return "".join(blocs)


# --- sections détaillées --------------------------------------------------------------

def _section_wifi(w: dict, config: dict) -> str:
    if not w:
        return ""
    if not w.get("ok"):
        return f"<h2>Wi-Fi</h2><p>{_e(w.get('erreur'))}</p>"
    miens = mes_reseaux(w, config)
    lignes = []
    for r in sorted(w["reseaux"], key=lambda r: r.get("signal_dbm") or -999, reverse=True):
        signal = "?"
        champ = "?"
        if r.get("signal_dbm") is not None:
            signal = ("≥ " if r.get("signal_sature") else "") + f"{r['signal_dbm']:.0f} dBm"
            champ = formater_v_m(champ_v_m(r["signal_dbm"], r.get("frequence_mhz") or 2437))
        nom = _e(r["ssid"]) if r["ssid"] else '<span class="doux">(réseau masqué)</span>'
        if r["ssid"] in miens:
            nom += ' <span class="badge b-normal">votre réseau</span>'
        if r.get("connecte"):
            nom += ' <span class="badge b-info">connecté</span>'
        securite = _e(r.get("securite") or "—") + (' <span class="badge b-a_verifier">ouvert</span>' if r.get("ouvert") else "")
        lignes.append([nom, f'<span class="mono">{_e(r.get("bssid") or "—")}</span>', signal, champ,
                       _e(r.get("canal") or "?"), _e(r.get("bande") or "?").replace(" ", "&nbsp;"), securite])
    remarque = f"<p class='doux'>{_e(w['remarque'])}</p>" if w.get("remarque") else ""
    return ("<h2>Wi-Fi : réseaux visibles</h2>"
            "<p class='doux'>Plus le signal est proche de 0 dBm, plus l'émetteur est proche : -30 dBm = dans la même "
            "pièce, -60 dBm = une pièce ou un mur plus loin, -85 dBm = loin. « ≥ » : Windows plafonne l'affichage, "
            "le signal réel peut être plus fort. Le champ (V/m) est une estimation à ±10 dB.</p>" + remarque
            + _tableau(["Nom du réseau", "Adresse (BSSID)", "Signal", "Champ estimé", "Canal", "Bande", "Sécurité"],
                       lignes, {2, 3}))


def _section_bluetooth(bt: dict) -> str:
    if not bt:
        return ""
    if not bt.get("ok"):
        return f"<h2>Bluetooth</h2><p>{_e(bt.get('erreur'))}</p>"
    lignes = []
    for a in bt["appareils"]:
        type_ = _e(a.get("type"))
        if a.get("traceur_separe"):
            type_ = '<span class="badge b-a_verifier">traceur séparé</span>' + type_
        elif a.get("traceur"):
            type_ = '<span class="badge b-info">Localiser</span>' + type_
        rssi = a.get("rssi_max")
        lignes.append([type_, _e(a.get("nom") or "—"), _e(a.get("fabricant") or "—"),
                       f"{rssi} dBm" if rssi is not None else "?", _e(distance_approximative(rssi)),
                       _e(a.get("nb_annonces")), f'<span class="mono">{_e(a.get("adresse"))}</span>'])
    return ("<h2>Bluetooth : appareils détectés</h2>"
            "<p class='doux'>La distance est très approximative (murs, corps, orientation changent beaucoup le signal). "
            "L'identification se fait à partir de l'annonce radio de l'appareil et reste indicative.</p>"
            + _tableau(["Type", "Nom", "Fabricant", "Signal max", "Distance", "Annonces", "Adresse"], lignes, {3, 5}))


def _section_reseau(r: dict, config: dict) -> str:
    if not r:
        return ""
    if not r.get("ok"):
        return f"<h2>Réseau local</h2><p>{_e(r.get('erreur'))}</p>"
    connus = config.get("appareils_reseau_connus", {})
    lignes = []
    for a in r["appareils"]:
        statut = []
        if a.get("passerelle"):
            statut.append('<span class="badge b-info">box / routeur</span>')
        if connus:
            statut.append('<span class="badge b-normal">connu</span>' if a["mac"] in connus
                          else '<span class="badge b-a_verifier">nouveau</span>')
        if a.get("mac_aleatoire"):
            statut.append('<span class="doux">adresse aléatoire (téléphone récent ?)</span>')
        lignes.append([_e(a["ip"]), f'<span class="mono">{_e(a["mac"])}</span>', " ".join(statut),
                       _e(connus.get(a["mac"], ""))])
    lignes.insert(0, [_e(r.get("mon_ip")), "—", '<span class="badge b-info">cet ordinateur</span>', ""])
    return ("<h2>Réseau local : appareils connectés à votre box</h2>"
            f"<p class='doux'>Réseau {_e(r.get('reseau'))}. Un appareil éteint ou en veille profonde peut ne pas "
            "apparaître. La liste de référence est dans <code>donnees/config.json</code> (vous pouvez y écrire "
            "le nom de chaque appareil).</p>"
            + _tableau(["Adresse IP", "Adresse MAC", "Statut", "Description"], lignes))


def _section_ordinateur(o: dict) -> str:
    if not o:
        return ""
    if not o.get("ok"):
        return f"<h2>Ordinateur</h2><p>{_e(o.get('erreur'))}</p>"
    morceaux = ["<h2>Ordinateur</h2>"]
    outils = o.get("outils_acces_distant", [])
    morceaux.append("<p><strong>Prise de contrôle à distance active :</strong> "
                    + (", ".join(_e(x["nom"]) for x in outils) if outils else "aucune détectée") + "</p>")
    morceaux.append("<p><strong>Au démarrage :</strong> "
                    + (", ".join(_e(x) for x in o.get("outils_au_demarrage", [])) or "aucun outil de ce type") + "</p>")
    ports = o.get("ports_acces_distant", [])
    morceaux.append("<p><strong>Accès à distance ouverts :</strong> "
                    + (", ".join(f"{_e(p['service'])} ({_e(p['local'])})" for p in ports) or "aucun") + "</p>")
    av = o.get("antivirus_windows")
    if av:
        morceaux.append("<p><strong>Microsoft Defender :</strong> protection en temps réel "
                        + ("activée" if av.get("RealTimeProtectionEnabled") else "désactivée") + "</p>")

    par_programme: dict[str, int] = {}
    for c in o.get("connexions_etablies", []):
        par_programme[c["processus"]] = par_programme.get(c["processus"], 0) + 1
    lignes = [[_e(p), str(n)] for p, n in sorted(par_programme.items(), key=lambda x: -x[1])]
    morceaux.append("<details><summary>Connexions Internet ouvertes par programme</summary>"
                    + _tableau(["Programme", "Connexions"], lignes, {1}) + "</details>")
    lignes = [[_e(c["processus"]), f'<span class="mono">{_e(c["local"])}</span>'] for c in o.get("ecoute", [])]
    morceaux.append("<details><summary>Ports en écoute</summary>"
                    "<p class='doux'>Une adresse 127.0.0.1 ou ::1 n'est accessible que depuis l'ordinateur lui-même.</p>"
                    + _tableau(["Programme", "Adresse locale"], lignes) + "</details>")
    lignes = [[_e(x)] for x in o.get("demarrage", [])]
    morceaux.append("<details><summary>Programmes lancés au démarrage</summary>"
                    + _tableau(["Élément"], lignes) + "</details>")
    return "".join(morceaux)


def _section_sdr(s: dict) -> str:
    if not s or not s.get("ok"):
        return ""
    lignes = []
    for e in s.get("emissions", []):
        bande = _e(e.get("bande")) if e.get("bande") else (
            '<span class="doux">parasite probable du récepteur</span>' if e.get("artefact_possible")
            else '<span class="badge b-a_verifier">non répertoriée</span>')
        lignes.append([formater_mhz(e["pic_mhz"]), f"{formater_mhz(e['debut_mhz'])} – {formater_mhz(e['fin_mhz'])}",
                       f"+{formater_nombre(e['exces_db'])} dB",
                       bande, _e(e.get("explication") or "")])
    return ("<h2>Radio large bande (SDR)</h2>"
            f"<p class='doux'>Plage balayée : {s['plage_mhz'][0]:.0f} à {s['plage_mhz'][1]:.0f} MHz. Les niveaux "
            "sont relatifs au bruit de fond (clé non calibrée) : ils permettent de comparer, pas de mesurer une "
            "exposition en V/m.</p>"
            + _tableau(["Pic", "Étendue", "Au-dessus du bruit", "Bande", "Usage habituel"], lignes, {2}))


# --- historique et comparaison des pièces ------------------------------------------------

def _chiffres(a: dict, config: dict) -> dict:
    w = a.get("wifi", {})
    reseaux = w.get("reseaux", []) if w.get("ok") else []
    miens = mes_reseaux(w, config) if w else set()
    voisins = [r["signal_dbm"] for r in reseaux if r["ssid"] not in miens and r.get("signal_dbm") is not None]
    bt = a.get("bluetooth", {})
    appareils = bt.get("appareils", []) if bt.get("ok") else []
    reseau = a.get("reseau_local", {})
    return {
        "nb_wifi": len(reseaux) if reseaux else None,
        "voisin_max": max(voisins) if voisins else None,
        "champ": champ_total_wifi(reseaux) if reseaux else None,
        "nb_bt": len(appareils) if bt.get("ok") else None,
        "separes": sum(1 for x in appareils if x.get("traceur_separe")) if bt.get("ok") else None,
        "nb_reseau": len(reseau.get("appareils", [])) if reseau.get("ok") else None,
    }


def _graphique(valeurs: list[tuple[str, float]]) -> str:
    if len(valeurs) < 2:
        return ""
    largeur, hauteur, marge = 640, 170, 34
    haut = max(v for _, v in valeurs) * 1.25 or 1
    n = len(valeurs)
    points = " ".join(f"{marge + i * (largeur - 2 * marge) / (n - 1):.1f},"
                      f"{hauteur - marge - v / haut * (hauteur - 2 * marge):.1f}" for i, (_, v) in enumerate(valeurs))
    return (f'<svg viewBox="0 0 {largeur} {hauteur}" width="100%" role="img" '
            f'aria-label="Champ Wi-Fi estimé au fil des analyses">'
            f'<line x1="{marge}" y1="{hauteur - marge}" x2="{largeur - marge}" y2="{hauteur - marge}" stroke="currentColor" opacity=".25"/>'
            f'<polyline points="{points}" fill="none" stroke="var(--trait)" stroke-width="2"/>'
            f'<text x="{marge}" y="{hauteur - 12}">{_e(_date(valeurs[0][0]))}</text>'
            f'<text x="{largeur - marge}" y="{hauteur - 12}" text-anchor="end">{_e(_date(valeurs[-1][0]))}</text>'
            f'<text x="{marge}" y="14">max affiché : {formater_v_m(haut)} — la limite (61 V/m) est '
            f'{formater_nombre(61 / haut)} fois plus haut que le haut du graphique</text></svg>')


def _section_historique(analyses: list[dict], config: dict) -> str:
    if len(analyses) < 2:
        return ("<h2>Historique</h2><p class='doux'>Une seule analyse pour l'instant. Pour comparer, refaites une "
                "analyse dans chaque pièce, à différentes heures (jour / nuit), ou lancez la surveillance.</p>")
    recentes = analyses[-40:]
    lignes = []
    for a in reversed(recentes):
        c = _chiffres(a, config)
        lignes.append([_e(_date(a["horodatage"])), _e(a.get("lieu")),
                       _e(c["nb_wifi"] if c["nb_wifi"] is not None else "—"),
                       f"{c['voisin_max']:.0f} dBm" if c["voisin_max"] is not None else "—",
                       formater_v_m(c["champ"]) if c["champ"] else "—",
                       _e(c["nb_bt"] if c["nb_bt"] is not None else "—"),
                       _e(c["separes"] if c["separes"] is not None else "—"),
                       _e(c["nb_reseau"] if c["nb_reseau"] is not None else "—")])
    graphique = _graphique([(a["horodatage"], _chiffres(a, config)["champ"]) for a in recentes
                            if _chiffres(a, config)["champ"]])

    par_lieu: dict[str, list[dict]] = {}
    for a in analyses:
        par_lieu.setdefault(a.get("lieu") or "non précisé", []).append(_chiffres(a, config))
    lignes_lieux = []
    for lieu, chiffres in sorted(par_lieu.items()):
        champs = [c["champ"] for c in chiffres if c["champ"]]
        voisins = [c["voisin_max"] for c in chiffres if c["voisin_max"] is not None]
        bts = [c["nb_bt"] for c in chiffres if c["nb_bt"] is not None]
        lignes_lieux.append([_e(lieu), str(len(chiffres)),
                             f"{mean(voisins):.0f} dBm" if voisins else "—",
                             formater_v_m(mean(champs)) if champs else "—",
                             f"{mean(bts):.0f}" if bts else "—"])
    return ("<h2>Historique</h2>" + graphique
            + _tableau(["Date", "Lieu", "Wi-Fi", "Voisin le plus fort", "Champ Wi-Fi estimé", "Bluetooth",
                        "Traceurs séparés", "Appareils réseau"], lignes, {2, 3, 4, 5, 6, 7})
            + "<h3>Comparaison des pièces</h3>"
              "<p class='doux'>Si un émetteur visait une pièce précise, ses valeurs y seraient nettement et "
              "durablement plus élevées que dans les autres pièces. Des écarts de 5 à 10 dB d'une pièce à l'autre "
              "sont normaux (murs, distance à la box). Valable pour les bandes que l'ordinateur capte.</p>"
            + _tableau(["Lieu", "Analyses", "Voisin le plus fort (moy.)", "Champ Wi-Fi (moy.)", "Bluetooth (moy.)"],
                       lignes_lieux, {1, 2, 3, 4}))


# --- textes fixes ------------------------------------------------------------------------------

LIMITES = """
<h2>Ce que cet ordinateur peut mesurer… et ce qu'il ne peut pas</h2>
<div class="carte">
<p><strong>Mesuré :</strong> les réseaux Wi-Fi (2,4 / 5 / 6 GHz selon la carte), les appareils Bluetooth basse
consommation, les appareils connectés à votre box, les logiciels de prise de contrôle à distance et les accès
ouverts sur l'ordinateur. Avec une clé SDR (optionnelle) : les émissions entre 24 et 1 766 MHz.</p>
<p><strong>Pas mesuré :</strong> la 4G/5G au-delà de 1 766 MHz, les fréquences plus hautes (radars, 26 GHz…),
les champs basse fréquence (lignes électriques, appareils ménagers), les ultrasons. Aucun ordinateur ne
fournit une mesure d'exposition qui fait foi : les valeurs en V/m sont des ordres de grandeur.</p>
<p><strong>À savoir :</strong> le téléphone ne peut pas être analysé depuis l'ordinateur (voir la liste de
contrôle ci-dessous). Un résultat « rien d'anormal » porte uniquement sur ce qui a été vérifié.</p>
</div>
"""

SUITE = """
<h2>Que faire ensuite</h2>
<div class="carte">
<h3>1. Sécuriser ce qui peut réellement être piraté (gratuit)</h3>
<ul>
<li><strong>Box :</strong> changez le mot de passe Wi-Fi (WPA2 ou WPA3, 14 caractères ou plus) et le mot de passe
d'administration de la box, désactivez le WPS, vérifiez la liste des appareils connectés.</li>
<li><strong>Comptes :</strong> changez le mot de passe de votre messagerie puis des autres comptes importants,
depuis un appareil de confiance, et activez la double authentification.</li>
<li><strong>Ordinateur :</strong> mises à jour, analyse antivirus complète, désinstallation de tout logiciel de
prise de contrôle à distance que vous n'utilisez pas.</li>
</ul>
<h3>2. Contrôler le téléphone (les intitulés varient selon le modèle)</h3>
<ul>
<li><strong>iPhone :</strong> Réglages &gt; Général &gt; Mise à jour logicielle ; Réglages &gt; Confidentialité et
sécurité &gt; Contrôle de sécurité (passe en revue les partages et les accès) ; Réglages &gt; Général &gt; VPN et
gestion de l'appareil (aucun profil que vous n'avez pas installé) ; Réglages &gt; votre nom : liste des appareils
connectés à votre compte, supprimez ceux que vous ne connaissez pas.</li>
<li><strong>Android :</strong> Paramètres &gt; Sécurité &gt; Google Play Protect &gt; Analyser ; Paramètres &gt;
Accessibilité : aucune application inconnue ne doit y avoir accès (c'est ce qu'utilisent les logiciels espions) ;
applications d'administration de l'appareil ; compte Google &gt; Sécurité &gt; Vos appareils.</li>
<li>En dernier recours : sauvegarde des photos, réinitialisation d'usine, puis changement des mots de passe.</li>
<li>Aide gratuite et officielle en cas de piratage : <strong>cybermalveillance.gouv.fr</strong>.</li>
</ul>
<h3>3. Faire mesurer officiellement les ondes chez vous (gratuit)</h3>
<p>En France, toute personne peut obtenir une mesure d'exposition aux ondes dans son logement, réalisée par un
laboratoire accrédité et financée par l'État : formulaire <strong>Cerfa n° 15003</strong> (sur service-public.fr),
à faire signer par votre mairie (ou une association agréée), qui le transmet à l'<strong>ANFR</strong>. Les résultats
sont publiés sur cartoradio.fr. C'est la mesure qui fait foi, toutes fréquences confondues, bien plus fiable que ce
logiciel ou qu'un détecteur acheté en ligne. En Belgique : IBPT ; en Suisse : OFCOM.</p>
<h3>4. Si vous ressentez des effets physiques</h3>
<p>Maux de tête, troubles du sommeil, picotements, acouphènes ou sensation de chaleur sont des symptômes réels,
qui méritent d'être pris au sérieux par un médecin : ils ont de nombreuses causes possibles, que lui seul peut
rechercher. Les études en double aveugle n'ont pas montré que les personnes qui se disent sensibles aux ondes
perçoivent leur présence aux niveaux rencontrés dans les logements ; en parler à un médecin reste la façon la plus
sûre d'être soulagé.</p>
<h3>5. Si vous pensez être visé par quelqu'un</h3>
<p>Le brouillage et l'utilisation d'émetteurs non autorisés sont des infractions : un signal anormal, persistant et
localisé peut être signalé à l'ANFR. Le harcèlement peut faire l'objet d'une plainte (police, gendarmerie) ; ce
rapport et l'historique des mesures peuvent être joints. N'utilisez pas de brouilleur : c'est interdit
(article L33-3-1 du code des postes et des communications électroniques) et cela couperait aussi votre propre
téléphone et votre Wi-Fi.</p>
</div>
"""


def generer(analyse: dict, constats: list[Constat], synthese: str, historique: list[dict], config: dict) -> str:
    compteurs = {}
    for c in constats:
        compteurs[c.niveau] = compteurs.get(c.niveau, 0) + 1
    pastilles = "".join(f'<span class="badge b-{n}">{compteurs[n]} {LIBELLES_NIVEAUX[n].lower()}</span>'
                        for n in ("important", "a_verifier", "normal", "info", "non_mesure") if n in compteurs)
    return f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapport Veille Ondes</title><style>{CSS}</style></head>
<body><main>
<h1>Rapport Veille Ondes</h1>
<p class="doux">Analyse du {_e(_date(analyse['horodatage']))} · lieu : {_e(analyse.get('lieu'))} ·
{_e(analyse.get('systeme'))}<br>Généré sur cet ordinateur ; aucune donnée n'a été envoyée sur Internet.</p>
<div class="carte synthese"><strong>En résumé :</strong> {_e(synthese)}<div class="compteurs">{pastilles}</div></div>
<h2>Constats</h2>
{_constats(constats)}
{LIMITES}
{_section_wifi(analyse.get('wifi'), config)}
{_section_bluetooth(analyse.get('bluetooth'))}
{_section_reseau(analyse.get('reseau_local'), config)}
{_section_ordinateur(analyse.get('ordinateur'))}
{_section_sdr(analyse.get('sdr'))}
{_section_historique(historique, config)}
{SUITE}
<p class="doux"><small>Veille Ondes {_e(analyse.get('version'))} — logiciel libre, exécuté localement.</small></p>
</main></body></html>
"""
