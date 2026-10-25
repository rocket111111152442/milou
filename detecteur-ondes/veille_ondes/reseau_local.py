"""Liste des appareils connectés au même réseau (box) que l'ordinateur.

Un appareil inconnu sur votre réseau est l'un des rares signes concrets qu'une
autre personne utilise votre Wi-Fi. Le balayage n'envoie de paquets qu'aux
adresses de votre propre réseau local, jamais vers Internet.
"""

from __future__ import annotations

import ipaddress
import re
import socket
import time

from .systeme import executer, nom_os

_RE_IPV4 = r"(\d{1,3}(?:\.\d{1,3}){3})"
_RE_MAC = r"([0-9A-Fa-f]{1,2}(?:[:-][0-9A-Fa-f]{1,2}){5})"


def normaliser_mac(mac: str) -> str:
    morceaux = re.split(r"[:-]", mac.strip())
    return ":".join(m.zfill(2) for m in morceaux).lower()


def mac_aleatoire(mac: str) -> bool:
    """Adresse « privée » tirée au hasard (iPhone et Android le font par défaut) : c'est normal."""
    return int(normaliser_mac(mac)[1], 16) & 0x2 == 0x2


def _a_garder(ip: str, mac: str) -> bool:
    try:
        adresse = ipaddress.IPv4Address(ip)
    except ipaddress.AddressValueError:
        return False
    if adresse.is_multicast or adresse.is_unspecified or ip.endswith(".255"):
        return False
    premier_octet = int(normaliser_mac(mac)[:2], 16)
    if premier_octet & 0x1:  # adresse de groupe (multicast / diffusion)
        return False
    return normaliser_mac(mac) != "00:00:00:00:00:00"


def analyser_arp_windows(texte: str) -> list[dict]:
    appareils = []
    for ligne in texte.splitlines():
        m = re.match(rf"\s*{_RE_IPV4}\s+{_RE_MAC}\s+", ligne)
        if m and _a_garder(m.group(1), m.group(2)):
            appareils.append({"ip": m.group(1), "mac": normaliser_mac(m.group(2))})
    return appareils


def analyser_arp_mac(texte: str) -> list[dict]:
    appareils = []
    for ligne in texte.splitlines():
        m = re.search(rf"\({_RE_IPV4}\) at {_RE_MAC}", ligne)
        if m and _a_garder(m.group(1), m.group(2)):
            appareils.append({"ip": m.group(1), "mac": normaliser_mac(m.group(2))})
    return appareils


def analyser_ip_neigh(texte: str) -> list[dict]:
    appareils = []
    for ligne in texte.splitlines():
        m = re.match(rf"\s*{_RE_IPV4}\s.*\blladdr\s+{_RE_MAC}", ligne)
        if m and "FAILED" not in ligne and _a_garder(m.group(1), m.group(2)):
            appareils.append({"ip": m.group(1), "mac": normaliser_mac(m.group(2))})
    return appareils


def analyser_passerelle(texte: str, systeme: str) -> str | None:
    if systeme == "windows":
        m = re.search(rf"^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+{_RE_IPV4}", texte, re.M)
    elif systeme == "mac":
        m = re.search(rf"gateway:\s*{_RE_IPV4}", texte)
    else:
        m = re.search(rf"default via {_RE_IPV4}", texte)
    return m.group(1) if m else None


def adresse_locale() -> tuple[str | None, int]:
    """Adresse IPv4 de l'ordinateur sur le réseau local et longueur du masque.

    Le « connect » d'une socket UDP ne transmet rien : il demande seulement au
    système quelle interface il utiliserait.
    """
    ip = None
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("192.0.2.1", 9))
            ip = s.getsockname()[0]
    except OSError:
        return None, 24
    prefixe = 24
    try:
        import psutil
        for adresses in psutil.net_if_addrs().values():
            for a in adresses:
                if a.family == socket.AF_INET and a.address == ip and a.netmask:
                    prefixe = ipaddress.IPv4Network(f"0.0.0.0/{a.netmask}").prefixlen
    except Exception:
        pass
    return ip, prefixe


def balayer(ip: str, prefixe: int) -> int:
    """Envoie un petit paquet UDP vide à chaque adresse du réseau local.

    Le seul but est d'obliger l'ordinateur à demander « qui a cette adresse ? »,
    pour que les appareils présents apparaissent dans sa table ARP.
    Limité à 254 adresses (un réseau domestique classique).
    """
    reseau = ipaddress.IPv4Network(f"{ip}/{max(prefixe, 24)}", strict=False)
    if not reseau.is_private:
        return 0
    n = 0
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.setblocking(False)
        for hote in reseau.hosts():
            if str(hote) == ip:
                continue
            try:
                s.sendto(b"", (str(hote), 9))
                n += 1
            except OSError:
                pass
            time.sleep(0.005)
    time.sleep(3)
    return n


def scanner(balayage: bool = True) -> dict:
    systeme = nom_os()
    ip, prefixe = adresse_locale()
    if ip is None or ip.startswith("127."):
        return {"ok": False, "appareils": [], "erreur": "L'ordinateur n'est connecté à aucun réseau local."}
    if balayage:
        balayer(ip, prefixe)

    if systeme == "windows":
        appareils = analyser_arp_windows(executer(["arp", "-a"]).sortie)
        passerelle = analyser_passerelle(executer(["route", "print", "-4", "0.0.0.0"]).sortie, systeme)
    elif systeme == "mac":
        appareils = analyser_arp_mac(executer(["arp", "-an"]).sortie)
        passerelle = analyser_passerelle(executer(["route", "-n", "get", "default"]).sortie, systeme)
    else:
        r = executer(["ip", "-4", "neigh", "show"])
        appareils = analyser_ip_neigh(r.sortie) if r.ok else analyser_arp_mac(executer(["arp", "-an"]).sortie)
        passerelle = analyser_passerelle(executer(["ip", "route", "show", "default"]).sortie, systeme)

    reseau = ipaddress.IPv4Network(f"{ip}/{prefixe}", strict=False)
    uniques: dict[str, dict] = {}
    for a in appareils:
        if ipaddress.IPv4Address(a["ip"]) not in reseau:
            continue
        a["passerelle"] = a["ip"] == passerelle
        a["mac_aleatoire"] = mac_aleatoire(a["mac"])
        uniques[a["mac"]] = a
    liste = sorted(uniques.values(), key=lambda a: ipaddress.IPv4Address(a["ip"]))
    return {"ok": True, "appareils": liste, "mon_ip": ip, "reseau": str(reseau), "passerelle": passerelle,
            "balayage": balayage}
