"""Conversion d'un signal reçu (dBm) en champ électrique (V/m) et limites légales.

L'estimation est un ORDRE DE GRANDEUR : l'antenne d'un ordinateur n'est pas
calibrée, et Windows / Linux n'indiquent qu'un pourcentage converti en dBm.
On compte une incertitude d'environ ±10 dB, soit un facteur 3 sur le champ.
Pour une mesure qui fait foi, il faut un appareil calibré (mesure ANFR).
"""

from __future__ import annotations

import math

INCERTITUDE_DB = 10.0


def champ_v_m(signal_dbm: float, frequence_mhz: float, gain_antenne_dbi: float = 0.0) -> float:
    """Champ électrique correspondant à une puissance reçue par une antenne.

    Formule classique : E(dBµV/m) = P(dBm) + 20·log10(f en MHz) + 77,2 − G(dBi)
    """
    e_dbuv_m = signal_dbm + 20 * math.log10(frequence_mhz) + 77.2 - gain_antenne_dbi
    return 10 ** ((e_dbuv_m - 120) / 20)


def fourchette_champ(e: float) -> tuple[float, float]:
    """Fourchette plausible autour d'une estimation, compte tenu de l'incertitude (±10 dB)."""
    facteur = 10 ** (INCERTITUDE_DB / 20)
    return e / facteur, e * facteur


def limite_v_m(frequence_mhz: float) -> float:
    """Valeur limite d'exposition du public (décret français 2002-775, = ICNIRP 1998)."""
    if frequence_mhz < 400:
        return 28.0
    if frequence_mhz < 2000:
        return 1.375 * math.sqrt(frequence_mhz)
    return 61.0


def cumul_v_m(champs: list[float]) -> float:
    """Les puissances s'additionnent : E_total = √(ΣE²)."""
    return math.sqrt(sum(e * e for e in champs))


def formater_nombre(x: float) -> str:
    """Écriture française : 1 234 et 0,18."""
    if x >= 100:
        return f"{x:,.0f}".replace(",", " ")
    if x >= 10:
        texte = f"{x:.0f}"
    elif x >= 1:
        texte = f"{x:.1f}"
    elif x >= 0.01:
        texte = f"{x:.2f}"
    else:
        texte = f"{x:.3f}"
    return texte.replace(".", ",")


def formater_v_m(e: float) -> str:
    return f"{formater_nombre(e)} V/m"


def formater_mhz(f: float) -> str:
    return f"{f:g}".replace(".", ",") + "\u00a0MHz"
