"""Recherche de caméras : sur votre réseau, et parmi les réseaux Wi-Fi et Bluetooth visibles.

Ce que ce module PEUT trouver :
- une caméra connectée à votre box (elle répond aux protocoles vidéo RTSP / ONVIF,
  ou présente une page de connexion de caméra) ;
- une mini-caméra Wi-Fi qui crée son propre point d'accès (nom typique : « IPC… »,
  « HDWiFiCam », « V380 »…), même si elle n'est pas sur votre réseau.

Ce qu'il NE PEUT PAS trouver : une caméra qui enregistre sur carte mémoire, qui
utilise une carte SIM 4G, ou qui est éteinte. Pour celles-là, il faut une
inspection physique (voir le guide du rapport et MATERIEL.md).

Les sondes ne sont envoyées qu'aux adresses de votre réseau local.
"""

from __future__ import annotations

import re
import socket
import uuid
from concurrent.futures import ThreadPoolExecutor

MOTIF_NOM_CAMERA = re.compile(
    r"(?i)(?:^|[^a-z])(ip[-_ ]?cam|ipc|cam|camera|webcam|wifi[-_ ]?cam|hdwificam|lookcam|spy|dvr|nvr|v380|mv\+|"
    r"tapo[_ -]?c\d+|ezviz|wyze|reolink|hikvision|dahua|imou|blink)(?:[^a-z]|$)")

MOTIF_PAGE_CAMERA = re.compile(
    r"(?i)(ip ?cam|network camera|web ?cam|camera|hikvision|dahua|\bdvr\b|\bnvr\b|netsurveillance|netwave|"
    r"foscam|reolink|amcrest|vivotek|xmeye|onvif)")

PORTS = {
    554: "RTSP (flux vidéo)",
    8554: "RTSP (flux vidéo)",
    37777: "Dahua (caméras / enregistreurs)",
    34567: "XMEye (caméras / enregistreurs bas de gamme)",
    8000: "Hikvision (caméras / enregistreurs) ou autre service",
    6668: "Tuya (objet connecté : prise, ampoule ou caméra)",
    80: "page web",
    8080: "page web",
}
PORTS_FORTS = {37777, 34567}

SONDE_ONVIF = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" '
    'xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" '
    'xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" '
    'xmlns:dn="http://www.onvif.org/ver10/network/wsdl">'
    '<e:Header><w:MessageID>uuid:{id}</w:MessageID>'
    '<w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>'
    '<w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>'
    '</e:Header><e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>'
)


def nom_ressemble_a_camera(nom: str | None) -> bool:
    return bool(nom and MOTIF_NOM_CAMERA.search(nom))


# --- sondes réseau ------------------------------------------------------------------

def _port_ouvert(ip: str, port: int, delai: float = 0.6) -> bool:
    try:
        with socket.create_connection((ip, port), timeout=delai):
            return True
    except OSError:
        return False


def _demander(ip: str, port: int, requete: bytes, delai: float = 2.0) -> str:
    try:
        with socket.create_connection((ip, port), timeout=delai) as s:
            s.settimeout(delai)
            s.sendall(requete)
            morceaux, total = [], 0
            while total < 8192:
                donnees = s.recv(4096)
                if not donnees:
                    break
                morceaux.append(donnees)
                total += len(donnees)
            return b"".join(morceaux).decode("latin-1", errors="replace")
    except OSError:
        return ""


def analyser_reponse_http(texte: str) -> list[str]:
    """Extrait les éléments d'une réponse HTTP qui identifient une caméra."""
    indices = []
    serveur = re.search(r"(?im)^server:\s*(.+)$", texte)
    titre = re.search(r"(?is)<title>(.*?)</title>", texte)
    royaume = re.search(r'(?im)^www-authenticate:.*realm="([^"]*)"', texte)
    for libelle, m in (("serveur", serveur), ("titre de page", titre), ("authentification", royaume)):
        if m and MOTIF_PAGE_CAMERA.search(m.group(1)):
            indices.append(f"{libelle} « {m.group(1).strip()[:60]} »")
    return indices


def examiner_appareil(ip: str) -> dict:
    ouverts = [p for p in PORTS if _port_ouvert(ip, p)]
    resultat = {"ip": ip, "ports": ouverts, "rtsp": False, "indices_web": []}
    for port in (554, 8554):
        if port in ouverts:
            reponse = _demander(ip, port, f"OPTIONS rtsp://{ip}:{port}/ RTSP/1.0\r\nCSeq: 1\r\n\r\n".encode())
            if reponse.startswith("RTSP/1.0"):
                resultat["rtsp"] = True
    for port in (80, 8080):
        if port in ouverts:
            reponse = _demander(ip, port, f"GET / HTTP/1.0\r\nHost: {ip}\r\nUser-Agent: VeilleOndes\r\n\r\n".encode())
            resultat["indices_web"] += analyser_reponse_http(reponse)
    return resultat


def analyser_reponse_onvif(texte: str) -> dict:
    portees = re.findall(r"onvif://www\.onvif\.org/(name|hardware|location)/([^\s<]+)", texte)
    infos = {}
    for cle, valeur in portees:
        infos.setdefault(cle, re.sub(r"%20", " ", valeur))
    return infos


def decouverte_onvif(delai: float = 3.0) -> dict[str, dict]:
    """Envoie la requête standard « qui est une caméra ? » (WS-Discovery) sur le réseau local uniquement."""
    trouves: dict[str, dict] = {}
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP) as s:
            s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 1)  # ne sort pas du réseau local
            s.settimeout(delai)
            s.sendto(SONDE_ONVIF.format(id=uuid.uuid4()).encode(), ("239.255.255.250", 3702))
            while True:
                try:
                    donnees, (ip, _) = s.recvfrom(65535)
                except (socket.timeout, OSError):
                    break
                texte = donnees.decode("utf-8", errors="replace")
                if "ProbeMatch" in texte:
                    trouves[ip] = analyser_reponse_onvif(texte)
    except OSError:
        pass
    return trouves


# --- point d'entrée ----------------------------------------------------------------------

def scanner(reseau_local: dict | None, wifi: dict | None, bluetooth: dict | None) -> dict:
    resultat = {"ok": True, "reseau_verifie": False, "cameras_reseau": [], "autres_appareils_reseau": [],
                "wifi_cameras": [], "bluetooth_cameras": []}

    if wifi and wifi.get("ok"):
        resultat["wifi_cameras"] = [
            {"ssid": r["ssid"], "bssid": r.get("bssid"), "signal_dbm": r.get("signal_dbm")}
            for r in wifi["reseaux"] if nom_ressemble_a_camera(r.get("ssid"))]
    if bluetooth and bluetooth.get("ok"):
        resultat["bluetooth_cameras"] = [
            {"nom": a["nom"], "adresse": a["adresse"], "rssi_max": a.get("rssi_max")}
            for a in bluetooth["appareils"] if nom_ressemble_a_camera(a.get("nom"))]

    if not reseau_local or not reseau_local.get("ok") or not reseau_local.get("appareils"):
        resultat["erreur_reseau"] = "liste des appareils du réseau local indisponible"
        return resultat

    resultat["reseau_verifie"] = True
    appareils = {a["ip"]: a for a in reseau_local["appareils"]}
    onvif = decouverte_onvif()
    with ThreadPoolExecutor(max_workers=32) as pool:
        examens = list(pool.map(examiner_appareil, appareils))

    for ex in examens:
        a = appareils[ex["ip"]]
        indices = []
        if ex["ip"] in onvif:
            infos = onvif[ex["ip"]]
            details = ", ".join(f"{k} : {v}" for k, v in infos.items())
            indices.append("se déclare caméra (ONVIF)" + (f" — {details}" if details else ""))
        if ex["rtsp"]:
            indices.append("diffuse un flux vidéo (RTSP)")
        indices += [f"page de caméra ({x})" for x in ex["indices_web"]]
        indices += [f"port {p} : {PORTS[p]}" for p in ex["ports"] if p in PORTS_FORTS]

        fort = ex["ip"] in onvif or ex["indices_web"] or any(p in PORTS_FORTS for p in ex["ports"])
        if ex["rtsp"] and not a.get("passerelle"):
            fort = True
        entree = {"ip": ex["ip"], "mac": a["mac"], "passerelle": a.get("passerelle", False), "indices": indices,
                  "ports": ex["ports"]}
        if fort:
            resultat["cameras_reseau"].append(entree)
        elif ex["rtsp"] or 6668 in ex["ports"]:
            entree["remarque"] = ("box : diffusion de la télévision sur le réseau (normal, par exemple Freebox)"
                                  if a.get("passerelle") else
                                  "objet connecté Tuya / Smart Life : prise, ampoule… ou caméra")
            resultat["autres_appareils_reseau"].append(entree)
    resultat["onvif_hors_liste"] = [{"ip": ip, **infos} for ip, infos in onvif.items() if ip not in appareils]
    for x in resultat["onvif_hors_liste"]:
        resultat["cameras_reseau"].append({"ip": x["ip"], "mac": "?", "passerelle": False, "ports": [],
                                           "indices": ["se déclare caméra (ONVIF)"]})
    return resultat
