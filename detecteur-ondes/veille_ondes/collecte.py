"""Enchaîne les différentes mesures et rassemble les résultats d'une analyse."""

from __future__ import annotations

import time
from datetime import datetime
from typing import Callable

from . import __version__, bluetooth, ordinateur, reseau_local, sdr, wifi
from .systeme import description_systeme

MODULES = ("wifi", "bluetooth", "reseau_local", "ordinateur", "sdr")


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
        return f"{len(r['emissions'])} émissions repérées"
    return "terminé"


def lancer_analyse(lieu: str = "", modules: tuple[str, ...] = ("wifi", "bluetooth", "reseau_local", "ordinateur"),
                   duree_bluetooth: float = 15.0, sdr_csv: str | None = None, balayage_reseau: bool = True,
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
        "ordinateur": ("Ordinateur : prise de contrôle à distance, ports, démarrage", ordinateur.scanner),
        "sdr": ("Radio large bande (SDR) : balayage 24-1700 MHz", lambda: sdr.scanner(sdr_csv)),
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
