"""Enchaîne les différentes mesures et rassemble les résultats d'une analyse."""

from __future__ import annotations

import time
from datetime import datetime
from pathlib import Path
from typing import Callable

from . import __version__, bluetooth, cameras, ordinateur, reseau_local, sdr, telephone, wifi
from .systeme import description_systeme

# ordre d'exécution : la recherche de caméras réutilise les résultats Wi-Fi, Bluetooth et réseau local
MODULES = ("wifi", "bluetooth", "reseau_local", "cameras", "ordinateur", "telephone", "sdr")
PAR_DEFAUT = ("wifi", "bluetooth", "reseau_local", "cameras", "ordinateur")


def _resume(cle: str, r: dict) -> str:
    if not r.get("ok"):
        return "non mesuré : " + (r.get("erreur") or "raison inconnue")
    if cle == "wifi":
        return f"{len(r['reseaux'])} émetteurs Wi-Fi"
    if cle == "bluetooth":
        traceurs = sum(1 for a in r["appareils"] if a.get("traceur"))
        return f"{len(r['appareils'])} appareils Bluetooth, dont {traceurs} traceur(s)/appareil(s) Localiser"
    if cle == "reseau_local":
        n = len(r["appareils"])
        return f"{n} appareils sur le réseau {r.get('reseau')}" if n else "aucun appareil trouvé (liste non obtenue)"
    if cle == "ordinateur":
        return (f"{r['nb_processus']} programmes examinés, "
                f"{len(r['outils_acces_distant'])} outil(s) de prise de contrôle à distance actif(s)")
    if cle == "sdr":
        return f"{r.get('source')} : {len(r['emissions'])} émissions repérées"
    if cle == "cameras":
        reseau = (f"{len(r['cameras_reseau'])} caméra(s) sur le réseau" if r.get("reseau_verifie")
                  else "réseau local non examiné")
        return f"{reseau}, {len(r['wifi_cameras'])} réseau(x) Wi-Fi au nom de caméra"
    if cle == "telephone":
        suspectes = sum(1 for a in r["applications"] if a["niveau"] in ("important", "a_verifier"))
        return (f"{r['appareil']['fabricant']} {r['appareil']['modele']} : {len(r['applications'])} applis "
                f"installées par l'utilisateur, {suspectes} à examiner")
    return "terminé"


def lancer_analyse(lieu: str = "", modules: tuple[str, ...] = PAR_DEFAUT,
                   duree_bluetooth: float = 15.0, sdr_csv: str | None = None, balayage_reseau: bool = True,
                   materiel_radio: str = "auto", dossier_donnees: Path | None = None,
                   journal: Callable[[str], None] = print) -> dict:
    analyse = {
        "horodatage": datetime.now().isoformat(timespec="seconds"),
        "lieu": lieu.strip() or "non précisé",
        "systeme": description_systeme(),
        "version": __version__,
    }
    etapes = {
        "wifi": ("Wi-Fi : liste des réseaux visibles", wifi.scanner),
        "bluetooth": (f"Bluetooth : écoute pendant {duree_bluetooth:.0f} s",
                      lambda: bluetooth.scanner(duree_bluetooth)),
        "reseau_local": ("Réseau local : appareils connectés à votre box",
                         lambda: reseau_local.scanner(balayage_reseau)),
        "cameras": ("Caméras : réseau local, réseaux Wi-Fi et Bluetooth", lambda: cameras.scanner(
            analyse.get("reseau_local") or reseau_local.scanner(balayage_reseau),
            analyse.get("wifi"), analyse.get("bluetooth"))),
        "ordinateur": ("Ordinateur : prise de contrôle à distance, ports, démarrage", ordinateur.scanner),
        "telephone": ("Téléphone Android (USB) : applications et réglages de sécurité "
                      "(si une demande s'affiche sur le téléphone, acceptez-la)",
                      lambda: telephone.scanner(dossier_donnees)),
        "sdr": ("Radio large bande : balayage avec le récepteur branché",
                lambda: sdr.scanner(sdr_csv, materiel_radio)),
    }
    for cle in MODULES:
        if cle not in modules:
            continue
        libelle, fonction = etapes[cle]
        journal(f"→ {libelle}…")
        debut = time.time()
        try:
            resultat = fonction()
        except Exception as e:  # une mesure qui plante ne doit pas bloquer les autres
            resultat = {"ok": False, "erreur": f"erreur inattendue : {e.__class__.__name__}: {e}"}
        analyse[cle] = resultat
        journal(f"   {_resume(cle, resultat)} ({time.time() - debut:.0f} s)")
    return analyse
