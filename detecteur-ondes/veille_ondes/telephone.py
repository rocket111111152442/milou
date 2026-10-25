"""Analyse d'un téléphone Android branché en USB (outil officiel « adb » de Google).

Ce qui est cherché : les signes d'un logiciel espion (« stalkerware »), qui sont
toujours les mêmes car ces applications ont besoin de droits puissants :
- installation hors des magasins d'applications ;
- service d'accessibilité (lit tout ce qui s'affiche à l'écran) ;
- administrateur de l'appareil (empêche la désinstallation) ;
- accès aux notifications (lit les messages reçus) ;
- pas d'icône dans la liste des applications ;
- micro, caméra, position, SMS, journal d'appels.
S'y ajoute la comparaison avec la liste publique des logiciels espions connus
(association Echap, licence CC BY 4.0).

Un iPhone ne peut pas être inspecté de cette façon : voir le guide du rapport.
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

from .systeme import chercher_outil, executer

FICHIER_INDICATEURS = Path(__file__).resolve().parent / "indicateurs" / "logiciels_espions.json"
URL_INDICATEURS = "https://raw.githubusercontent.com/AssoEchap/stalkerware-indicators/master/"

MAGASINS = {
    "com.android.vending": "Google Play",
    "com.google.android.feedback": "Google Play",
    "com.sec.android.app.samsungapps": "Galaxy Store",
    "com.huawei.appmarket": "AppGallery (Huawei)",
    "com.amazon.venezia": "Amazon Appstore",
    "com.xiaomi.market": "GetApps (Xiaomi)",
    "com.xiaomi.mipicks": "GetApps (Xiaomi)",
    "com.heytap.market": "App Market (Oppo)",
    "com.oppo.market": "App Market (Oppo)",
    "com.bbk.appstore": "V-Appstore (vivo)",
    "org.fdroid.fdroid": "F-Droid",
}

PERMISSIONS_SENSIBLES = {
    "android.permission.RECORD_AUDIO": "micro",
    "android.permission.CAMERA": "caméra",
    "android.permission.ACCESS_FINE_LOCATION": "position précise",
    "android.permission.ACCESS_BACKGROUND_LOCATION": "position en arrière-plan",
    "android.permission.READ_SMS": "lecture des SMS",
    "android.permission.RECEIVE_SMS": "réception des SMS",
    "android.permission.READ_CALL_LOG": "journal d'appels",
    "android.permission.READ_CONTACTS": "contacts",
    "android.permission.PROCESS_OUTGOING_CALLS": "appels sortants",
}


# --- outil adb ----------------------------------------------------------------------

def trouver_adb() -> str | None:
    return chercher_outil("adb")


def analyser_adb_devices(texte: str) -> list[tuple[str, str]]:
    appareils = []
    for ligne in texte.splitlines():
        m = re.match(r"^(\S+)\s+(device|unauthorized|offline|recovery|sideload|no permissions.*)$", ligne.strip())
        if m:
            appareils.append((m.group(1), m.group(2)))
    return appareils


def _shell(adb: str, serie: str, commande: str, delai: float = 90):
    return executer([adb, "-s", serie, "shell", commande], delai=delai)


# --- analyse des sorties ---------------------------------------------------------------

def analyser_liste_paquets(texte: str) -> dict[str, str | None]:
    """« pm list packages -3 -i » -> {paquet: installateur}."""
    paquets = {}
    for ligne in texte.splitlines():
        m = re.match(r"^package:(\S+)(?:\s+installer=(\S+))?", ligne.strip())
        if m:
            installateur = m.group(2)
            paquets[m.group(1)] = None if installateur in (None, "null") else installateur
    return paquets


def analyser_composants(valeur: str) -> set[str]:
    """« pkg/classe:pkg2/classe2 » (paramètres Android) -> {pkg, pkg2}."""
    valeur = valeur.strip()
    if not valeur or valeur == "null":
        return set()
    return {morceau.split("/")[0] for morceau in valeur.split(":") if "/" in morceau}


def analyser_administrateurs(texte: str) -> set[str]:
    """Applications administrateur de l'appareil, d'après « dumpsys device_policy »."""
    admins = set(re.findall(r"ComponentInfo\{([\w.]+)/", texte))
    retrait_section = None
    for ligne in texte.splitlines():
        retrait = len(ligne) - len(ligne.lstrip())
        if "Enabled Device Admins" in ligne:
            retrait_section = retrait
            continue
        if retrait_section is None:
            continue
        if ligne.strip() and retrait <= retrait_section:
            retrait_section = None
            continue
        m = re.match(r"^\s+([A-Za-z][\w.]+)/[\w.$]+:\s*$", ligne)
        if m:
            admins.add(m.group(1))
    return admins


def analyser_dumpsys_paquets(texte: str) -> dict[str, dict]:
    """« dumpsys package packages » -> {paquet: {permissions, installe_le, etat}}."""
    infos: dict[str, dict] = {}
    courant = None
    for ligne in texte.splitlines():
        m = re.match(r"^\s*Package \[([^\]]+)\]", ligne)
        if m:
            courant = infos.setdefault(m.group(1), {"permissions": set(), "installe_le": None, "desactive": False})
            continue
        if courant is None:
            continue
        m = re.match(r"^\s*firstInstallTime=(\S+)", ligne)
        if m:
            courant["installe_le"] = m.group(1)
            continue
        m = re.match(r"^\s*(android\.permission\.[A-Z_]+): granted=true", ligne)
        if m:
            courant["permissions"].add(m.group(1))
            continue
        m = re.search(r"\bUser 0:.*\benabled=(\d)", ligne)
        if m:
            courant["desactive"] = m.group(1) in ("2", "3")
    return infos


def analyser_lanceurs(texte: str) -> set[str]:
    """Applications qui ont une icône dans la liste des applications."""
    paquets = set()
    for ligne in texte.splitlines():
        if "=" in ligne:
            continue
        for m in re.finditer(r"\b([A-Za-z][\w]*(?:\.[\w]+)+)/[\w.$]+", ligne):
            paquets.add(m.group(1))
    return paquets


def jours_depuis(date_iso: str, aujourd_hui: date | None = None) -> int | None:
    try:
        d = date.fromisoformat(date_iso.strip()[:10])
    except ValueError:
        return None
    return ((aujourd_hui or date.today()) - d).days


# --- liste des logiciels espions connus --------------------------------------------------------

def charger_indicateurs(dossier_donnees: Path | None = None) -> dict:
    """Liste Echap ; une version mise à jour par l'utilisateur (dossier donnees) est prioritaire."""
    for fichier in ((dossier_donnees / "logiciels_espions.json") if dossier_donnees else None, FICHIER_INDICATEURS):
        if fichier and fichier.exists():
            try:
                return json.loads(fichier.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
    return {"entrees": []}


def index_indicateurs(indicateurs: dict) -> dict[str, dict]:
    return {p: {"nom": e["nom"], "type": e["type"]} for e in indicateurs.get("entrees", []) for p in e["paquets"]}


def convertir_yaml_echap(texte: str) -> list[dict]:
    """Lecture minimale des fichiers ioc.yaml / watchware.yaml d'Echap (sans dépendance)."""
    entrees, courant, cle = [], None, None
    for ligne in texte.splitlines():
        m = re.match(r"^- name:\s*(.+?)\s*$", ligne)
        if m:
            courant = {"nom": m.group(1).strip("'\""), "type": "", "paquets": []}
            entrees.append(courant)
            cle = None
            continue
        if courant is None:
            continue
        m = re.match(r"^  ([a-z_]+):\s*(.*?)\s*$", ligne)
        if m:
            cle = m.group(1)
            if cle == "type":
                courant["type"] = m.group(2)
            continue
        m = re.match(r"^  - (\S+)\s*$", ligne)
        if m and cle == "packages":
            courant["paquets"].append(m.group(1).strip("'\""))
    return [e for e in entrees if e["paquets"]]


def mettre_a_jour_indicateurs(dossier_donnees: Path) -> int:
    """Télécharge la dernière liste Echap (seule connexion Internet du logiciel, à la demande)."""
    from urllib.request import urlopen

    entrees = []
    for fichier in ("ioc.yaml", "watchware.yaml"):
        with urlopen(URL_INDICATEURS + fichier, timeout=60) as reponse:
            entrees += convertir_yaml_echap(reponse.read().decode("utf-8"))
    if not entrees:
        raise ValueError("liste téléchargée vide ou illisible")
    dossier_donnees.mkdir(parents=True, exist_ok=True)
    doc = {"source": "https://github.com/AssoEchap/stalkerware-indicators", "auteur": "Echap et contributeurs",
           "licence": "CC BY 4.0", "extrait_le": date.today().isoformat(), "entrees": entrees}
    (dossier_donnees / "logiciels_espions.json").write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
    return sum(len(e["paquets"]) for e in entrees)


# --- évaluation d'une application ---------------------------------------------------------------

def evaluer_application(paquet: str, installateur: str | None, accessibilite: bool, administrateur: bool,
                        notifications: bool, icone: bool | None, permissions: set[str],
                        connu: dict | None) -> dict:
    """Note de suspicion d'une application installée par l'utilisateur.

    Chaque indice seul a souvent une explication banale (gestionnaire de mots de
    passe, appli de montre connectée…). C'est leur accumulation qui est suspecte.
    """
    raisons, score = [], 0
    magasin = MAGASINS.get(installateur or "")
    if not magasin:
        score += 3
        raisons.append("installée hors magasin d'applications")
    if accessibilite:
        score += 2
        raisons.append("service d'accessibilité actif (peut lire l'écran)")
    if administrateur:
        score += 2
        raisons.append("administrateur de l'appareil (bloque la désinstallation)")
    if notifications:
        score += 1
        raisons.append("lit les notifications")
    if icone is False:
        score += 2
        raisons.append("pas d'icône dans la liste des applications")
    sensibles = sorted(PERMISSIONS_SENSIBLES[p] for p in permissions if p in PERMISSIONS_SENSIBLES)
    if len(sensibles) >= 3:
        score += 1
    if sensibles:
        raisons.append("accès : " + ", ".join(sensibles))

    if connu and connu["type"] == "stalkerware":
        niveau = "important"
        raisons.insert(0, f"logiciel espion connu : {connu['nom']}")
    elif connu:
        niveau = "a_verifier"
        raisons.insert(0, f"logiciel de surveillance déclaré (contrôle parental…) : {connu['nom']}")
    elif score >= 5:
        niveau = "important"
    elif score >= 3:
        niveau = "a_verifier"
    else:
        niveau = "normal"
    return {"paquet": paquet, "installateur": installateur, "magasin": magasin, "niveau": niveau, "score": score,
            "raisons": raisons, "acces_puissant": accessibilite or administrateur or notifications,
            "connu": connu}


# --- point d'entrée -------------------------------------------------------------------------------

def scanner(dossier_donnees: Path | None = None, serie: str | None = None) -> dict:
    adb = trouver_adb()
    if not adb:
        return {"ok": False, "disponible": False,
                "erreur": "L'outil adb est introuvable. Téléchargez les « SDK Platform-Tools » de Google "
                          "(gratuit) et décompressez-les dans le dossier « outils » du logiciel (voir MATERIEL.md)."}
    appareils = analyser_adb_devices(executer([adb, "devices"], delai=30).sortie)
    if serie:
        appareils = [a for a in appareils if a[0] == serie]
    if not appareils:
        return {"ok": False, "erreur": "Aucun téléphone détecté. Branchez-le avec un câble de données, activez le "
                                       "« Débogage USB » (options pour les développeurs) et déverrouillez l'écran."}
    serie, etat = appareils[0]
    if etat != "device":
        return {"ok": False, "erreur": f"Téléphone en état « {etat} » : sur l'écran du téléphone, acceptez "
                                       f"« Autoriser le débogage USB » puis relancez l'analyse."}

    def prop(nom: str) -> str:
        return _shell(adb, serie, f"getprop {nom}").sortie.strip()

    infos = {
        "serie": serie,
        "fabricant": prop("ro.product.manufacturer"),
        "modele": prop("ro.product.model"),
        "android": prop("ro.build.version.release"),
        "correctif_securite": prop("ro.build.version.security_patch"),
        "root": bool(_shell(adb, serie, "which su").sortie.strip()),
    }
    tiers = analyser_liste_paquets(_shell(adb, serie, "pm list packages -3 -i").sortie)
    tous = set(analyser_liste_paquets(_shell(adb, serie, "pm list packages").sortie)) | set(tiers)
    accessibilite = analyser_composants(_shell(adb, serie, "settings get secure enabled_accessibility_services").sortie)
    notifications = analyser_composants(_shell(adb, serie, "settings get secure enabled_notification_listeners").sortie)
    administrateurs = analyser_administrateurs(_shell(adb, serie, "dumpsys device_policy").sortie)
    details = analyser_dumpsys_paquets(_shell(adb, serie, "dumpsys package packages", delai=180).sortie)
    r = _shell(adb, serie, "cmd package query-activities --brief -a android.intent.action.MAIN "
                           "-c android.intent.category.LAUNCHER")
    lanceurs = analyser_lanceurs(r.sortie) if r.ok and "/" in r.sortie else None
    r = _shell(adb, serie, "cmd appops query-op --user 0 REQUEST_INSTALL_PACKAGES allow")
    installeurs = sorted(set(re.findall(r"[A-Za-z][\w]*(?:\.[\w]+)+", r.sortie)) & tous) if r.ok else []

    connus = index_indicateurs(charger_indicateurs(dossier_donnees))
    applications = []
    for paquet, installateur in sorted(tiers.items()):
        d = details.get(paquet, {"permissions": set(), "installe_le": None, "desactive": False})
        app = evaluer_application(
            paquet, installateur, paquet in accessibilite, paquet in administrateurs, paquet in notifications,
            None if lanceurs is None else paquet in lanceurs, d["permissions"], connus.get(paquet))
        app["installe_le"] = d["installe_le"]
        app["desactive"] = d["desactive"]
        applications.append(app)
    # un logiciel espion connu peut aussi être installé comme application système (téléphone rooté)
    systeme_connus = [{"paquet": p, **connus[p]} for p in sorted(tous - set(tiers)) if p in connus]

    applications.sort(key=lambda a: ({"important": 0, "a_verifier": 1}.get(a["niveau"], 2), -a["score"], a["paquet"]))
    return {
        "ok": True, "appareil": infos, "nb_applications": len(tous), "applications": applications,
        "connus_systeme": systeme_connus, "autorises_a_installer": installeurs,
        "icones_verifiees": lanceurs is not None,
        "indicateurs": {"nb_paquets": len(connus)},
    }


# --- actions sur une application -------------------------------------------------------------------

def agir(action: str, paquet: str, serie: str | None = None) -> tuple[bool, str]:
    """Désactive, réactive ou désinstalle une application installée par l'utilisateur.

    Par sécurité, seules les applications non système peuvent être touchées.
    """
    adb = trouver_adb()
    if not adb:
        return False, "outil adb introuvable"
    appareils = [a for a in analyser_adb_devices(executer([adb, "devices"]).sortie) if a[1] == "device"]
    if serie:
        appareils = [a for a in appareils if a[0] == serie]
    if not appareils:
        return False, "aucun téléphone autorisé n'est branché"
    serie = appareils[0][0]
    if not re.fullmatch(r"[A-Za-z][\w]*(\.[\w]+)+", paquet):
        return False, "nom d'application invalide"
    if paquet not in analyser_liste_paquets(_shell(adb, serie, "pm list packages -3").sortie):
        return False, "cette application n'est pas une application installée par l'utilisateur : refusé par sécurité"
    commandes = {
        "desactiver": f"pm disable-user --user 0 {paquet}",
        "reactiver": f"pm enable {paquet}",
        "desinstaller": f"pm uninstall --user 0 {paquet}",
    }
    if action not in commandes:
        return False, "action inconnue"
    r = _shell(adb, serie, commandes[action])
    sortie = (r.sortie + r.erreurs).strip()
    if re.search(r"(?i)device_policy|device admin|active admin", sortie):
        return False, ("Android refuse car l'application est administrateur de l'appareil. Sur le téléphone : "
                       "Paramètres > Sécurité > Applis d'administration de l'appareil, décochez-la, puis recommencez.")
    reussi = r.ok and ("Success" in sortie or "new state" in sortie)
    return reussi, sortie or "aucune réponse"
