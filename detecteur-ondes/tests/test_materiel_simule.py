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
    monkeypatch.setattr(telephone, "trouver_adb", lambda: adb)
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
    monkeypatch.setattr(sdr, "materiels_disponibles", lambda: ["hackrf"])
    monkeypatch.setattr(sdr, "trouver_hackrf", lambda: programme)
    r = sdr.scanner()
    assert r["ok"] and r["materiel"] == "hackrf" and not r["absolu"]
    assert r["micro_ondes"]["pic_mhz"] == 2447.5 and r["micro_ondes"]["max_db"] == -20
    assert any(e["bande"] == "Bande 2,4 GHz" for e in r["emissions"])


class FauxTinySA:
    """Répond comme le shell USB d'un tinySA Ultra."""

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
            texte = "version\r\ntinySA4_v1.4-143\r\nHW Version:V0.4.5.1\r\n"
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
    monkeypatch.setattr(sdr, "materiels_disponibles", lambda: ["tinysa"])
    monkeypatch.setattr(sdr, "trouver_tinysa", lambda: "COM7")
    r = sdr.scanner()
    assert r["ok"] and r["absolu"] and r["unite"] == "dBm"
    assert r["plage_mhz"][0] == 24 and r["plage_mhz"][1] == 5300
    mo = r["micro_ondes"]
    assert 2449 <= mo["pic_mhz"] <= 2451 and mo["max_db"] == -40
    assert mo["champ_v_m"] < 1
