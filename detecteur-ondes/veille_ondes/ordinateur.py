"""Contrôle de l'ordinateur lui-même : prise de contrôle à distance, ports ouverts, démarrage.

La façon la plus courante de « pirater » l'ordinateur d'un particulier n'est pas
radio : c'est un logiciel de prise en main à distance installé (souvent lors
d'une arnaque au faux support technique) ou un mot de passe volé.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

from .systeme import executer, nom_os

# nom de processus (sans .exe, en minuscules) -> (nom lisible, intégré au système ?)
OUTILS_ACCES_DISTANT = {
    "teamviewer": ("TeamViewer", False),
    "teamviewer_service": ("TeamViewer", False),
    "anydesk": ("AnyDesk", False),
    "rustdesk": ("RustDesk", False),
    "ultraviewer": ("UltraViewer", False),
    "ultraviewer_service": ("UltraViewer", False),
    "winvnc": ("VNC (UltraVNC / TightVNC)", False),
    "tvnserver": ("TightVNC", False),
    "vncserver": ("VNC", False),
    "vncserver-x11": ("RealVNC", False),
    "x11vnc": ("VNC (x11vnc)", False),
    "remoting_host": ("Bureau à distance Chrome", False),
    "screenconnect.clientservice": ("ScreenConnect (ConnectWise)", False),
    "screenconnect.windowsclient": ("ScreenConnect (ConnectWise)", False),
    "connectwisecontrol.client": ("ScreenConnect (ConnectWise)", False),
    "logmein": ("LogMeIn", False),
    "lmiguardian": ("LogMeIn", False),
    "srservice": ("Splashtop", False),
    "strwinclt": ("Splashtop", False),
    "supremo": ("Supremo", False),
    "supremoservice": ("Supremo", False),
    "dwagent": ("DWService", False),
    "parsecd": ("Parsec", False),
    "ateraagent": ("Atera", False),
    "meshagent": ("MeshCentral", False),
    "rutserv": ("Remote Utilities", False),
    "rfusclient": ("Remote Utilities", False),
    "rserver3": ("Radmin", False),
    "aa_v3": ("Ammyy Admin", False),
    "action1_agent": ("Action1", False),
    "ninjarmmagent": ("NinjaOne", False),
    "client32": ("NetSupport Manager", False),
    "getscreen": ("Getscreen.me", False),
    "quickassist": ("Assistance rapide Windows", True),
    "msra": ("Assistance à distance Windows", True),
    "screensharingd": ("Partage d'écran macOS", True),
    "ardagent": ("Gestion à distance macOS (Apple Remote Desktop)", True),
    "sshd": ("Serveur SSH", True),
}

# port TCP -> service de prise de contrôle à distance
PORTS_ACCES_DISTANT = {
    22: "SSH (connexion à distance en ligne de commande)",
    3389: "Bureau à distance Windows (RDP)",
    5900: "VNC / partage d'écran",
    5901: "VNC / partage d'écran",
    5902: "VNC / partage d'écran",
    5938: "TeamViewer",
    7070: "AnyDesk (connexion directe)",
    21115: "RustDesk", 21116: "RustDesk", 21117: "RustDesk", 21118: "RustDesk", 21119: "RustDesk",
}


def normaliser_nom_processus(nom: str) -> str:
    n = re.split(r"[\\/]", nom.strip())[-1].lower()
    return n[:-4] if n.endswith(".exe") else n


def outil_acces_distant(nom_processus: str) -> tuple[str, bool] | None:
    return OUTILS_ACCES_DISTANT.get(normaliser_nom_processus(nom_processus))


def chercher_outils_dans_texte(texte: str) -> list[str]:
    """Repère le nom d'un outil de prise de contrôle à distance dans un texte (programme au démarrage...)."""
    t = texte.lower()
    trouves = []
    for cle, (nom, integre) in OUTILS_ACCES_DISTANT.items():
        if integre or len(cle) < 5:
            continue
        if re.search(rf"(?<![a-z0-9]){re.escape(cle)}(?![a-z0-9])", t) and nom not in trouves:
            trouves.append(nom)
    return trouves


# --- processus -----------------------------------------------------------------

def analyser_tasklist(texte: str) -> list[dict]:
    """Analyse « tasklist /fo csv /nh » (Windows)."""
    processus = []
    for ligne in texte.splitlines():
        champs = re.findall(r'"([^"]*)"', ligne)
        if len(champs) >= 2 and champs[1].isdigit():
            processus.append({"pid": int(champs[1]), "nom": champs[0]})
    return processus


def analyser_ps(texte: str) -> list[dict]:
    """Analyse « ps -axo pid=,comm= » (macOS / Linux)."""
    processus = []
    for ligne in texte.splitlines():
        m = re.match(r"\s*(\d+)\s+(.+)$", ligne)
        if m:
            processus.append({"pid": int(m.group(1)), "nom": os.path.basename(m.group(2).strip())})
    return processus


def lister_processus() -> list[dict]:
    try:
        import psutil
        liste = []
        for p in psutil.process_iter(["pid", "name", "exe"]):
            liste.append({"pid": p.info["pid"], "nom": p.info["name"] or "", "chemin": p.info.get("exe") or ""})
        return liste
    except ImportError:
        pass
    if nom_os() == "windows":
        return analyser_tasklist(executer(["tasklist", "/fo", "csv", "/nh"]).sortie)
    return analyser_ps(executer(["ps", "-axo", "pid=,comm="]).sortie)


# --- connexions réseau ------------------------------------------------------------

def lister_connexions(noms: dict[int, str]) -> tuple[list[dict], str | None]:
    try:
        import psutil
    except ImportError:
        return [], "module psutil absent : connexions réseau non vérifiées"
    paires = []
    remarque = None
    try:
        paires = [(c, c.pid) for c in psutil.net_connections(kind="inet")]
    except psutil.AccessDenied:
        # macOS sans droits administrateur : on passe processus par processus
        remarque = "certaines connexions de processus système ne sont visibles qu'en administrateur"
        for p in psutil.process_iter():
            try:
                methode = getattr(p, "net_connections", None) or p.connections
                paires += [(c, p.pid) for c in methode(kind="inet")]
            except (psutil.AccessDenied, psutil.NoSuchProcess, psutil.ZombieProcess):
                continue
    connexions = []
    for c, pid in paires:
        if not c.laddr:
            continue
        connexions.append({
            "pid": pid,
            "processus": noms.get(pid, "?") if pid else "?",
            "local": f"{c.laddr.ip}:{c.laddr.port}",
            "port_local": c.laddr.port,
            "ip_locale": c.laddr.ip,
            "distant": f"{c.raddr.ip}:{c.raddr.port}" if c.raddr else "",
            "etat": c.status,
        })
    return connexions, remarque


def est_boucle_locale(ip: str) -> bool:
    return ip.startswith("127.") or ip in ("::1", "localhost")


# --- programmes lancés au démarrage --------------------------------------------------

def _demarrage_windows() -> list[str]:
    r = executer(["powershell", "-NoProfile", "-NonInteractive", "-Command",
                  "Get-CimInstance Win32_StartupCommand | Select-Object Name,Command,Location "
                  "| ConvertTo-Json -Compress"], delai=60)
    try:
        donnees = json.loads(r.sortie) if r.sortie.strip() else []
    except json.JSONDecodeError:
        return []
    if isinstance(donnees, dict):
        donnees = [donnees]
    return [f"{d.get('Name', '')} — {d.get('Command', '')}" for d in donnees if isinstance(d, dict)]


def _demarrage_mac() -> list[str]:
    elements = []
    for dossier in (Path.home() / "Library/LaunchAgents", Path("/Library/LaunchAgents"),
                    Path("/Library/LaunchDaemons")):
        try:
            elements += [f"{dossier}/{f.name}" for f in sorted(dossier.iterdir()) if f.suffix == ".plist"]
        except OSError:
            continue
    return elements


def _demarrage_linux() -> list[str]:
    elements = []
    autostart = Path.home() / ".config/autostart"
    try:
        elements += [f"autostart : {f.name}" for f in sorted(autostart.glob("*.desktop"))]
    except OSError:
        pass
    r = executer(["systemctl", "--user", "list-unit-files", "--state=enabled", "--no-legend"])
    if r.ok:
        elements += [f"service utilisateur : {ligne.split()[0]}" for ligne in r.sortie.splitlines() if ligne.strip()]
    r = executer(["crontab", "-l"])
    if r.ok:
        elements += [f"tâche planifiée : {ligne}" for ligne in r.sortie.splitlines()
                     if ligne.strip() and not ligne.lstrip().startswith("#")]
    return elements


def lister_demarrage() -> list[str]:
    systeme = nom_os()
    if systeme == "windows":
        return _demarrage_windows()
    if systeme == "mac":
        return _demarrage_mac()
    if systeme == "linux":
        return _demarrage_linux()
    return []


def etat_antivirus_windows() -> dict | None:
    r = executer(["powershell", "-NoProfile", "-NonInteractive", "-Command",
                  "Get-MpComputerStatus | Select-Object AMServiceEnabled,AntivirusEnabled,"
                  "RealTimeProtectionEnabled | ConvertTo-Json -Compress"], delai=60)
    try:
        donnees = json.loads(r.sortie)
    except (json.JSONDecodeError, TypeError):
        return None
    return donnees if isinstance(donnees, dict) else None


# --- point d'entrée ----------------------------------------------------------------------

def scanner() -> dict:
    processus = lister_processus()
    noms = {p["pid"]: p["nom"] for p in processus}

    outils_actifs: dict[str, dict] = {}
    for p in processus:
        trouve = outil_acces_distant(p["nom"])
        if trouve:
            nom, integre = trouve
            e = outils_actifs.setdefault(nom, {"nom": nom, "integre": integre, "processus": []})
            e["processus"].append(f"{p['nom']} (pid {p['pid']})")

    connexions, remarque = lister_connexions(noms)
    ecoute = [c for c in connexions if c["etat"] == "LISTEN"]
    ports_distants = []
    for c in ecoute:
        if c["port_local"] in PORTS_ACCES_DISTANT and not est_boucle_locale(c["ip_locale"]):
            ports_distants.append({**c, "service": PORTS_ACCES_DISTANT[c["port_local"]]})
    etablies = [c for c in connexions if c["etat"] == "ESTABLISHED" and c["distant"]]

    demarrage = lister_demarrage()
    outils_demarrage = sorted({nom for ligne in demarrage for nom in chercher_outils_dans_texte(ligne)})

    resultat = {
        "ok": True,
        "nb_processus": len(processus),
        "outils_acces_distant": list(outils_actifs.values()),
        "outils_au_demarrage": outils_demarrage,
        "ports_acces_distant": ports_distants,
        "ecoute": [{"processus": c["processus"], "local": c["local"]} for c in ecoute],
        "connexions_etablies": [{"processus": c["processus"], "distant": c["distant"]} for c in etablies],
        "demarrage": demarrage,
        "remarque": remarque,
    }
    if nom_os() == "windows":
        resultat["antivirus_windows"] = etat_antivirus_windows()
    return resultat
