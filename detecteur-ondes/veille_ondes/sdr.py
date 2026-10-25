"""Balayage radio large bande avec un récepteur RTL-SDR (clé USB, achat optionnel).

C'est le seul moyen, avec ce logiciel, de voir les émissions hors Wi-Fi /
Bluetooth : radio FM, TNT, antennes 4G/5G, télécommandes 433 MHz, compteurs
communicants, alarmes 868 MHz, etc. Plage couverte : 24 MHz à 1 766 MHz.
Le Wi-Fi (2,4 / 5 GHz) et le Bluetooth sont HORS de cette plage.

Les niveaux affichés par une clé RTL-SDR sont RELATIFS (non calibrés) : ils
servent à repérer et comparer des émissions, pas à mesurer une exposition en V/m.
"""

from __future__ import annotations

import shutil
import statistics
import tempfile
from pathlib import Path

from .systeme import executer

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
]

PAS_ARTEFACT_MHZ = 28.8  # fréquence de l'oscillateur de la clé RTL-SDR


def identifier_bande(f_mhz: float) -> tuple[str, str] | None:
    for debut, fin, nom, explication in BANDES:
        if debut <= f_mhz <= fin:
            return nom, explication
    return None


def trouver_rtl_power() -> str | None:
    for nom in ("rtl_power", "rtl_power.exe"):
        chemin = shutil.which(nom)
        if chemin:
            return chemin
    locale = Path(__file__).resolve().parent.parent / "outils"
    for candidat in (locale / "rtl_power.exe", locale / "rtl_power"):
        if candidat.exists():
            return str(candidat)
    return None


def lire_csv_rtl_power(texte: str) -> list[tuple[float, float]]:
    """Lit un fichier CSV produit par rtl_power et renvoie [(fréquence MHz, niveau dB)] triés.

    Format d'une ligne : date, heure, Hz bas, Hz haut, pas Hz, nb échantillons, dB, dB, ...
    Si plusieurs balayages sont présents, les niveaux sont moyennés.
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
    return sorted((f, sum(v) / len(v)) for f, v in cumul.items())


def detecter_emissions(points: list[tuple[float, float]], seuil_db: float = 10.0,
                       fenetre_mhz: float = 10.0, maximum: int = 40) -> list[dict]:
    """Repère les zones nettement au-dessus du bruit de fond local.

    Le bruit de fond d'une clé SDR varie avec la fréquence : on le calcule comme
    la médiane des niveaux à ±fenetre_mhz autour de chaque point.
    """
    if len(points) < 5:
        return []
    frequences = [f for f, _ in points]
    niveaux = [db for _, db in points]
    pas = statistics.median(b - a for a, b in zip(frequences, frequences[1:])) or 1.0

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
            if courant and f - courant["fin_mhz"] <= pas * 1.5:
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
        s["artefact_possible"] = (min(reste, PAS_ARTEFACT_MHZ - reste) < 0.3
                                  and s["fin_mhz"] - s["debut_mhz"] <= pas * 2)
        for cle in ("debut_mhz", "fin_mhz", "pic_mhz", "niveau_db", "exces_db"):
            s[cle] = round(s[cle], 2)
    segments.sort(key=lambda s: s["exces_db"], reverse=True)
    return segments[:maximum]


def scanner(fichier_csv: str | None = None, debut_mhz: int = 24, fin_mhz: int = 1700,
            pas_khz: int = 500, integration_s: int = 20) -> dict:
    """Lance un balayage (ou lit un CSV rtl_power existant) et repère les émissions."""
    if fichier_csv:
        try:
            texte = Path(fichier_csv).read_text(encoding="utf-8", errors="replace")
        except OSError as e:
            return {"ok": False, "erreur": f"Impossible de lire {fichier_csv} : {e}", "emissions": []}
        source = fichier_csv
    else:
        programme = trouver_rtl_power()
        if not programme:
            return {"ok": False, "disponible": False, "emissions": [],
                    "erreur": "Aucun récepteur SDR configuré (programme rtl_power introuvable). "
                              "Voir MATERIEL.md : c'est un achat optionnel."}
        with tempfile.TemporaryDirectory() as dossier:
            sortie = Path(dossier) / "balayage.csv"
            r = executer([programme, "-f", f"{debut_mhz}M:{fin_mhz}M:{pas_khz}k", "-g", "30",
                          "-i", str(integration_s), "-c", "20%", "-1", str(sortie)],
                         delai=integration_s * 4 + 240)
            if not sortie.exists():
                message = (r.erreurs or r.sortie).strip()[-300:]
                return {"ok": False, "disponible": True, "emissions": [],
                        "erreur": f"rtl_power n'a rien produit (clé branchée ? pilote installé ?) : {message}"}
            texte = sortie.read_text(encoding="utf-8", errors="replace")
        source = "rtl_power"
    points = lire_csv_rtl_power(texte)
    if not points:
        return {"ok": False, "emissions": [], "erreur": "Le fichier de balayage est vide ou illisible."}
    return {
        "ok": True, "source": source,
        "plage_mhz": [points[0][0], points[-1][0]], "nb_points": len(points),
        "emissions": detecter_emissions(points),
    }
