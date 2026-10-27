"""Faux téléphone, faux HackRF et faux tinySA : vérifient l'enchaînement complet sans matériel."""

import os
import stat
import sys
import textwrap

import pytest

from veille_ondes import sdr, telephone

FAUX_ADB = r'''
import sys
args = sys.argv[1:]
if args == ["devices"]:
    print("List of devices attached\nSERIE123\tdevice\n")
    sys.exit(0)
commande = args[-1]
reponses = {
    "getprop ro.product.manufacturer": "samsung",
    "getprop ro.product.model": "SM-A546B",
    "getprop ro.build.version.release": "14",
    "getprop ro.build.version.security_patch": "2026-09-01",
    "which su": "",
    "pm list packages -3 -i": "package:com.whatsapp  installer=com.android.vending\npackage:com.systemservice  installer=null\npackage:com.outil.cache  installer=null",
    "pm list packages": "package:com.android.settings\npackage:com.whatsapp\npackage:com.systemservice\npackage:com.outil.cache",
    "pm list packages -3": "package:com.whatsapp\npackage:com.systemservice\npackage:com.outil.cache",
    "settings get secure enabled_accessibility_services": "com.outil.cache/com.outil.cache.Svc",
    "settings get secure enabled_notification_listeners": "null",
    "dumpsys device_policy": "  Enabled Device Admins (User 0, provisioningState: 3):\n    com.outil.cache/.Admin:\n      uid=10400\n",
    "dumpsys package packages": "Packages:\n  Package [com.outil.cache] (1):\n    firstInstallTime=2026-10-24 21:00:00\n      runtime permissions:\n        android.permission.RECORD_AUDIO: granted=true, flags=[ ]\n",
    "cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER": "1 activities found:\n  Activity #0:\n    com.whatsapp/.Main\n",
    "cmd appops query-op --user 0 REQUEST_INSTALL_PACKAGES allow": "com.android.chrome\ncom.whatsapp\n",
    "pm disable-user --user 0 com.outil.cache": "Package com.outil.cache new state: disabled-user",
}
if commande in reponses:
    print(reponses[commande])
    sys.exit(0)
print("commande inconnue : " + commande, file=sys.stderr)
sys.exit(1)
'''


def _installer_programme(dossier, nom, code_python):
    script = dossier / "faux.py"
    script.write_text(textwrap.dedent(code_python))
    if os.name == "nt":
        chemin = dossier / f"{nom}.bat"
        chemin.write_text(f'@"{sys.executable}" "{script}" %*\n')
    else:
        chemin = dossier / nom
        chemin.write_text(f'#!/bin/sh\nexec "{sys.executable}" "{script}" "$@"\n')
        chemin.chmod(chemin.stat().st_mode | stat.S_IEXEC)
    return str(chemin)


def test_telephone_simule(tmp_path, monkeypatch):
    adb = _installer_programme(tmp_path, "adb", FAUX_ADB)
    monkeypatch.setattr(telephone, "trouver_adb", lambda *args, **kwargs: adb)
    r = telephone.scanner()
    assert r["ok"] and r["appareil"]["modele"] == "SM-A546B"
    par_nom = {a["paquet"]: a for a in r["applications"]}
    assert par_nom["com.systemservice"]["niveau"] == "important"            # logiciel espion connu (Echap)
    assert par_nom["com.outil.cache"]["niveau"] == "important"              # hors magasin + accessibilité + admin
    assert par_nom["com.whatsapp"]["niveau"] == "normal"
    assert r["autorises_a_installer"] == ["com.whatsapp"]                   # seulement les paquets installés
    assert telephone.agir("desactiver", "com.outil.cache") == (True, "Package com.outil.cache new state: disabled-user")
    reussi, message = telephone.agir("desinstaller", "com.android.settings")
    assert not reussi and "refusé" in message                               # jamais une application système


FAUX_HACKRF = r'''
import sys
fichier = sys.argv[sys.argv.index("-r") + 1]
lignes = []
for bas in range(2380, 2520, 5):
    niveaux = [-75.0] * 5
    if bas == 2445:
        niveaux[2] = -20.0
    lignes.append(f"2026-10-25, 22:00:00, {bas * 1000000}, {(bas + 5) * 1000000}, 1000000.00, 20, "
                  + ", ".join(str(x) for x in niveaux))
open(fichier, "w").write("\n".join(lignes))
'''


def test_hackrf_simule(tmp_path, monkeypatch):
    programme = _installer_programme(tmp_path, "hackrf_sweep", FAUX_HACKRF)
    monkeypatch.setattr(sdr, "materiels_disponibles", lambda *a, **k: ["hackrf"])
    monkeypatch.setattr(sdr, "trouver_hackrf", lambda: programme)
    r = sdr.scanner()
    assert r["ok"] and r["materiel"] == "hackrf" and not r["absolu"]
    assert r["micro_ondes"]["pic_mhz"] == 2447.5 and r["micro_ondes"]["max_db"] == -20
    assert any(e["bande"] == "Bande 2,4 GHz" for e in r["emissions"])


class FauxTinySA:
    """Répond comme le shell USB d'un tinySA Ultra."""

    version = "tinySA4_v1.4-143"
    sweep_debut_hz = 0
    sweep_fin_hz = 800_000_000

    def __init__(self, *args, **kwargs):
        self.timeout = 5
        self.reponse = b""

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def reset_input_buffer(self):
        pass

    def write(self, donnees):
        commande = donnees.decode().strip()
        if commande == "version":
            texte = f"version\r\n{self.version}\r\nHW Version:V0.4.6\r\n"
        elif commande == "sweep":
            texte = f"sweep\r\n{self.sweep_debut_hz} {self.sweep_fin_hz} 101\r\n"
        elif commande.startswith("scan"):
            _, debut, fin, points, _ = commande.split()
            debut, fin, points = int(debut), int(fin), int(points)
            lignes = []
            for i in range(points):
                f = debut + (fin - debut) * i // (points - 1)
                lignes.append(f"{f} {-40.0 if 2_449_000_000 <= f <= 2_451_000_000 else -95.0}")
            texte = commande + "\r\n" + "\r\n".join(lignes) + "\r\n"
        else:
            texte = commande + "\r\n"
        self.reponse = (texte + "ch> ").encode()

    def read_until(self, fin):
        r, self.reponse = self.reponse, b""
        return r


def test_tinysa_simule(monkeypatch):
    serial = pytest.importorskip("serial")
    monkeypatch.setattr(serial, "Serial", FauxTinySA)
    monkeypatch.setattr(sdr, "materiels_disponibles", lambda *a, **k: ["tinysa"])
    monkeypatch.setattr(sdr, "trouver_tinysa", lambda *a, **k: "COM7")
    r = sdr.scanner()
    assert r["ok"] and r["absolu"] and r["unite"] == "dBm"
    assert r["plage_mhz"][0] == 24 and r["plage_mhz"][1] == 5300
    mo = r["micro_ondes"]
    assert 2449 <= mo["pic_mhz"] <= 2451 and mo["max_db"] == -40
    assert mo["champ_v_m"] < 1


@pytest.mark.parametrize("version, va_jusqu_a", [("tinySA_v1.4-87", 960), ("tinySA4_v1.4-200", 5300),
                                                 ("version inconnue ZS-407 tinySA", 5300)])
def test_tinysa_selon_le_modele(monkeypatch, version, va_jusqu_a):
    serial = pytest.importorskip("serial")
    monkeypatch.setattr(FauxTinySA, "version", version)
    monkeypatch.setattr(serial, "Serial", FauxTinySA)
    monkeypatch.setattr(sdr, "materiels_disponibles", lambda *a, **k: ["tinysa"])
    monkeypatch.setattr(sdr, "trouver_tinysa", lambda *a, **k: "COM7")
    r = sdr.scanner()
    assert r["ok"] and r["plage_mhz"][1] <= va_jusqu_a and r["plage_mhz"][1] > va_jusqu_a - 100
    assert (r["micro_ondes"] is None) == (va_jusqu_a == 960)


class _FauxPort:
    def __init__(self, device, vid=None, pid=None, description=""):
        self.device, self.vid, self.pid, self.description = device, vid, pid, description


def test_tinysa_trouve_par_identifiant_usb_connu(monkeypatch):
    serial = pytest.importorskip("serial.tools.list_ports")
    monkeypatch.setattr(serial, "comports", lambda: [_FauxPort("COM3", 0x0483, 0x5740, "STM32 VCP")])
    assert sdr.trouver_tinysa() == "COM3"


def test_tinysa_repli_sur_unique_port_qui_repond(monkeypatch):
    """Identifiant USB inconnu, mais un seul port série branché et qui répond comme un tinySA
    à la sonde rapide : on l'accepte."""
    serial = pytest.importorskip("serial.tools.list_ports")
    monkeypatch.setattr(serial, "comports", lambda: [_FauxPort("COM9", 0x1234, 0x5678, "Appareil inconnu")])
    monkeypatch.setattr(sdr, "_repond_comme_tinysa", lambda port, delai=1.5: port == "COM9")
    assert sdr.trouver_tinysa() == "COM9"


def test_tinysa_pas_de_repli_si_le_port_ne_repond_pas(monkeypatch):
    """Un unique port série (ex. : COM1 hérité de la carte mère, présent sur beaucoup de PC
    même sans rien de branché) qui ne répond pas comme un tinySA n'est pas pris pour tel."""
    serial = pytest.importorskip("serial.tools.list_ports")
    monkeypatch.setattr(serial, "comports", lambda: [_FauxPort("COM1", None, None, "Port série hérité")])
    monkeypatch.setattr(sdr, "_repond_comme_tinysa", lambda port, delai=1.5: False)
    assert sdr.trouver_tinysa() is None


def test_tinysa_pas_de_repli_si_plusieurs_ports_inconnus(monkeypatch):
    serial = pytest.importorskip("serial.tools.list_ports")
    monkeypatch.setattr(serial, "comports", lambda: [_FauxPort("COM1", 1, 2), _FauxPort("COM2", 3, 4)])
    assert sdr.trouver_tinysa() is None


def test_tinysa_port_choisi_a_la_main(tmp_path, monkeypatch):
    serial = pytest.importorskip("serial.tools.list_ports")
    monkeypatch.setattr(serial, "comports", lambda: [_FauxPort("COM5", 9, 9), _FauxPort("COM6", 8, 8)])
    (tmp_path / "config.json").write_text('{"port_tinysa": "COM6"}')
    assert sdr.trouver_tinysa(tmp_path) == "COM6"


def test_tinysa_port_choisi_mais_debranche(tmp_path, monkeypatch):
    serial = pytest.importorskip("serial.tools.list_ports")
    monkeypatch.setattr(serial, "comports", lambda: [_FauxPort("COM5", 9, 9)])
    monkeypatch.setattr(sdr, "_repond_comme_tinysa", lambda port, delai=1.5: port == "COM5")
    (tmp_path / "config.json").write_text('{"port_tinysa": "COM6"}')
    # le port enregistré n'est plus branché : on retombe sur la détection automatique (ici, repli sur l'unique port)
    assert sdr.trouver_tinysa(tmp_path) == "COM5"


def test_message_si_aucun_recepteur_reconnu(monkeypatch):
    serial = pytest.importorskip("serial.tools.list_ports")
    monkeypatch.setattr(sdr, "materiels_disponibles", lambda *a, **k: [])
    monkeypatch.setattr(sdr, "trouver_rtl_power", lambda: None)
    monkeypatch.setattr(sdr, "trouver_hackrf", lambda: None)
    monkeypatch.setattr(serial, "comports", lambda: [_FauxPort("COM4", 1, 1, "Carte inconnue")])
    r = sdr.scanner()
    assert not r["ok"] and "COM4" in r["erreur"] and "Choisir le port du tinySA" in r["erreur"]


class FauxTinySAMuet(FauxTinySA):
    """Répond à « version » et « sweep » mais ne renvoie jamais de point pour « scan »
    (reproduit le cas signalé : balayage terminé sans aucune mesure)."""

    def write(self, donnees):
        commande = donnees.decode().strip()
        if commande.startswith("scan"):
            self.reponse = (commande + "\r\nch> ").encode()
        else:
            super().write(donnees)


def test_diagnostic_tinysa_ultra_actif(monkeypatch):
    serial = pytest.importorskip("serial")
    FauxTinySA.sweep_fin_hz = 5_300_000_000
    monkeypatch.setattr(serial, "Serial", FauxTinySA)
    r = sdr.diagnostiquer_tinysa("COM7")
    assert r["ok"] and r["repond_comme_tinysa"] and r["modele_ultra"]
    assert r["mode_ultra_actif_probable"] is True
    assert r["points_mesure_test"] == 20
    assert [e["commande"] for e in r["etapes"]] == ["(connexion)", "version", "sweep",
                                                     "scan 2400000000 2500000000 20 3"]


def test_diagnostic_tinysa_ultra_inactif(monkeypatch):
    serial = pytest.importorskip("serial")
    FauxTinySA.sweep_fin_hz = 800_000_000
    monkeypatch.setattr(serial, "Serial", FauxTinySA)
    r = sdr.diagnostiquer_tinysa("COM7")
    assert r["ok"] and r["mode_ultra_actif_probable"] is False
    assert r["plage_actuelle_mhz"][1] == 800.0


def test_diagnostic_tinysa_scan_muet():
    """Reproduit le cas signalé : l'appareil répond normalement mais « scan » ne renvoie
    aucune mesure exploitable, même si l'appareil se déclare bien Ultra."""
    serial = pytest.importorskip("serial")
    import unittest.mock
    with unittest.mock.patch.object(serial, "Serial", FauxTinySAMuet):
        r = sdr.diagnostiquer_tinysa("COM7")
    assert r["ok"] and r["repond_comme_tinysa"] and r["points_mesure_test"] == 0
    assert "scan 2400000000 2500000000 20 3" in [e["commande"] for e in r["etapes"]]


def test_diagnostic_tinysa_pas_branche():
    serial = pytest.importorskip("serial")
    import unittest.mock

    class Refuse:
        def __init__(self, *a, **k):
            raise serial.SerialException("port introuvable")

    with unittest.mock.patch.object(serial, "Serial", Refuse):
        r = sdr.diagnostiquer_tinysa("COM9")
    assert not r["ok"] and "COM9" in r["erreur"]
