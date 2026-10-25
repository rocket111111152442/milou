"""Outils communs : détection du système et lancement de commandes."""

from __future__ import annotations

import os
import platform
import subprocess
from dataclasses import dataclass


@dataclass
class Resultat:
    code: int
    sortie: str
    erreurs: str = ""

    @property
    def ok(self) -> bool:
        return self.code == 0


def nom_os() -> str:
    """Renvoie "windows", "mac", "linux" ou "autre"."""
    s = platform.system().lower()
    if s.startswith("win"):
        return "windows"
    if s == "darwin":
        return "mac"
    if s == "linux":
        return "linux"
    return "autre"


def description_systeme() -> str:
    return f"{platform.system()} {platform.release()} ({platform.machine()})"


def decoder(octets: bytes) -> str:
    """Décode la sortie d'une commande.

    Sous Windows, les commandes comme netsh écrivent dans la page de code de
    la console (cp850 en français) et pas en UTF-8 : on essaie plusieurs
    encodages avant d'abandonner.
    """
    if not octets:
        return ""
    for encodage in ("utf-8", "oem", "cp850", "cp1252"):
        try:
            return octets.decode(encodage)
        except (UnicodeDecodeError, LookupError):
            continue
    return octets.decode("latin-1", errors="replace")


def executer(commande: list[str], delai: float = 60) -> Resultat:
    """Lance une commande sans jamais lever d'exception."""
    options = {}
    if os.name == "nt":
        options["creationflags"] = 0x08000000  # CREATE_NO_WINDOW : pas de fenêtre qui clignote
    try:
        p = subprocess.run(commande, capture_output=True, timeout=delai, **options)
    except FileNotFoundError:
        return Resultat(127, "", f"commande introuvable : {commande[0]}")
    except subprocess.TimeoutExpired:
        return Resultat(124, "", f"délai dépassé ({delai:.0f} s) : {' '.join(commande)}")
    except OSError as e:
        return Resultat(126, "", str(e))
    return Resultat(p.returncode, decoder(p.stdout), decoder(p.stderr))
