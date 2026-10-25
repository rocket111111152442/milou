"""Balayage radio large bande avec un récepteur optionnel (voir MATERIEL.md).

Trois récepteurs sont pris en charge :
- clé RTL-SDR : 24 à 1 766 MHz, niveaux relatifs (non calibrés) ;
- HackRF One : 1 MHz à 6 GHz, niveaux relatifs (non calibrés) ;
- analyseur de spectre tinySA Ultra : jusqu'à environ 5,3 GHz, niveaux en dBm
  (étalonnés par le fabricant), ce qui permet une estimation du champ en V/m.

Seuls HackRF et tinySA Ultra couvrent la bande 2,4 GHz, celle des fours à
micro-ondes (2 450 MHz), du Wi-Fi et du Bluetooth.
"""

from __future__ import annotations

import math
import shutil
import statistics
import tempfile
from pathlib import Path

from .exposition import champ_v_m
from .systeme import executer, nom_os

# (début MHz, fin MHz, nom, explication). Les bandes étroites passent avant les larges.
BANDES = [
    (433.05, 434.79, "ISM 433 MHz", "télécommandes de portail/voiture, stations météo, sonnettes, capteurs"),
    (446.0, 446.2, "PMR446", "talkies-walkies grand public"),
    (169.4, 169.8, "Télé-relève 169 MHz", "compteurs communicants d'eau et de gaz (Gazpar…)"),
    (863.0, 870.0, "Objets connectés 868 MHz", "alarmes, domotique, capteurs, réseaux LoRa / Sigfox"),
    (1088.0, 1092.0, "ADS-B 1090 MHz", "transpondeurs des avions"),
    (26.96, 27.41, "CB 27 MHz", "radio cibiste"),
    (40.66, 40.70, "ISM 40 MHz", "télécommandes, modélisme"),
    (87.5, 108.0, "Radio FM", "stations de radio FM"),
    (108.0, 137.0, "Aviation", "balises et communications aéronautiques"),
    (137.0, 138.0, "Satellites météo", "satellites en orbite basse"),
    (144.0, 146.0, "Radioamateurs 2 m", "radioamateurs"),
    (146.0, 174.0, "VHF professionnelle / marine", "taxis, entreprises, ports, services techniques"),
    (174.0, 240.0, "DAB+", "radio numérique terrestre"),
    (380.0, 400.0, "Réseaux de sécurité", "radios des pompiers, police, SAMU"),
    (400.0, 470.0, "UHF professionnelle / radioamateurs", "radios professionnelles, radioamateurs 430-440 MHz"),
    (470.0, 694.0, "TNT", "télévision numérique terrestre"),
    (694.0, 790.0, "Téléphonie mobile 700 MHz", "antennes relais et téléphones 4G/5G"),
    (790.0, 862.0, "Téléphonie mobile 800 MHz", "antennes relais et téléphones 4G"),
    (870.0, 960.0, "Téléphonie mobile 900 MHz", "antennes relais et téléphones 2G/3G/4G, GSM-R ferroviaire"),
    (960.0, 1215.0, "Radionavigation aérienne", "balises DME et radars secondaires des aéroports"),
    (1215.0, 1300.0, "Radiolocalisation / GNSS L2", "radars, satellites de navigation, radioamateurs"),
    (1427.0, 1518.0, "Bande L", "téléphonie mobile complémentaire, liaisons"),
    (1518.0, 1559.0, "Satellites (bande L)", "communications par satellite"),
    (1559.0, 1610.0, "GPS / Galileo", "satellites de navigation (normalement sous le bruit)"),
    (1710.0, 1785.0, "Téléphonie mobile 1800 MHz", "téléphones 4G (sens montant)"),
    (1805.0, 1880.0, "Téléphonie mobile 1800 MHz", "antennes relais 4G"),
    (1880.0, 1900.0, "DECT", "téléphones fixes sans fil et leurs bases"),
    (1920.0, 1980.0, "Téléphonie mobile 2100 MHz", "téléphones 3G/4G/5G (sens montant)"),
    (2110.0, 2170.0, "Téléphonie mobile 2100 MHz", "antennes relais 3G/4G/5G"),
    (2400.0, 2500.0, "Bande 2,4 GHz", "Wi-Fi, Bluetooth, fours à micro-ondes, babyphones, caméras sans fil"),
    (2500.0, 2690.0, "Téléphonie mobile 2600 MHz", "antennes relais et téléphones 4G"),
    (3400.0, 3800.0, "5G 3,5 GHz", "antennes relais et téléphones 5G"),
    (5150.0, 5350.0, "Wi-Fi 5 GHz", "box, répéteurs, ordinateurs"),
    (5470.0, 5725.0, "Wi-Fi 5 GHz", "box, répéteurs, ordinateurs"),
    (5725.0, 5875.0, "Bande 5,8 GHz", "Wi-Fi, caméras sans fil, drones"),
]

BANDE_MICRO_ONDES = (2400.0, 2500.0)
OUTILS = Path(__file__).resolve().parent.parent / "outils"
IDS_USB_TINYSA = {(0x0483, 0x5740)}

PAS_ARTEFACT_MHZ = 28.8  # fréquence de l'oscillateur de la clé RTL-SDR


def identifier_bande(f_mhz: float) -> tuple[str, str] | None:
    for debut, fin, nom, explication in BANDES:
        if debut <= f_mhz <= fin:
            return nom, explication
    return None


def _trouver_programme(nom: str) -> str | None:
    chemin = shutil.which(nom)
    if chemin:
        return chemin
    executable = nom + (".exe" if nom_os() == "windows" else "")
    for candidat in (OUTILS / executable, OUTILS / nom / executable):
        if candidat.exists():
            return str(candidat)
    return None


def trouver_rtl_power() -> str | None:
    return _trouver_programme("rtl_power")


def trouver_hackrf() -> str | None:
    return _trouver_programme("hackrf_sweep")


def trouver_tinysa() -> str | None:
    """Port série d'un tinySA branché en USB (nécessite le module pyserial)."""
    try:
        from serial.tools import list_ports
    except ImportError:
        return None
    for port in list_ports.comports():
        if (port.vid, port.pid) in IDS_USB_TINYSA:
            return port.device
    return None


def materiels_disponibles() -> list[str]:
    """Récepteurs détectés, du plus utile au moins utile."""
    trouves = []
    if trouver_tinysa():
        trouves.append("tinysa")
    if trouver_hackrf():
        trouves.append("hackrf")
    if trouver_rtl_power():
        trouves.append("rtlsdr")
    return trouves


def lire_csv_rtl_power(texte: str, combiner: str = "moyenne") -> list[tuple[float, float]]:
    """Lit un CSV de rtl_power ou hackrf_sweep (même format) : [(fréquence MHz, niveau dB)] triés.

    Format d'une ligne : date, heure, Hz bas, Hz haut, pas Hz, nb échantillons, dB, dB, ...
    Si plusieurs balayages sont présents, les niveaux sont moyennés, ou on garde le
    maximum (combiner="max"), utile pour ne pas rater un émetteur intermittent.
    """
    cumul: dict[float, list[float]] = {}
    for ligne in texte.splitlines():
        champs = [c.strip() for c in ligne.split(",")]
        if len(champs) < 7:
            continue
        try:
            bas, pas = float(champs[2]), float(champs[4])
            niveaux = [float(x) for x in champs[6:] if x not in ("", "nan", "-nan")]
        except ValueError:
            continue
        for i, db in enumerate(niveaux):
            f = round((bas + (i + 0.5) * pas) / 1e6, 4)
            cumul.setdefault(f, []).append(db)
    if combiner == "max":
        return sorted((f, max(v)) for f, v in cumul.items())
    return sorted((f, sum(v) / len(v)) for f, v in cumul.items())


def analyser_sortie_tinysa(texte: str) -> list[tuple[float, float]]:
    """Réponse à « scan début fin points 3 » : une ligne « fréquence(Hz) niveau(dBm) » par point."""
    points = []
    for ligne in texte.splitlines():
        morceaux = ligne.split()
        if len(morceaux) != 2:
            continue
        try:
            f_hz, dbm = float(morceaux[0]), float(morceaux[1])
        except ValueError:
            continue
        if f_hz > 1000 and -200 < dbm < 50:
            points.append((round(f_hz / 1e6, 4), dbm))
    return points


def resume_bande_micro_ondes(points: list[tuple[float, float]], absolu: bool) -> dict | None:
    """Niveau dans la bande 2,4-2,5 GHz (fours à micro-ondes, Wi-Fi, Bluetooth)."""
    debut, fin = BANDE_MICRO_ONDES
    dans = [(f, db) for f, db in points if debut <= f <= fin]
    if len(dans) < 3:
        return None
    f_max, db_max = max(dans, key=lambda x: x[1])
    resume = {"pic_mhz": round(f_max, 2), "max_db": round(db_max, 1), "absolu": absolu}
    if absolu:
        # somme des puissances de tous les points : borne haute de la puissance totale dans la bande
        total = 10 * math.log10(sum(10 ** (db / 10) for _, db in dans))
        resume["total_dbm"] = round(total, 1)
        resume["champ_v_m"] = champ_v_m(total, 2450)
    return resume


def detecter_emissions(points: list[tuple[float, float]], seuil_db: float = 10.0,
                       fenetre_mhz: float = 10.0, maximum: int = 40, artefacts_rtl: bool = True) -> list[dict]:
    """Repère les zones nettement au-dessus du bruit de fond local.

    Le bruit de fond d'une clé SDR varie avec la fréquence : on le calcule comme
    la médiane des niveaux à ±fenetre_mhz autour de chaque point.
    """
    if len(points) < 5:
        return []
    frequences = [f for f, _ in points]
    niveaux = [db for _, db in points]
    pas = statistics.median(b - a for a, b in zip(frequences, frequences[1:])) or 1.0
    ecart_max = max(pas * 1.5, 5.0)  # au-delà, ce sont deux zones de balayage différentes

    au_dessus = []
    debut = 0
    for i, f in enumerate(frequences):
        while frequences[debut] < f - fenetre_mhz:
            debut += 1
        fin = i
        while fin + 1 < len(frequences) and frequences[fin + 1] <= f + fenetre_mhz:
            fin += 1
        bruit = statistics.median(niveaux[debut:fin + 1])
        au_dessus.append((niveaux[i] - bruit, bruit))

    segments: list[dict] = []
    courant = None
    for i, (f, db) in enumerate(points):
        exces, bruit = au_dessus[i]
        if exces >= seuil_db:
            if courant and f - courant["fin_mhz"] <= ecart_max:
                courant["fin_mhz"] = f
                if exces > courant["exces_db"]:
                    courant.update(pic_mhz=f, niveau_db=db, exces_db=exces)
            else:
                courant = {"debut_mhz": f, "fin_mhz": f, "pic_mhz": f, "niveau_db": db, "exces_db": exces}
                segments.append(courant)
        else:
            courant = None

    for s in segments:
        bande = identifier_bande(s["pic_mhz"])
        s["bande"], s["explication"] = bande if bande else (None, None)
        reste = s["pic_mhz"] % PAS_ARTEFACT_MHZ
        s["artefact_possible"] = (artefacts_rtl and min(reste, PAS_ARTEFACT_MHZ - reste) < 0.3
                                  and s["fin_mhz"] - s["debut_mhz"] <= pas * 2)
        for cle in ("debut_mhz", "fin_mhz", "pic_mhz", "niveau_db", "exces_db"):
            s[cle] = round(s[cle], 2)
    segments.sort(key=lambda s: s["exces_db"], reverse=True)
    return segments[:maximum]


def _balayage_rtl(programme: str) -> tuple[list[tuple[float, float]], str | None]:
    with tempfile.TemporaryDirectory() as dossier:
        sortie = Path(dossier) / "balayage.csv"
        r = executer([programme, "-f", "24M:1700M:500k", "-g", "30", "-i", "20", "-c", "20%", "-1", str(sortie)],
                     delai=320)
        if not sortie.exists():
            return [], "rtl_power n'a rien produit (clé branchée ? pilote installé ?) : " + (r.erreurs or r.sortie)[-300:]
        return lire_csv_rtl_power(sortie.read_text(encoding="utf-8", errors="replace")), None


def _balayage_hackrf(programme: str) -> tuple[list[tuple[float, float]], str | None]:
    with tempfile.TemporaryDirectory() as dossier:
        sortie = Path(dossier) / "balayage.csv"
        base = [programme, "-f", "0:6000", "-w", "1000000", "-l", "32", "-g", "20"]
        r = executer(base + ["-N", "8", "-r", str(sortie)], delai=180)
        if not sortie.exists() or not sortie.stat().st_size:
            r = executer(base + ["-1", "-r", str(sortie)], delai=180)  # anciennes versions sans -N
        if not sortie.exists():
            return [], ("hackrf_sweep n'a rien produit (HackRF branché ? pilote installé ?) : "
                        + (r.erreurs or r.sortie)[-300:])
        return lire_csv_rtl_power(sortie.read_text(encoding="utf-8", errors="replace"), combiner="max"), None


# (début Hz, fin Hz, nombre de passages) : la bande des micro-ondes est balayée plusieurs fois
# pour attraper un émetteur intermittent (un four fonctionne par impulsions).
ZONES_TINYSA = [
    (24_000_000, 800_000_000, 2),
    (800_000_000, 1_000_000_000, 2),
    (1_700_000_000, 2_200_000_000, 2),
    (2_400_000_000, 2_500_000_000, 6),
    (2_500_000_000, 2_700_000_000, 2),
    (3_300_000_000, 3_900_000_000, 2),
    (5_100_000_000, 5_300_000_000, 2),
]


def _balayage_tinysa(port: str) -> tuple[list[tuple[float, float]], str | None]:
    try:
        import serial
    except ImportError:
        return [], "module pyserial absent (relancez l'installation : pip install pyserial)"
    maximums: dict[float, float] = {}
    try:
        with serial.Serial(port, 115200, timeout=5) as s:
            def commande(texte: str, delai: float = 60.0) -> str:
                s.timeout = delai
                s.reset_input_buffer()
                s.write((texte + "\r").encode("ascii"))
                return s.read_until(b"ch> ").decode("ascii", errors="replace")

            commande("", 3)
            version = commande("version", 5)
            if "tinysa" not in version.lower():
                return [], f"l'appareil branché sur {port} ne répond pas comme un tinySA"
            # le tinySA de base (micrologiciel « tinySA_… ») s'arrête à 960 MHz ; les Ultra, Ultra+ (ZS-405,
            # ZS-406, ZS-407…) annoncent « tinySA4_… ». Dans le doute, on tente toute la plage.
            de_base = "tinysa_" in version.lower() and "tinysa4" not in version.lower()
            for debut, fin, passages in ZONES_TINYSA:
                if de_base:
                    if debut >= 960_000_000:
                        continue
                    fin = min(fin, 960_000_000)
                for _ in range(passages):
                    for f, dbm in analyser_sortie_tinysa(commande(f"scan {debut} {fin} 290 3")):
                        maximums[f] = max(dbm, maximums.get(f, -999.0))
    except (OSError, serial.SerialException) as e:
        return [], f"communication impossible avec le tinySA ({port}) : {e}"
    if not maximums:
        return [], "le tinySA n'a renvoyé aucune mesure (mode « ultra » activé pour aller au-delà de 800 MHz ?)"
    return sorted(maximums.items()), None


NOMS_MATERIELS = {"rtlsdr": "clé RTL-SDR", "hackrf": "HackRF One", "tinysa": "tinySA", "fichier": "fichier CSV"}


def scanner(fichier_csv: str | None = None, materiel: str = "auto") -> dict:
    """Lance un balayage avec le récepteur disponible (ou lit un CSV rtl_power / hackrf_sweep existant)."""
    if fichier_csv:
        try:
            texte = Path(fichier_csv).read_text(encoding="utf-8", errors="replace")
        except OSError as e:
            return {"ok": False, "erreur": f"Impossible de lire {fichier_csv} : {e}", "emissions": []}
        points, erreur, materiel, absolu = lire_csv_rtl_power(texte, combiner="max"), None, "fichier", False
    else:
        disponibles = materiels_disponibles()
        if materiel == "auto":
            materiel = disponibles[0] if disponibles else ""
        if not materiel or materiel not in disponibles:
            return {"ok": False, "disponible": False, "emissions": [],
                    "erreur": "Aucun récepteur radio branché (tinySA, HackRF ou clé RTL-SDR). "
                              "Voir MATERIEL.md : c'est un achat optionnel."}
        if materiel == "tinysa":
            points, erreur = _balayage_tinysa(trouver_tinysa())
        elif materiel == "hackrf":
            points, erreur = _balayage_hackrf(trouver_hackrf())
        else:
            points, erreur = _balayage_rtl(trouver_rtl_power())
        absolu = materiel == "tinysa"
    if erreur:
        return {"ok": False, "disponible": True, "emissions": [], "erreur": erreur}
    if not points:
        return {"ok": False, "emissions": [], "erreur": "Le balayage est vide ou illisible."}
    return {
        "ok": True, "source": NOMS_MATERIELS.get(materiel, materiel), "materiel": materiel, "absolu": absolu,
        "unite": "dBm" if absolu else "dB (relatif)",
        "plage_mhz": [points[0][0], points[-1][0]], "nb_points": len(points),
        "emissions": detecter_emissions(points, artefacts_rtl=materiel in ("rtlsdr", "fichier")),
        "micro_ondes": resume_bande_micro_ondes(points, absolu),
    }
