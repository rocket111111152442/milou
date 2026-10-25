"""Point d'entrée : « python -m veille_ondes » ouvre la fenêtre, sinon voir --help."""

from __future__ import annotations

import argparse
import sys
import time
import webbrowser
from datetime import datetime
from pathlib import Path

from . import analyse as interpretation
from . import rapport
from .collecte import MODULES, lancer_analyse
from .historique import Historique


def _journal(message: str) -> None:
    print(message, flush=True)


def analyser_et_rapporter(args, historique: Historique) -> Path:
    if args.mon_wifi:
        historique.definir_mes_wifi(args.mon_wifi)
    modules = [m for m in MODULES if not getattr(args, f"sans_{m}", False)]
    if not (args.sdr or args.sdr_csv):
        modules.remove("sdr")
    precedentes = historique.charger(limite=500)
    _journal(f"Analyse du {datetime.now():%d/%m/%Y %H:%M} — lieu : {args.lieu or 'non précisé'}")
    analyse = lancer_analyse(lieu=args.lieu, modules=tuple(modules), duree_bluetooth=args.duree_bluetooth,
                             sdr_csv=args.sdr_csv, balayage_reseau=not args.sans_balayage, journal=_journal)
    config = historique.config()
    constats = interpretation.evaluer(analyse, precedentes, config)
    synthese = interpretation.synthese(constats)
    analyse["constats"] = interpretation.en_dict(constats)
    historique.enregistrer(analyse)

    html = rapport.generer(analyse, constats, synthese, precedentes + [analyse], config)
    fichier = historique.dossier / "rapport.html"
    fichier.write_text(html, encoding="utf-8")
    horodatage = datetime.fromisoformat(analyse["horodatage"])
    (historique.dossier_rapports / f"{horodatage:%Y-%m-%d_%H%M%S}.html").write_text(html, encoding="utf-8")

    _journal("")
    _journal("EN RÉSUMÉ : " + synthese)
    for c in constats:
        if c.niveau in ("important", "a_verifier"):
            _journal(f"  [{interpretation.LIBELLES_NIVEAUX[c.niveau]}] {c.domaine} — {c.titre}")
    _journal(f"Rapport : {fichier}")
    return fichier


def commande_analyser(args) -> int:
    historique = Historique(args.donnees)
    fichier = analyser_et_rapporter(args, historique)
    if not args.sans_navigateur:
        webbrowser.open(fichier.resolve().as_uri())
    return 0


def commande_surveiller(args) -> int:
    historique = Historique(args.donnees)
    fin = time.time() + args.duree * 3600
    numero = 0
    _journal(f"Surveillance : une analyse toutes les {args.intervalle} min pendant {args.duree} h "
             f"(Ctrl+C pour arrêter).")
    try:
        while True:
            numero += 1
            _journal(f"\n===== Analyse n° {numero} =====")
            fichier = analyser_et_rapporter(args, historique)
            if numero == 1 and not args.sans_navigateur:
                webbrowser.open(fichier.resolve().as_uri())
            if time.time() + args.intervalle * 60 > fin:
                break
            _journal(f"Prochaine analyse dans {args.intervalle} min…")
            time.sleep(args.intervalle * 60)
    except KeyboardInterrupt:
        _journal("\nSurveillance arrêtée.")
    _journal("Surveillance terminée. Le rapport contient l'historique complet.")
    return 0


def commande_reference(args) -> int:
    historique = Historique(args.donnees)
    from .reseau_local import scanner
    _journal("Recherche des appareils présents sur votre réseau…")
    reseau = scanner(not args.sans_balayage)
    if not reseau.get("ok"):
        _journal("Impossible : " + reseau.get("erreur", ""))
        return 1
    n = historique.marquer_reference({"horodatage": datetime.now().isoformat(timespec="seconds"),
                                      "reseau_local": reseau})
    _journal(f"{n} appareil(s) enregistré(s) comme référence. Les prochaines analyses signaleront tout nouvel appareil.")
    return 0


def commande_rapport(args) -> int:
    historique = Historique(args.donnees)
    analyses = historique.charger(limite=500)
    if not analyses:
        _journal("Aucune analyse enregistrée.")
        return 1
    derniere = analyses[-1]
    config = historique.config()
    constats = interpretation.evaluer(derniere, analyses[:-1], config)
    html = rapport.generer(derniere, constats, interpretation.synthese(constats), analyses, config)
    fichier = historique.dossier / "rapport.html"
    fichier.write_text(html, encoding="utf-8")
    _journal(f"Rapport : {fichier}")
    if not args.sans_navigateur:
        webbrowser.open(fichier.resolve().as_uri())
    return 0


def construire_parseur() -> argparse.ArgumentParser:
    commun = argparse.ArgumentParser(add_help=False)
    commun.add_argument("--donnees", help="dossier des données (par défaut : ./donnees)")
    commun.add_argument("--sans-navigateur", action="store_true", help="ne pas ouvrir le rapport")
    commun.add_argument("--sans-balayage", action="store_true",
                        help="ne pas sonder les adresses du réseau local (liste moins complète)")

    mesure = argparse.ArgumentParser(add_help=False)
    mesure.add_argument("--lieu", default="", help="pièce ou lieu de la mesure (ex. : chambre)")
    mesure.add_argument("--mon-wifi", action="append", default=[], help="nom de votre Wi-Fi (répétable ; remplace la liste enregistrée)")
    mesure.add_argument("--duree-bluetooth", type=float, default=15.0, help="durée d'écoute Bluetooth en secondes")
    mesure.add_argument("--sdr", action="store_true", help="balayage radio avec une clé RTL-SDR (rtl_power)")
    mesure.add_argument("--sdr-csv", help="analyser un fichier CSV déjà produit par rtl_power")
    for m in MODULES:
        if m != "sdr":
            mesure.add_argument(f"--sans-{m.replace('_', '-')}", dest=f"sans_{m}", action="store_true",
                                help=f"ne pas faire la mesure « {m} »")

    p = argparse.ArgumentParser(prog="veille_ondes",
                                description="Inventaire local des ondes radio et contrôle de l'ordinateur.")
    sous = p.add_subparsers(dest="commande")
    a = sous.add_parser("analyser", parents=[commun, mesure], help="faire une analyse et ouvrir le rapport")
    a.set_defaults(fonction=commande_analyser)
    s = sous.add_parser("surveiller", parents=[commun, mesure], help="analyses répétées (ex. : toute la nuit)")
    s.add_argument("--intervalle", type=float, default=15, help="minutes entre deux analyses")
    s.add_argument("--duree", type=float, default=8, help="durée totale en heures")
    s.set_defaults(fonction=commande_surveiller)
    r = sous.add_parser("reference", parents=[commun], help="enregistrer les appareils actuels du réseau comme connus")
    r.set_defaults(fonction=commande_reference)
    g = sous.add_parser("rapport", parents=[commun], help="regénérer le rapport de la dernière analyse")
    g.set_defaults(fonction=commande_rapport)
    sous.add_parser("interface", help="ouvrir la fenêtre (par défaut)")
    return p


def main(argv: list[str] | None = None) -> int:
    args = construire_parseur().parse_args(argv)
    if args.commande in (None, "interface"):
        try:
            from .interface import lancer
        except ImportError as e:
            print(f"Interface graphique indisponible ({e}). Utilisez : python -m veille_ondes analyser")
            return 1
        return lancer()
    return args.fonction(args)


if __name__ == "__main__":
    sys.exit(main())
