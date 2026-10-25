"""Inventaire des appareils Bluetooth Low Energy (BLE) qui émettent autour de l'ordinateur.

Seul le Bluetooth « basse consommation » est écouté : c'est celui des montres,
écouteurs, téléphones et traceurs (AirTag, SmartTag, Tile...). Le Bluetooth
« classique » (vieux kits mains libres, enceintes) n'est visible que lorsqu'il
est en mode appairage.
"""

from __future__ import annotations

import asyncio
import importlib.util

# Identifiants de fabricant attribués par le Bluetooth SIG (liste courte, volontairement limitée
# aux valeurs dont on est sûr).
FABRICANTS = {
    0x004C: "Apple",
    0x0006: "Microsoft",
    0x0075: "Samsung",
    0x00E0: "Google",
    0x0087: "Garmin",
    0x0059: "Nordic Semiconductor (puce utilisée par de nombreux objets)",
    0x02E5: "Espressif (puce utilisée par de nombreux objets connectés)",
    0x012D: "Sony",
    0x009E: "Bose",
    0x038F: "Xiaomi",
    0x0171: "Amazon",
    0x0157: "Huami (Amazfit / Mi Band)",
}

# Types de messages Apple (premier octet des données fabricant 0x004C).
TYPES_APPLE = {
    0x02: "Balise iBeacon",
    0x05: "AirDrop",
    0x07: "Écouteurs Apple / Beats (AirPods…)",
    0x09: "Appareil AirPlay (Apple TV, enceinte…)",
    0x0C: "Handoff (iPhone, iPad, Mac)",
    0x0F: "Action à proximité (iPhone, iPad, Mac)",
    0x10: "iPhone, iPad, Mac ou Apple Watch",
}

UUID_SAMSUNG_SMARTTAG = "fd5a"
UUIDS_TILE = ("feed", "feec")
UUID_GOOGLE_EDDYSTONE = "feaa"
UUID_DULT = "fcb2"  # protocole commun Apple/Google de détection de traceurs indésirables


def uuid_court(uuid: str) -> str:
    """'0000fd5a-0000-1000-8000-00805f9b34fb' -> 'fd5a'."""
    u = uuid.lower()
    if len(u) == 36 and u.startswith("0000") and u.endswith("-0000-1000-8000-00805f9b34fb"):
        return u[4:8]
    return u


def classer(fabricants: dict[int, bytes], services: list[str], donnees_service: dict[str, bytes],
            nom: str | None = None) -> dict:
    """Identifie, autant que possible, le type d'appareil à partir de son annonce BLE.

    "traceur" : appareil conçu pour être localisé (AirTag, SmartTag, Tile…).
    "traceur_separe" : il signale lui-même être loin de son propriétaire, ce qui est
    le cas d'un traceur oublié, perdu… ou caché sur quelqu'un.
    """
    services_courts = {uuid_court(u) for u in services} | {uuid_court(u) for u in donnees_service}
    donnees_courtes = {uuid_court(u): v for u, v in donnees_service.items()}
    resultat = {"fabricant": None, "type": "Appareil non identifié", "traceur": False,
                "traceur_separe": False}

    for identifiant in fabricants:
        if identifiant in FABRICANTS:
            resultat["fabricant"] = FABRICANTS[identifiant]
            break

    apple = fabricants.get(0x004C)
    if apple:
        type_apple = apple[0]
        if type_apple == 0x12:
            resultat["traceur"] = True
            if len(apple) >= 2 and apple[1] >= 0x19:
                resultat["traceur_separe"] = True
                resultat["type"] = ("Réseau Localiser d'Apple, séparé de son propriétaire "
                                    "(AirTag, AirPods ou accessoire Localiser)")
            else:
                resultat["type"] = "Réseau Localiser d'Apple, près de son propriétaire"
        else:
            resultat["type"] = TYPES_APPLE.get(type_apple, "Appareil Apple")
        return resultat

    if UUID_SAMSUNG_SMARTTAG in services_courts:
        resultat.update(fabricant="Samsung", type="Traceur Samsung Galaxy SmartTag", traceur=True)
        return resultat
    if any(u in services_courts for u in UUIDS_TILE):
        resultat.update(fabricant="Tile", type="Traceur Tile", traceur=True)
        return resultat
    if UUID_GOOGLE_EDDYSTONE in donnees_courtes:
        trame = donnees_courtes[UUID_GOOGLE_EDDYSTONE][:1]
        if trame in (b"\x40", b"\x41"):
            resultat.update(fabricant=resultat["fabricant"] or "Réseau Localiser de Google",
                            type="Traceur du réseau Localiser de Google (Find Hub)", traceur=True,
                            traceur_separe=trame == b"\x41")
        else:
            resultat["type"] = "Balise Eddystone (balise publicitaire ou d'intérieur)"
        return resultat
    if UUID_DULT in services_courts:
        resultat.update(type="Traceur compatible avec la détection de traceurs indésirables", traceur=True)
        return resultat

    if 0x0006 in fabricants:
        resultat["type"] = "Appareil Windows / Microsoft (PC, souris, manette Xbox…)"
    elif nom:
        resultat["type"] = "Appareil nommé (voir le nom)"
    return resultat


async def _ecouter(duree: float) -> dict[str, dict]:
    from bleak import BleakScanner

    vus: dict[str, dict] = {}

    def rappel(appareil, annonce):
        e = vus.setdefault(appareil.address, {
            "adresse": appareil.address, "nom": None, "rssi_max": None, "nb_annonces": 0,
            "fabricants": {}, "services": set(), "donnees_service": {},
        })
        e["nb_annonces"] += 1
        e["nom"] = annonce.local_name or appareil.name or e["nom"]
        if annonce.rssi is not None and (e["rssi_max"] is None or annonce.rssi > e["rssi_max"]):
            e["rssi_max"] = annonce.rssi
        e["fabricants"].update(annonce.manufacturer_data or {})
        e["services"].update(annonce.service_uuids or [])
        e["donnees_service"].update(annonce.service_data or {})

    async with BleakScanner(detection_callback=rappel):
        await asyncio.sleep(duree)
    return vus


def scanner(duree: float = 15.0) -> dict:
    if importlib.util.find_spec("bleak") is None:
        return {"ok": False, "appareils": [],
                "erreur": "Le module « bleak » n'est pas installé (relancez le lanceur, ou : pip install bleak)."}
    try:
        vus = asyncio.run(_ecouter(duree))
    except Exception as e:  # bleak lève des erreurs différentes selon le système
        message = str(e) or e.__class__.__name__
        return {"ok": False, "appareils": [],
                "erreur": f"Bluetooth indisponible (désactivé ou absent ?) : {message}"}

    appareils = []
    for e in vus.values():
        info = classer(e["fabricants"], sorted(e["services"]), e["donnees_service"], e["nom"])
        appareils.append({
            "adresse": e["adresse"], "nom": e["nom"], "rssi_max": e["rssi_max"],
            "nb_annonces": e["nb_annonces"], **info,
            "ids_fabricants": [f"0x{i:04X}" for i in e["fabricants"]],
            "services": sorted(uuid_court(u) for u in e["services"]),
        })
    appareils.sort(key=lambda a: a["rssi_max"] if a["rssi_max"] is not None else -999, reverse=True)
    return {"ok": True, "appareils": appareils, "duree_s": duree}
