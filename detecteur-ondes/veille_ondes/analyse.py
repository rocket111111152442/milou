"""Interprétation des mesures : transforme les données brutes en constats objectifs.

Règle de conception : un constat « important » ou « à vérifier » doit
correspondre à quelque chose de concret et vérifiable. Tout ce qui est normal
est dit normal, avec l'explication, pour éviter les fausses alertes.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

from .exposition import (champ_v_m, cumul_v_m, formater_mhz, formater_nombre, formater_v_m, fourchette_champ,
                         limite_v_m)
from .ordinateur import OUTILS_ACCES_DISTANT
from .telephone import jours_depuis

ORDRE_NIVEAUX = {"important": 0, "a_verifier": 1, "normal": 2, "info": 3, "non_mesure": 4}
LIBELLES_NIVEAUX = {
    "important": "Important",
    "a_verifier": "À vérifier",
    "normal": "Normal",
    "info": "Information",
    "non_mesure": "Non mesuré",
}


@dataclass
class Constat:
    niveau: str
    domaine: str
    titre: str
    detail: str = ""
    action: str = ""


def _db(x: float) -> str:
    """Valeur en dB avec signe, écriture française : -72 ; -3,5."""
    return ("-" if x < 0 else "") + formater_nombre(abs(x))


def distance_approximative(rssi: float | None) -> str:
    if rssi is None:
        return "?"
    if rssi >= -55:
        return "très proche (1-2 m)"
    if rssi >= -70:
        return "quelques mètres"
    if rssi >= -85:
        return "plus loin / derrière un mur"
    return "loin"


def securite_obsolete(securite: str) -> bool:
    t = securite.lower()
    if "wep" in t:
        return True
    moderne = any(x in t for x in ("wpa2", "wpa3", "sae", "ccmp", "gcmp", "rsn", "owe"))
    return "wpa" in t and not moderne


def _octets_centraux(bssid: str) -> str:
    return ":".join(bssid.split(":")[1:5])


def mes_reseaux(wifi: dict, config: dict) -> set[str]:
    noms = set(config.get("mes_wifi", []))
    noms |= {r["ssid"] for r in wifi.get("reseaux", []) if r.get("connecte") and r.get("ssid")}
    return noms


def champ_total_wifi(reseaux: list[dict]) -> float | None:
    champs = [champ_v_m(r["signal_dbm"], r.get("frequence_mhz") or 2437)
              for r in reseaux if r.get("signal_dbm") is not None]
    return cumul_v_m(champs) if champs else None


# --- Wi-Fi -----------------------------------------------------------------------

def _wifi(wifi: dict, precedentes: list[dict], config: dict) -> list[Constat]:
    if not wifi.get("ok"):
        return [Constat("non_mesure", "Wi-Fi", "Wi-Fi non mesuré", wifi.get("erreur", ""))]
    constats = []
    reseaux = wifi["reseaux"]
    miens_noms = mes_reseaux(wifi, config)
    miens = [r for r in reseaux if r["ssid"] in miens_noms]
    voisins = [r for r in reseaux if r["ssid"] not in miens_noms]
    noms = {r["ssid"] for r in reseaux}

    constats.append(Constat(
        "normal", "Wi-Fi", f"{len(reseaux)} émetteurs Wi-Fi visibles ({len(noms)} noms de réseau)",
        "C'est normal : chaque box, répéteur, imprimante, télévision ou caméra diffuse son propre réseau, "
        "souvent sur 2,4 et 5 GHz à la fois. En immeuble, 10 à 60 émetteurs visibles est courant ; en maison "
        "isolée, quelques-uns. Un réseau Wi-Fi émet dans toutes les directions en permanence : voir celui "
        "d'un voisin ne signifie pas qu'il vise votre logement."))

    if not miens_noms:
        constats.append(Constat(
            "info", "Wi-Fi", "Votre propre Wi-Fi n'a pas été identifié",
            "L'ordinateur n'est pas connecté en Wi-Fi et aucun nom de réseau n'a été indiqué.",
            "Indiquez le nom de votre Wi-Fi dans le champ prévu : le logiciel pourra alors vérifier sa "
            "sécurité et repérer un éventuel faux réseau qui l'imite."))

    for nom in sorted(miens_noms):
        memes = [r for r in reseaux if r["ssid"] == nom]
        if not memes:
            continue
        if all(r["ouvert"] for r in memes):
            constats.append(Constat(
                "important", "Wi-Fi", f"Votre Wi-Fi « {nom} » n'a pas de mot de passe",
                "N'importe qui à portée peut s'y connecter et voir les autres appareils du réseau.",
                "Dans l'interface de votre box, activez la protection WPA2 ou WPA3 avec un mot de passe long."))
        elif any(securite_obsolete(r["securite"]) for r in memes if not r["ouvert"]):
            constats.append(Constat(
                "important", "Wi-Fi", f"Votre Wi-Fi « {nom} » utilise une protection obsolète",
                "Les protections WEP et WPA (première version) se cassent en quelques minutes.",
                "Dans l'interface de votre box, passez en WPA2 (AES) ou WPA3 et changez le mot de passe."))
        elif any(r["ouvert"] for r in memes):
            constats.append(Constat(
                "important", "Wi-Fi", f"Un réseau ouvert porte le même nom que votre Wi-Fi « {nom} »",
                "Un point d'accès sans mot de passe qui copie le nom d'un réseau existant est une technique "
                "d'attaque connue (« faux point d'accès »). Cela peut aussi être un réseau invité ou un "
                "répéteur mal configuré. Émetteurs ouverts : "
                + ", ".join(r["bssid"] or "?" for r in memes if r["ouvert"]),
                "Vérifiez dans votre box s'il existe un réseau invité ou un répéteur ouvert. Sinon, ne vous "
                "connectez jamais à la version ouverte et changez le nom et le mot de passe de votre Wi-Fi."))

        connus = {r["bssid"] for a in precedentes for r in a.get("wifi", {}).get("reseaux", [])
                  if r.get("ssid") == nom and r.get("bssid")}
        nb_analyses = sum(1 for a in precedentes
                          if any(r.get("ssid") == nom for r in a.get("wifi", {}).get("reseaux", [])))
        if nb_analyses >= 3:
            familles = {_octets_centraux(b) for b in connus}
            etrangers = [r for r in memes if r["bssid"] and r["bssid"] not in connus
                         and _octets_centraux(r["bssid"]) not in familles]
            if etrangers:
                constats.append(Constat(
                    "a_verifier", "Wi-Fi", f"Nouvel émetteur portant le nom de votre Wi-Fi « {nom} »",
                    "Adresse(s) jamais vue(s) lors des analyses précédentes et sans lien avec celles de votre "
                    "box : " + ", ".join(r["bssid"] for r in etrangers),
                    "Si vous avez ajouté un répéteur ou changé de box, c'est normal. Sinon, vérifiez la liste "
                    "des équipements dans l'interface de votre box."))

    proches = [r for r in voisins if r.get("signal_dbm") is not None
               and (r["signal_dbm"] >= -45 or r.get("signal_sature"))]
    if proches:
        constats.append(Constat(
            "info", "Wi-Fi", f"{len(proches)} émetteur(s) très proche(s) qui ne sont pas votre réseau",
            "Noms : " + ", ".join(f"« {r['ssid'] or 'réseau masqué'} »" for r in proches[:8])
            + ". Il s'agit le plus souvent d'appareils chez vous (imprimante « DIRECT-… », télévision, "
              "enceinte, répéteur, caméra) ou d'une box juste derrière un mur.",
            "Pour savoir d'où vient un signal : lancez une analyse dans chaque pièce (champ « Lieu ») et "
            "comparez dans le rapport ; le signal est plus fort près de sa source."))

    total = champ_total_wifi(reseaux)
    if total:
        # Un signal « au plafond » (100 % sous Windows) peut être en réalité jusqu'à ~20 dB plus fort :
        # la borne haute en tient compte pour ne jamais sous-estimer.
        satures = [r for r in reseaux if r.get("signal_sature")]
        pire_cas = champ_total_wifi([{**r, "signal_dbm": r["signal_dbm"] + 20} if r.get("signal_sature") else r
                                     for r in reseaux])
        bas, haut = fourchette_champ(total)[0], fourchette_champ(pire_cas)[1]
        limite = limite_v_m(2437)
        precisions = ""
        if satures:
            precisions += (f" {len(satures)} signal(aux) au plafond de l'échelle de mesure (émetteur très proche) : "
                           f"la borne haute suppose qu'ils sont 100 fois plus puissants qu'affiché.")
        if miens:
            e_miens = champ_total_wifi(miens) or 0
            precisions += (f" Votre propre réseau représente environ {100 * e_miens ** 2 / total ** 2:.0f} % "
                           f"de la puissance reçue.")
        niveau = "a_verifier" if total > limite / 10 else "normal"
        constats.append(Constat(
            niveau, "Exposition",
            f"Champ Wi-Fi estimé à l'emplacement de l'ordinateur : environ {formater_v_m(total)}",
            f"Tous réseaux confondus. Ordre de grandeur seulement (fourchette {formater_v_m(bas)} à "
            f"{formater_v_m(haut)}), car l'antenne de l'ordinateur n'est pas un instrument calibré. La valeur "
            f"limite réglementaire pour le public, {limite:.0f} V/m, est {formater_nombre(limite / haut)} fois "
            f"plus élevée que la borne haute de cette fourchette." + precisions,
            "Pour une valeur qui fait foi, demandez la mesure officielle gratuite de l'ANFR (voir plus bas)."
            if niveau == "normal" else
            "Valeur inhabituelle pour du Wi-Fi : un émetteur est sans doute collé à l'ordinateur (box, "
            "répéteur). Éloignez l'ordinateur et refaites l'analyse."))
    return constats


# --- Bluetooth ----------------------------------------------------------------------

def _bluetooth(bt: dict, precedentes: list[dict]) -> list[Constat]:
    if not bt.get("ok"):
        return [Constat("non_mesure", "Bluetooth", "Bluetooth non mesuré", bt.get("erreur", ""))]
    constats = []
    appareils = bt["appareils"]
    constats.append(Constat(
        "normal", "Bluetooth", f"{len(appareils)} appareils Bluetooth détectés en {bt.get('duree_s', 0):.0f} s",
        "Téléphones, montres, écouteurs, télévisions, voitures garées… Le Bluetooth porte à 10-50 m et "
        "traverse les murs : capter les appareils des voisins et des passants est normal. Beaucoup "
        "d'appareils changent d'adresse toutes les 15 minutes environ, ce qui gonfle ce nombre."))

    def vu_avant(adresse: str) -> int:
        return sum(1 for a in precedentes
                   if any(x.get("adresse") == adresse for x in a.get("bluetooth", {}).get("appareils", [])))

    separes = [a for a in appareils if a.get("traceur_separe")]
    pres_proprietaire = [a for a in appareils if a.get("traceur") and not a.get("traceur_separe")]
    if separes:
        proches = [a for a in separes if (a.get("rssi_max") or -999) >= -70]
        lignes = [f"{a['type']} — signal {a.get('rssi_max')} dBm ({distance_approximative(a.get('rssi_max'))}), "
                  f"déjà vu dans {vu_avant(a['adresse'])} analyse(s) précédente(s)" for a in separes]
        constats.append(Constat(
            "a_verifier" if proches else "info", "Bluetooth",
            f"{len(separes)} traceur(s) éloigné(s) de leur propriétaire",
            " ; ".join(lignes) + ". Un traceur oublié ou perdu chez un voisin est fréquent ; ce constat ne "
            "devient sérieux que si le signal est fort et revient à chaque analyse, ou s'il vous suit.",
            "Pour chercher un traceur sur vous ou dans vos affaires : un iPhone vous alerte automatiquement "
            "si un AirTag se déplace avec vous ; sur Android, Paramètres > Sécurité > Alertes de traceurs "
            "inconnus (ou l'application gratuite AirGuard), qui peut aussi faire sonner le traceur."))
    if pres_proprietaire:
        constats.append(Constat(
            "info", "Bluetooth", f"{len(pres_proprietaire)} traceur(s) ou appareil(s) Localiser près de leur propriétaire",
            "Ces appareils signalent eux-mêmes être à côté de leur propriétaire (vos appareils Apple, ceux "
            "d'un voisin). C'est le fonctionnement normal du réseau Localiser."))

    rssi = [a["rssi_max"] for a in appareils if a.get("rssi_max") is not None]
    if rssi:
        e = cumul_v_m([champ_v_m(r, 2440) for r in rssi])
        constats.append(Constat(
            "normal", "Exposition", f"Champ Bluetooth estimé : environ {formater_v_m(e)}",
            "Tous appareils confondus, ordre de grandeur. Limite réglementaire à 2,4 GHz : 61 V/m. "
            "Les appareils Bluetooth émettent par courtes impulsions, la moyenne réelle est encore plus basse."))
    return constats


# --- réseau local ----------------------------------------------------------------------

def _reseau_local(reseau: dict, config: dict) -> list[Constat]:
    if not reseau.get("ok"):
        return [Constat("non_mesure", "Réseau local", "Réseau local non vérifié", reseau.get("erreur", ""))]
    appareils = reseau["appareils"]
    if not appareils:
        return [Constat("non_mesure", "Réseau local", "Liste des appareils du réseau local non obtenue",
                        "Aucun appareil n'a répondu, pas même la box : la mesure n'est pas exploitable.")]
    connus = config.get("appareils_reseau_connus", {})
    aleatoires = sum(1 for a in appareils if a.get("mac_aleatoire"))
    note_aleatoire = (f" {aleatoires} utilisent une adresse « privée » tirée au hasard, ce que font par défaut "
                      f"les iPhone et téléphones Android récents." if aleatoires else "")
    box = ("Liste des appareils dans votre box : Livebox et SFR → http://192.168.1.1, Bbox → "
           "http://192.168.1.254, Freebox → http://mafreebox.freebox.fr.")
    if not connus:
        return [Constat(
            "info", "Réseau local", f"{len(appareils)} appareil(s) sur votre réseau ({reseau.get('reseau')})",
            "Aucune référence enregistrée pour l'instant, donc rien à comparer." + note_aleatoire,
            "Comparez la liste du rapport avec vos appareils (téléphones, TV, consoles, box TV, imprimante…). "
            "Si tout est à vous, cliquez « Enregistrer mes appareils comme référence » : les analyses "
            "suivantes signaleront tout nouvel appareil. " + box)]
    inconnus = [a for a in appareils if a["mac"] not in connus]
    if not inconnus:
        return [Constat("normal", "Réseau local",
                        f"Les {len(appareils)} appareils présents sur votre réseau sont tous dans votre référence",
                        note_aleatoire.strip())]
    return [Constat(
        "a_verifier", "Réseau local", f"{len(inconnus)} appareil(s) jamais vu(s) sur votre réseau",
        "Nouveaux : " + ", ".join(f"{a['ip']} ({a['mac']}{', adresse aléatoire' if a.get('mac_aleatoire') else ''})"
                                  for a in inconnus) + "." + note_aleatoire,
        "Un téléphone peut changer d'adresse aléatoire (après une mise à jour, un oubli du réseau…). Identifiez "
        "l'appareil dans votre box. S'il reste inconnu : changez le mot de passe Wi-Fi (tous les appareils "
        "devront se reconnecter), désactivez le WPS et changez le mot de passe d'administration de la box. "
        + box)]


# --- ordinateur ------------------------------------------------------------------------------

def _ordinateur(info: dict) -> list[Constat]:
    if not info.get("ok"):
        return [Constat("non_mesure", "Ordinateur", "Ordinateur non vérifié", info.get("erreur", ""))]
    constats = []
    actifs = {o["nom"] for o in info.get("outils_acces_distant", [])}
    for outil in info.get("outils_acces_distant", []):
        constats.append(Constat(
            "a_verifier" if outil["integre"] else "important", "Ordinateur",
            f"Logiciel de prise de contrôle à distance actif : {outil['nom']}",
            "Processus : " + ", ".join(outil["processus"]) + ". Ce type de logiciel permet à une personne de "
            "voir et de contrôler votre écran depuis Internet. Il est légitime si VOUS l'avez installé "
            "(aide d'un proche, travail) ; c'est aussi l'outil principal des arnaques au faux support technique.",
            "Si vous ne l'utilisez pas : désinstallez-le, puis changez vos mots de passe importants depuis un "
            "autre appareil, en commençant par votre messagerie."))
    for nom in info.get("outils_au_demarrage", []):
        if nom not in actifs:
            constats.append(Constat(
                "a_verifier", "Ordinateur", f"Logiciel de prise de contrôle à distance lancé au démarrage : {nom}",
                "Il n'est pas actif en ce moment mais se lance au démarrage de l'ordinateur.",
                "Si vous ne l'avez pas installé vous-même, désinstallez-le."))
    for port in info.get("ports_acces_distant", []):
        constats.append(Constat(
            "a_verifier", "Ordinateur", f"Accès à distance ouvert : {port['service']}",
            f"L'ordinateur accepte des connexions sur {port['local']} (programme : {port['processus']}).",
            "Si vous n'utilisez pas cet accès, désactivez-le (Windows : Paramètres > Système > Bureau à "
            "distance ; Mac : Réglages Système > Général > Partage)."))
    antivirus = info.get("antivirus_windows")
    if antivirus and (antivirus.get("RealTimeProtectionEnabled") is False or antivirus.get("AntivirusEnabled") is False):
        constats.append(Constat(
            "a_verifier", "Ordinateur", "La protection en temps réel de Microsoft Defender est désactivée",
            "C'est normal si un autre antivirus est installé et à jour.",
            "Sinon, réactivez-la : Sécurité Windows > Protection contre les virus et menaces."))
    if not constats:
        constats.append(Constat(
            "normal", "Ordinateur", "Aucun logiciel connu de prise de contrôle à distance n'est actif",
            f"{len({nom for nom, _ in OUTILS_ACCES_DISTANT.values()})} logiciels vérifiés (TeamViewer, AnyDesk, RustDesk, VNC, ScreenConnect…) "
            "et aucun accès à distance ouvert. Cela ne garantit pas l'absence de tout logiciel malveillant.",
            "Lancez aussi une analyse complète avec votre antivirus (Windows : Sécurité Windows > Protection "
            "contre les virus et menaces > Options d'analyse > Analyse complète)."))
    constats.append(Constat(
        "info", "Ordinateur",
        f"{len(info.get('connexions_etablies', []))} connexion(s) Internet ouverte(s), "
        f"{len(info.get('ecoute', []))} port(s) en écoute",
        "Navigateur, messagerie, mises à jour, synchronisation… ont en permanence des connexions ouvertes ; "
        "le détail par programme est dans le rapport." + (f" Remarque : {info['remarque']}." if info.get("remarque") else "")))
    return constats


# --- radio large bande (SDR) ------------------------------------------------------------------

def _sdr(sdr: dict, precedentes: list[dict], lieu: str) -> list[Constat]:
    if not sdr.get("ok"):
        if sdr.get("disponible") is False:
            return [Constat(
                "non_mesure", "Radio (SDR)", "Ondes hors Wi-Fi et Bluetooth non mesurées (dont micro-ondes)",
                "Sans récepteur radio, un ordinateur ne voit que le Wi-Fi et le Bluetooth : il ne voit ni la "
                "bande des fours à micro-ondes en tant que telle, ni la 4G/5G, ni la TNT, ni la radio.",
                "Voir MATERIEL.md : un analyseur tinySA Ultra (achat optionnel) couvre jusqu'à environ 5,3 GHz, "
                "dont la bande des micro-ondes (2,45 GHz).")]
        return [Constat("non_mesure", "Radio (SDR)", "Balayage radio non effectué", sdr.get("erreur", ""))]
    emissions = sdr.get("emissions", [])
    connues = [e for e in emissions if e.get("bande")]
    artefacts = [e for e in emissions if not e.get("bande") and e.get("artefact_possible")]
    inconnues = [e for e in emissions if not e.get("bande") and not e.get("artefact_possible")]
    constats = [Constat(
        "normal", "Radio (SDR)", f"{len(connues)} émission(s) dans des bandes connues ({sdr.get('source')})",
        "Bandes rencontrées : " + (", ".join(sorted({e["bande"] for e in connues})) or "aucune")
        + ". Radio, télévision, antennes relais, Wi-Fi, objets connectés : ces émissions sont présentes partout.")]
    if artefacts:
        constats.append(Constat(
            "info", "Radio (SDR)", f"{len(artefacts)} pic(s) probablement produit(s) par le récepteur lui-même",
            "Fréquences multiples de 28,8 MHz (horloge interne de la clé RTL-SDR) : "
            + ", ".join(formater_mhz(e["pic_mhz"]) for e in artefacts)))
    if inconnues:
        constats.append(Constat(
            "a_verifier", "Radio (SDR)", f"{len(inconnues)} émission(s) hors des bandes répertoriées",
            "Fréquences : " + ", ".join(f"{formater_mhz(e['pic_mhz'])} (+{formater_nombre(e['exces_db'])} dB)"
                                       for e in inconnues[:10])
            + ". La liste de bandes du logiciel est simplifiée : une émission « non répertoriée » n'est pas "
              "forcément anormale (et un récepteur bon marché produit aussi des signaux parasites).",
            "Refaites la mesure dans plusieurs pièces et dans un autre lieu (chez un proche, dehors). Si le signal "
            "est le même partout, c'est un émetteur public lointain ou un parasite du récepteur. S'il est "
            "nettement plus fort à un seul endroit et à chaque fois, notez la fréquence : l'ANFR instruit les "
            "plaintes pour brouillage."))
    return constats + _micro_ondes(sdr, precedentes, lieu)


def est_reference_micro_ondes(lieu: str | None) -> bool:
    t = (lieu or "").lower().replace("-", "").replace(" ", "")
    return "microonde" in t


def _micro_ondes(sdr: dict, precedentes: list[dict], lieu: str) -> list[Constat]:
    domaine = "Micro-ondes (2,4 GHz)"
    mo = sdr.get("micro_ondes")
    if not mo:
        return [Constat(
            "non_mesure", domaine, "Bande des micro-ondes (2,45 GHz) non mesurée",
            f"Le récepteur utilisé ({sdr.get('source')}) ne couvre pas 2,4 GHz.",
            "Il faut un tinySA Ultra ou un HackRF One (voir MATERIEL.md).")]
    unite = "dBm" if mo["absolu"] else "dB (niveau relatif)"
    detail = f"Niveau maximal entre 2 400 et 2 500 MHz : {_db(mo['max_db'])} {unite} à {formater_mhz(mo['pic_mhz'])}."
    niveau, titre, action = "normal", "Bande des micro-ondes (2,45 GHz) mesurée", ""
    limite = limite_v_m(2450)
    if mo["absolu"] and mo.get("champ_v_m"):
        e = mo["champ_v_m"]
        detail += (f" Champ estimé dans toute la bande : environ {formater_v_m(e)} (ordre de grandeur, borne haute) ; "
                   f"la limite réglementaire de {limite:.0f} V/m est {formater_nombre(limite / e)} fois plus élevée.")
        if e > limite / 10:
            niveau = "a_verifier"
            titre = "Niveau élevé dans la bande des micro-ondes"
            action = ("Un émetteur est très proche du récepteur (box, téléphone, four en marche…). Éloignez le "
                      "récepteur de vos propres appareils et refaites la mesure.")
    detail += (" Cette bande est partagée par le Wi-Fi, le Bluetooth et les fours : un niveau seul ne dit pas "
               "qui émet ; la comparaison avec votre propre four en marche, si.")

    if est_reference_micro_ondes(lieu):
        return [Constat("info", domaine, "Mesure de référence : four à micro-ondes en marche",
                        detail + " Les prochaines mesures seront comparées à celle-ci.")]
    references = [a for a in precedentes if est_reference_micro_ondes(a.get("lieu"))
                  and (a.get("sdr") or {}).get("micro_ondes")
                  and a["sdr"].get("materiel") == sdr.get("materiel")]
    if not references:
        return [Constat(niveau, domaine, titre, detail, action or (
            "Pour savoir à quoi ressemble un vrai four à micro-ondes sur votre récepteur : faites une analyse "
            "avec le lieu « test micro-ondes », récepteur posé à 1 m de votre four en marche (avec une tasse "
            "d'eau dedans). Les mesures suivantes y seront comparées."))]
    reference = references[-1]["sdr"]["micro_ondes"]
    ecart = mo["max_db"] - reference["max_db"]
    if ecart >= -3:
        return [Constat(
            "a_verifier", domaine, "Niveau à 2,4 GHz comparable à votre four à micro-ondes en marche",
            detail + f" Votre four en marche donnait {_db(reference['max_db'])} ; ici l'écart est de "
                     f"{_db(ecart)} dB.",
            "Vérifiez qu'aucun four ne fonctionnait pendant la mesure (chez vous ou juste derrière un mur) et "
            "qu'aucun appareil Wi-Fi n'était collé au récepteur, puis refaites-la. Si cela se répète sans "
            "explication, notez la date, l'heure et la pièce : ce sont des éléments concrets pour une mesure de "
            "l'ANFR ou une plainte.")]
    facteur = 10 ** (-ecart / 10)
    return [Constat(
        niveau, domaine, f"Bande 2,4 GHz : {_db(-ecart)} dB sous votre four en marche",
        detail + f" C'est environ {formater_nombre(facteur)} fois moins de puissance que votre propre four "
                 f"mesuré à 1 m (analyse du {references[-1]['horodatage'][:10]}).", action)]


# --- caméras ------------------------------------------------------------------------------------

def _cameras(cam: dict, config: dict) -> list[Constat]:
    if not cam.get("ok"):
        return [Constat("non_mesure", "Caméras", "Recherche de caméras non effectuée", cam.get("erreur", ""))]
    constats = []
    connus = config.get("appareils_reseau_connus", {})
    sur_reseau = cam.get("cameras_reseau", [])
    inconnues = [c for c in sur_reseau if c["mac"] not in connus]
    if sur_reseau and not inconnues:
        constats.append(Constat(
            "info", "Caméras", f"{len(sur_reseau)} caméra(s) de votre référence sur votre réseau",
            " | ".join(f"{c['ip']} ({connus[c['mac']]})" for c in sur_reseau),
            "Changez leur mot de passe par défaut et faites leurs mises à jour."))
    elif sur_reseau:
        lignes = [f"{c['ip']} ({c['mac']}) : " + "; ".join(c["indices"]) for c in inconnues]
        constats.append(Constat(
            "a_verifier", "Caméras", f"{len(inconnues)} caméra(s) ou enregistreur(s) vidéo inconnu(s) sur votre réseau",
            " | ".join(lignes),
            "Si ce sont vos caméras (surveillance, babyphone, sonnette vidéo), c'est normal : changez leur mot de "
            "passe par défaut et faites leurs mises à jour. Sinon : retrouvez l'appareil grâce à son adresse MAC "
            "dans l'interface de votre box, débranchez-le, puis changez le mot de passe Wi-Fi."))
    elif cam.get("reseau_verifie"):
        constats.append(Constat(
            "normal", "Caméras", "Aucune caméra détectée sur votre réseau",
            "Aucun appareil connecté à votre box ne répond comme une caméra (protocoles vidéo RTSP et ONVIF, "
            "ports et pages de connexion des grandes marques). Une caméra qui enregistre sur carte mémoire, qui "
            "utilise la 4G ou qui est éteinte reste invisible pour ce test : seule une inspection physique la "
            "trouve (guide en bas du rapport)."))
    else:
        constats.append(Constat("non_mesure", "Caméras", "Réseau local non examiné pour les caméras",
                                cam.get("erreur_reseau", "")))

    proches = [w for w in cam.get("wifi_cameras", []) if (w.get("signal_dbm") or -999) >= -60]
    lointains = [w for w in cam.get("wifi_cameras", []) if w not in proches]
    if proches:
        constats.append(Constat(
            "a_verifier", "Caméras", f"{len(proches)} réseau(x) Wi-Fi au nom de caméra, émetteur proche",
            ", ".join(f"« {w['ssid']} » ({_db(w['signal_dbm'])} dBm)" for w in proches)
            + ". Beaucoup de mini-caméras créent leur propre réseau Wi-Fi avec ce genre de nom. Le nom seul ne "
              "prouve rien (cela peut être une caméra de voisin ou un autre objet).",
            "Faites une analyse dans chaque pièce : le signal est le plus fort près de l'appareil. Inspectez cette "
            "pièce avec la méthode du guide (lampe, détecteur de lentilles)."))
    if lointains:
        constats.append(Constat(
            "info", "Caméras", f"{len(lointains)} réseau(x) Wi-Fi au nom de caméra, émetteur éloigné",
            ", ".join(f"« {w['ssid']} »" for w in lointains)
            + ". Signal faible : l'appareil est loin ou derrière plusieurs murs, probablement chez un voisin."))
    if cam.get("bluetooth_cameras"):
        constats.append(Constat(
            "info", "Caméras", "Appareil(s) Bluetooth au nom de caméra",
            ", ".join(f"« {b['nom']} » ({b.get('rssi_max')} dBm)" for b in cam["bluetooth_cameras"])))
    autres = cam.get("autres_appareils_reseau", [])
    if autres:
        constats.append(Constat(
            "info", "Caméras", "Autres appareils à connaître sur votre réseau",
            " | ".join(f"{a['ip']} : {a['remarque']}" for a in autres)))
    return constats


# --- téléphone --------------------------------------------------------------------------------------

def _telephone(tel: dict) -> list[Constat]:
    if not tel.get("ok"):
        return [Constat("non_mesure", "Téléphone", "Téléphone non analysé", tel.get("erreur", ""),
                        "iPhone : voir le guide de contrôle en bas du rapport." if tel.get("disponible") is False
                        else "")]
    constats = []
    appareil = tel["appareil"]
    nom = f"{appareil.get('fabricant', '')} {appareil.get('modele', '')}".strip()
    action_appli = (
        "Si vous comptez porter plainte, montrez d'abord le téléphone à la police ou à la gendarmerie (ce rapport "
        "est conservé dans le dossier « donnees »). Ensuite : bouton « Applis du téléphone » de Veille Ondes pour "
        "désactiver (réversible) ou désinstaller l'application, puis changez le mot de passe de votre compte "
        "Google depuis un autre appareil et activez la double authentification.")
    for x in tel.get("connus_systeme", []):
        constats.append(Constat(
            "important", "Téléphone", f"Logiciel espion connu installé comme application système : {x['nom']}",
            f"Application {x['paquet']}. Une installation au niveau du système suppose un téléphone modifié.",
            "Une réinitialisation d'usine complète est la solution la plus sûre, après avoir fait constater si "
            "vous portez plainte."))
    for a in tel["applications"]:
        if a["niveau"] in ("important", "a_verifier"):
            origine = a["magasin"] or "hors magasin"
            connu = a.get("connu")
            titre = (f"Logiciel espion connu : {connu['nom']} ({a['paquet']})"
                     if connu and connu["type"] == "stalkerware" else
                     f"Application à examiner : {a['paquet']} ({origine})")
            constats.append(Constat(
                a["niveau"], "Téléphone", titre,
                " ; ".join(a["raisons"]) + (f" ; installée le {a['installe_le']}" if a.get("installe_le") else "")
                + (" ; déjà désactivée" if a.get("desactive") else "") + ".",
                action_appli))
    if not any(c.niveau in ("important", "a_verifier") for c in constats):
        constats.append(Constat(
            "normal", "Téléphone", f"Aucune application suspecte sur le {nom}",
            f"{len(tel['applications'])} applications installées par l'utilisateur comparées à une liste de "
            f"{tel.get('indicateurs', {}).get('nb_paquets', 0)} logiciels espions connus (association Echap) et "
            "examinées pour les droits qu'utilisent ces logiciels. Les logiciels espions d'État (type Pegasus), "
            "réservés à des cibles très particulières, ne sont pas détectables par ce type de contrôle."))

    if appareil.get("root"):
        constats.append(Constat(
            "a_verifier", "Téléphone", "Le téléphone est « rooté » (protections d'Android contournées)",
            "Un téléphone rooté permet à une application d'obtenir tous les droits sans vous le demander.",
            "Si ce n'est pas vous qui l'avez rooté : sauvegardez vos photos et faites une réinitialisation d'usine."))
    jours = jours_depuis(appareil.get("correctif_securite") or "")
    if jours is not None and jours > 180:
        constats.append(Constat(
            "a_verifier", "Téléphone",
            f"Correctifs de sécurité datant de {jours // 30} mois ({appareil['correctif_securite']})",
            "Les failles corrigées depuis sont connues des pirates." + (
                " Ce téléphone ne reçoit probablement plus de mises à jour." if jours > 730 else ""),
            "Paramètres > Mise à jour du logiciel. Sans mise à jour disponible depuis longtemps, prévoyez de "
            "changer de téléphone."))
    puissants = [a for a in tel["applications"] if a["acces_puissant"] and a["niveau"] == "normal"]
    if puissants:
        constats.append(Constat(
            "info", "Téléphone", f"{len(puissants)} application(s) de magasin avec un accès puissant",
            ", ".join(f"{a['paquet']} ({'; '.join(r for r in a['raisons'] if 'accès :' not in r)})"
                      for a in puissants)
            + ". Souvent légitime (montre connectée, gestionnaire de mots de passe, antivirus) : vérifiez que "
              "vous reconnaissez chacune."))
    if tel.get("autorises_a_installer"):
        constats.append(Constat(
            "info", "Téléphone", "Applications autorisées à installer d'autres applications",
            ", ".join(tel["autorises_a_installer"]),
            "Retirez cette autorisation si vous ne l'utilisez pas : Paramètres > Applications > Accès spécial > "
            "Installer des applis inconnues."))
    constats.append(Constat(
        "info", "Téléphone", "Pensez à désactiver le débogage USB",
        "Il a servi à l'analyse ; laissé actif, il facilite l'accès au téléphone par quelqu'un qui l'aurait en main.",
        "Paramètres > Options pour les développeurs > Débogage USB : désactiver."))
    return constats


def evaluer(analyse: dict, precedentes: list[dict], config: dict) -> list[Constat]:
    constats: list[Constat] = []
    if "wifi" in analyse:
        constats += _wifi(analyse["wifi"], precedentes, config)
    if "bluetooth" in analyse:
        constats += _bluetooth(analyse["bluetooth"], precedentes)
    if "reseau_local" in analyse:
        constats += _reseau_local(analyse["reseau_local"], config)
    if "cameras" in analyse:
        constats += _cameras(analyse["cameras"], config)
    if "ordinateur" in analyse:
        constats += _ordinateur(analyse["ordinateur"])
    if "telephone" in analyse:
        constats += _telephone(analyse["telephone"])
    if "sdr" in analyse:
        constats += _sdr(analyse["sdr"], precedentes, analyse.get("lieu", ""))
    constats.sort(key=lambda c: ORDRE_NIVEAUX[c.niveau])
    return constats


def synthese(constats: list[Constat]) -> str:
    """Résumé en une phrase, qui ne parle que de ce qui a réellement été mesuré."""
    n_imp = sum(1 for c in constats if c.niveau == "important")
    n_ver = sum(1 for c in constats if c.niveau == "a_verifier")
    non_mesures = sorted({c.domaine for c in constats if c.niveau == "non_mesure"})
    def verifie(domaine: str) -> bool:
        return any(c.domaine == domaine and c.niveau != "non_mesure" for c in constats)

    ondes_mesurees = any(verifie(d) for d in ("Wi-Fi", "Bluetooth", "Radio (SDR)", "Micro-ondes (2,4 GHz)"))
    ordinateur_verifie = verifie("Ordinateur")

    if n_imp:
        phrase = (f"{n_imp} point(s) important(s) et {n_ver} point(s) à vérifier. Ce sont des problèmes de "
                  f"sécurité concrets (ordinateur, Wi-Fi, téléphone ou caméra), qui se traitent : commencez par eux.")
    elif n_ver:
        phrase = f"Rien d'alarmant ; {n_ver} point(s) à vérifier, avec pour chacun la marche à suivre."
        if ondes_mesurees:
            phrase += " Les niveaux d'ondes mesurés sont normaux."
    else:
        constats_ok = []
        if ondes_mesurees:
            constats_ok.append("les émissions radio captées sont celles qu'on trouve dans n'importe quel "
                               "logement, à des niveaux très inférieurs aux limites")
        if ordinateur_verifie:
            constats_ok.append("aucun signe d'accès à distance n'a été trouvé sur l'ordinateur")
        if verifie("Caméras"):
            constats_ok.append("aucune caméra n'a été détectée sur votre réseau ni dans les Wi-Fi visibles")
        if verifie("Téléphone"):
            constats_ok.append("aucune application suspecte n'a été trouvée sur le téléphone")
        if constats_ok:
            phrase = "Rien d'anormal dans ce qui a été mesuré : " + " ; ".join(constats_ok) + "."
        else:
            phrase = "Aucune mesure exploitable dans cette analyse."
    if non_mesures:
        phrase += " Non mesuré cette fois : " + ", ".join(non_mesures) + " (voir le détail)."
    return phrase


def en_dict(constats: list[Constat]) -> list[dict]:
    return [asdict(c) for c in constats]
