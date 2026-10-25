"""Inventaire des réseaux Wi-Fi visibles depuis l'ordinateur.

La carte Wi-Fi ne voit que les bandes Wi-Fi (2,4 GHz, 5 GHz et 6 GHz si elle
est compatible). Elle ne voit ni la 4G/5G, ni les autres émissions radio.
"""

from __future__ import annotations

import json
import re
import time
import unicodedata
from dataclasses import asdict, dataclass

from .systeme import executer, nom_os


@dataclass
class ReseauWifi:
    ssid: str
    bssid: str | None = None
    signal_dbm: float | None = None
    signal_sature: bool = False  # au plafond de l'échelle : le signal réel peut être plus fort
    canal: int | None = None
    frequence_mhz: int | None = None
    bande: str | None = None
    securite: str = ""
    ouvert: bool = False
    connecte: bool = False


# --- conversions -------------------------------------------------------------

def pourcentage_windows_vers_dbm(pourcentage: int) -> tuple[float, bool]:
    """Windows : 0 % = -100 dBm, 100 % = -50 dBm, linéaire entre les deux."""
    p = max(0, min(100, pourcentage))
    return p / 2 - 100, p >= 100


def qualite_networkmanager_vers_dbm(qualite: int) -> tuple[float, bool]:
    """NetworkManager : 0 = -100 dBm, 100 = -40 dBm, linéaire entre les deux."""
    q = max(0, min(100, qualite))
    return -40 - 0.6 * (100 - q), q >= 100


def bande_depuis_texte(texte: str) -> str | None:
    t = texte.replace(",", ".").lower()
    if "2.4" in t or re.search(r"\b2\s*ghz", t):
        return "2,4 GHz"
    if re.search(r"\b6\s*ghz", t):
        return "6 GHz"
    if re.search(r"\b5\s*ghz", t):
        return "5 GHz"
    return None


def bande_depuis_frequence(mhz: int) -> str | None:
    if 2400 <= mhz < 2500:
        return "2,4 GHz"
    if 5150 <= mhz < 5900:
        return "5 GHz"
    if 5925 <= mhz <= 7125:
        return "6 GHz"
    return None


def frequence_depuis_canal(canal: int | None, bande: str | None) -> int | None:
    if canal is None:
        return None
    if bande is None:
        bande = "2,4 GHz" if canal <= 14 else "5 GHz"
    if bande == "2,4 GHz":
        return 2484 if canal == 14 else 2407 + 5 * canal
    if bande == "5 GHz":
        return 5000 + 5 * canal
    if bande == "6 GHz":
        return 5950 + 5 * canal
    return None


def _normaliser_cle(cle: str) -> str:
    sans_accents = unicodedata.normalize("NFKD", cle).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", sans_accents.lower())


def securite_est_ouverte(texte: str) -> bool:
    t = _normaliser_cle(texte)
    return t in ("", "open", "ouvert", "ouverte", "ouvrir", "none", "aucun", "aucune") or t.endswith("none")


def _completer(r: ReseauWifi) -> ReseauWifi:
    if r.bande is None and r.frequence_mhz:
        r.bande = bande_depuis_frequence(r.frequence_mhz)
    if r.frequence_mhz is None:
        r.frequence_mhz = frequence_depuis_canal(r.canal, r.bande)
    if r.bande is None and r.frequence_mhz:
        r.bande = bande_depuis_frequence(r.frequence_mhz)
    return r


# --- Windows : netsh -----------------------------------------------------------

_RE_SSID = re.compile(r"^\s*SSID\s+\d+\s*:\s?(.*)$")
_RE_BSSID = re.compile(r"^\s*BSSID\s+\d+\s*:\s*([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5})")
_CLES_AUTH = {"authentication", "authentification"}
_CLES_CHIFFREMENT = {"encryption", "chiffrement", "cipher"}
_CLES_BANDE = {"band", "bande"}
_CLES_CANAL = {"channel", "canal"}


def analyser_netsh(texte: str) -> list[ReseauWifi]:
    """Analyse « netsh wlan show networks mode=bssid » (Windows en français ou en anglais)."""
    reseaux: list[ReseauWifi] = []
    ssid: str | None = None
    auth = chiffrement = ""
    courant: ReseauWifi | None = None
    for ligne in texte.splitlines():
        m = _RE_SSID.match(ligne)
        if m:
            ssid, auth, chiffrement, courant = m.group(1).strip(), "", "", None
            continue
        m = _RE_BSSID.match(ligne)
        if m and ssid is not None:
            securite = " / ".join(x for x in (auth, chiffrement) if x)
            courant = ReseauWifi(ssid=ssid, bssid=m.group(1).lower(), securite=securite,
                                 ouvert=securite_est_ouverte(auth))
            reseaux.append(courant)
            continue
        if ":" not in ligne or ssid is None:
            continue
        cle, _, valeur = ligne.partition(":")
        cle, valeur = _normaliser_cle(cle), valeur.strip()
        if courant is None:
            if cle in _CLES_AUTH:
                auth = valeur
            elif cle in _CLES_CHIFFREMENT:
                chiffrement = valeur
            continue
        if cle == "signal":
            m = re.search(r"(\d+)\s*%", valeur)
            if m:
                courant.signal_dbm, courant.signal_sature = pourcentage_windows_vers_dbm(int(m.group(1)))
        elif cle in _CLES_BANDE:
            courant.bande = bande_depuis_texte(valeur)
        elif cle in _CLES_CANAL:
            m = re.match(r"(\d+)", valeur)
            if m:
                courant.canal = int(m.group(1))
    return [_completer(r) for r in reseaux]


def analyser_netsh_interfaces(texte: str) -> tuple[str | None, str | None]:
    """Réseau auquel l'ordinateur est connecté, d'après « netsh wlan show interfaces »."""
    ssid = bssid = None
    for ligne in texte.splitlines():
        if ":" not in ligne:
            continue
        cle, _, valeur = ligne.partition(":")
        cle = _normaliser_cle(cle)
        if cle == "ssid" and ssid is None:
            ssid = valeur.strip()
        elif cle == "bssid" and bssid is None:
            m = re.search(r"[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5}", ligne)
            if m:
                bssid = m.group(0).lower()
    return ssid, bssid


def _forcer_scan_windows() -> None:
    """Demande à Windows de rafraîchir la liste des réseaux (API WlanScan).

    netsh n'affiche que le dernier balayage, qui peut dater d'une minute ou plus.
    Si quoi que ce soit échoue ici, on continue simplement avec ce qu'affiche netsh.
    """
    try:
        import ctypes
        from ctypes import wintypes

        class GUID(ctypes.Structure):
            _fields_ = [("Data1", wintypes.DWORD), ("Data2", wintypes.WORD),
                        ("Data3", wintypes.WORD), ("Data4", ctypes.c_ubyte * 8)]

        class WLAN_INTERFACE_INFO(ctypes.Structure):
            _fields_ = [("InterfaceGuid", GUID), ("strInterfaceDescription", ctypes.c_wchar * 256),
                        ("isState", ctypes.c_uint)]

        class WLAN_INTERFACE_INFO_LIST(ctypes.Structure):
            _fields_ = [("dwNumberOfItems", wintypes.DWORD), ("dwIndex", wintypes.DWORD),
                        ("InterfaceInfo", WLAN_INTERFACE_INFO * 1)]

        wlan = ctypes.windll.wlanapi
        version = wintypes.DWORD()
        poignee = wintypes.HANDLE()
        if wlan.WlanOpenHandle(2, None, ctypes.byref(version), ctypes.byref(poignee)) != 0:
            return
        try:
            liste = ctypes.POINTER(WLAN_INTERFACE_INFO_LIST)()
            if wlan.WlanEnumInterfaces(poignee, None, ctypes.byref(liste)) != 0:
                return
            try:
                n = liste.contents.dwNumberOfItems
                tableau = ctypes.cast(ctypes.byref(liste.contents.InterfaceInfo),
                                      ctypes.POINTER(WLAN_INTERFACE_INFO * n)).contents
                for interface in tableau:
                    wlan.WlanScan(poignee, ctypes.byref(interface.InterfaceGuid), None, None, None)
            finally:
                wlan.WlanFreeMemory(liste)
        finally:
            wlan.WlanCloseHandle(poignee, None)
        time.sleep(4)  # le balayage prend quelques secondes
    except Exception:
        return


def _message_erreur_windows(texte: str) -> str:
    t = _normaliser_cle(texte)
    if "location" in t or "localisation" in t or "emplacement" in t:
        return ("Windows bloque la liste des réseaux Wi-Fi tant que la localisation est désactivée. "
                "Ouvrez Paramètres > Confidentialité et sécurité > Localisation, activez « Services de "
                "localisation » et « Autoriser les applications de bureau à accéder à votre position », "
                "puis relancez l'analyse.")
    if "wlansvc" in t or "autoconfig" in t:
        return "Le service Wi-Fi de Windows (WLAN AutoConfig) ne tourne pas."
    if "interface" in t:
        return "Aucune carte Wi-Fi n'a été trouvée sur cet ordinateur (ou elle est désactivée)."
    return "netsh n'a renvoyé aucun réseau. Sortie : " + texte.strip()[:300]


def _scanner_windows() -> dict:
    _forcer_scan_windows()
    r = executer(["netsh", "wlan", "show", "networks", "mode=bssid"])
    reseaux = analyser_netsh(r.sortie)
    if not reseaux:
        return {"ok": False, "erreur": _message_erreur_windows(r.sortie + r.erreurs), "reseaux": []}
    ri = executer(["netsh", "wlan", "show", "interfaces"])
    ssid_connecte, bssid_connecte = analyser_netsh_interfaces(ri.sortie)
    for res in reseaux:
        if bssid_connecte and res.bssid == bssid_connecte:
            res.connecte = True
        elif not bssid_connecte and ssid_connecte and res.ssid == ssid_connecte:
            res.connecte = True
    return {"ok": True, "reseaux": reseaux, "source": "netsh"}


# --- Linux : nmcli --------------------------------------------------------------

def _decouper_nmcli(ligne: str) -> list[str]:
    morceaux = re.split(r"(?<!\\):", ligne)
    return [m.replace("\\:", ":").replace("\\\\", "\\") for m in morceaux]


def analyser_nmcli(texte: str) -> list[ReseauWifi]:
    """Analyse « nmcli -t -f IN-USE,SSID,BSSID,CHAN,FREQ,SIGNAL,SECURITY dev wifi list »."""
    reseaux = []
    for ligne in texte.splitlines():
        champs = _decouper_nmcli(ligne)
        if len(champs) < 7:
            continue
        en_cours, ssid, bssid, canal, freq, signal, securite = champs[:7]
        r = ReseauWifi(ssid="" if ssid == "--" else ssid, bssid=bssid.lower() or None,
                       securite="" if securite == "--" else securite,
                       ouvert=securite_est_ouverte("" if securite == "--" else securite),
                       connecte=en_cours.strip() == "*")
        if canal.strip().isdigit():
            r.canal = int(canal)
        m = re.match(r"(\d+)", freq.strip())
        if m:
            r.frequence_mhz = int(m.group(1))
        if signal.strip().isdigit():
            r.signal_dbm, r.signal_sature = qualite_networkmanager_vers_dbm(int(signal))
        reseaux.append(_completer(r))
    return reseaux


def _scanner_linux() -> dict:
    champs = "IN-USE,SSID,BSSID,CHAN,FREQ,SIGNAL,SECURITY"
    r = executer(["nmcli", "-t", "-f", champs, "device", "wifi", "list", "--rescan", "yes"], delai=45)
    if not r.ok:
        r = executer(["nmcli", "-t", "-f", champs, "device", "wifi", "list"])
    if r.code == 127:
        return {"ok": False, "reseaux": [],
                "erreur": "nmcli (NetworkManager) est introuvable : impossible de lister les réseaux Wi-Fi."}
    reseaux = analyser_nmcli(r.sortie)
    if not reseaux:
        return {"ok": False, "reseaux": [],
                "erreur": "Aucun réseau listé (carte Wi-Fi absente ou désactivée ?). " + r.erreurs.strip()[:200]}
    return {"ok": True, "reseaux": reseaux, "source": "nmcli"}


# --- macOS : system_profiler ------------------------------------------------------

def _reseaux_macos(objet):
    if isinstance(objet, dict):
        for cle, valeur in objet.items():
            if cle == "spairport_airport_other_local_wireless_networks" and isinstance(valeur, list):
                for n in valeur:
                    yield n, False
            elif cle == "spairport_current_network_information" and isinstance(valeur, dict):
                yield valeur, True
            else:
                yield from _reseaux_macos(valeur)
    elif isinstance(objet, list):
        for x in objet:
            yield from _reseaux_macos(x)


def analyser_system_profiler(texte_json: str) -> list[ReseauWifi]:
    """Analyse « system_profiler SPAirPortDataType -json » (macOS)."""
    try:
        donnees = json.loads(texte_json)
    except (json.JSONDecodeError, TypeError):
        return []
    reseaux = []
    for n, connecte in _reseaux_macos(donnees):
        if not isinstance(n, dict):
            continue
        canal_txt = str(n.get("spairport_network_channel", ""))
        m = re.match(r"\s*(\d+)", canal_txt)
        mode = str(n.get("spairport_security_mode", ""))
        securite = mode.replace("spairport_security_mode_", "").replace("pairport_security_mode_", "")
        securite = securite.replace("_", " ").upper() if securite else ""
        r = ReseauWifi(ssid=str(n.get("_name", "")), bssid=(n.get("spairport_network_bssid") or None),
                       canal=int(m.group(1)) if m else None, bande=bande_depuis_texte(canal_txt),
                       securite=securite, ouvert=securite_est_ouverte(securite), connecte=connecte)
        m = re.search(r"(-?\d+)\s*dBm", str(n.get("spairport_signal_noise", "")))
        if m:
            r.signal_dbm = float(m.group(1))
        reseaux.append(_completer(r))
    return reseaux


def _scanner_mac() -> dict:
    r = executer(["system_profiler", "SPAirPortDataType", "-json"], delai=60)
    reseaux = analyser_system_profiler(r.sortie)
    if not reseaux:
        return {"ok": False, "reseaux": [], "erreur": "macOS n'a renvoyé aucun réseau Wi-Fi (Wi-Fi désactivé ?)."}
    resultat = {"ok": True, "reseaux": reseaux, "source": "system_profiler"}
    if any(x.ssid in ("<redacted>", "") for x in reseaux):
        resultat["remarque"] = ("macOS masque certains noms de réseaux : autorisez le Terminal dans Réglages "
                                "Système > Confidentialité et sécurité > Service de localisation.")
    return resultat


# --- point d'entrée -----------------------------------------------------------------

def scanner() -> dict:
    systeme = nom_os()
    if systeme == "windows":
        resultat = _scanner_windows()
    elif systeme == "linux":
        resultat = _scanner_linux()
    elif systeme == "mac":
        resultat = _scanner_mac()
    else:
        resultat = {"ok": False, "reseaux": [], "erreur": "Système non pris en charge pour le Wi-Fi."}
    resultat["reseaux"] = [asdict(r) for r in resultat["reseaux"]]
    return resultat
