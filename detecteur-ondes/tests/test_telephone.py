from datetime import date

from veille_ondes import telephone
from veille_ondes.analyse import evaluer

PM_LIST = """package:com.whatsapp  installer=com.android.vending
package:com.systemservice  installer=null
package:com.exemple.cache  installer=com.google.android.packageinstaller
"""

DEVICE_POLICY = """Current Device Policy Manager state:
  Immutable state:
    mHasFeature=true
  Enabled Device Admins (User 0, provisioningState: 3):
    com.google.android.gms/com.google.android.gms.mdm.receivers.MdmDeviceAdminReceiver:
      uid=10123
      testOnlyAdmin=false
      policies:
        wipe-data
        force-lock
    com.exemple.cache/.AdminRecepteur:
      uid=10456
      policies:
        force-lock
  Device Owner:
    admin=ComponentInfo{com.entreprise.mdm/com.entreprise.mdm.Admin}
  mPasswordOwner=-1
    com.pas.un.admin/.Truc:
"""

DUMPSYS = """Packages:
  Package [com.exemple.cache] (a1b2c3):
    userId=10456
    firstInstallTime=2026-10-20 09:12:01
    install permissions:
      android.permission.INTERNET: granted=true
    User 0: ceDataInode=1234 installed=true hidden=false suspended=false stopped=false notLaunched=false enabled=0 instant=false
      runtime permissions:
        android.permission.RECORD_AUDIO: granted=true, flags=[ USER_SET ]
        android.permission.ACCESS_FINE_LOCATION: granted=true, flags=[ USER_SET ]
        android.permission.READ_SMS: granted=true, flags=[ USER_SET ]
        android.permission.CAMERA: granted=false, flags=[ USER_SET ]
  Package [com.whatsapp] (d4e5f6):
    firstInstallTime=2023-01-02 10:00:00
    User 0: ceDataInode=99 installed=true hidden=false enabled=3 instant=false
"""

LANCEURS = """2 activities found:
  Activity #0:
    priority=0 preferredOrder=0 match=0x108000 specificIndex=-1 isDefault=false
    com.whatsapp/.Main
  Activity #1:
    priority=0 preferredOrder=0 match=0x108000 specificIndex=-1 isDefault=false
    com.android.settings/.Settings
"""


def test_adb_devices():
    texte = "List of devices attached\nR58N12ABC\tdevice\nemulator-5554\tunauthorized\n\n"
    assert telephone.analyser_adb_devices(texte) == [("R58N12ABC", "device"), ("emulator-5554", "unauthorized")]


def test_liste_paquets():
    paquets = telephone.analyser_liste_paquets(PM_LIST)
    assert paquets == {"com.whatsapp": "com.android.vending", "com.systemservice": None,
                       "com.exemple.cache": "com.google.android.packageinstaller"}


def test_composants():
    assert telephone.analyser_composants("com.a/com.a.S:com.b/.T") == {"com.a", "com.b"}
    assert telephone.analyser_composants("null") == set()


def test_administrateurs():
    admins = telephone.analyser_administrateurs(DEVICE_POLICY)
    assert admins == {"com.google.android.gms", "com.exemple.cache", "com.entreprise.mdm"}


def test_dumpsys_paquets():
    infos = telephone.analyser_dumpsys_paquets(DUMPSYS)
    cache = infos["com.exemple.cache"]
    assert cache["installe_le"] == "2026-10-20"
    assert "android.permission.RECORD_AUDIO" in cache["permissions"]
    assert "android.permission.CAMERA" not in cache["permissions"]
    assert not cache["desactive"] and infos["com.whatsapp"]["desactive"]


def test_lanceurs():
    assert telephone.analyser_lanceurs(LANCEURS) == {"com.whatsapp", "com.android.settings"}


def test_jours_depuis():
    assert telephone.jours_depuis("2026-04-05", date(2026, 10, 25)) == 203
    assert telephone.jours_depuis("") is None


def test_indicateurs_fournis():
    index = telephone.index_indicateurs(telephone.charger_indicateurs())
    assert len(index) > 500
    assert index["com.systemservice"]["type"] == "stalkerware"


def test_conversion_yaml_echap():
    yaml = """- name: Exemple
  names:
  - Autre nom
  type: stalkerware
  packages:
  - com.espion.un
  - com.espion.deux
  certificates:
  - ABCDEF
- name: Sans paquet
  type: stalkerware
  websites:
  - exemple.com
"""
    assert telephone.convertir_yaml_echap(yaml) == [
        {"nom": "Exemple", "type": "stalkerware", "paquets": ["com.espion.un", "com.espion.deux"]}]


def test_evaluation_des_applications():
    whatsapp = telephone.evaluer_application("com.whatsapp", "com.android.vending", False, False, False, True,
                                             {"android.permission.RECORD_AUDIO"}, None)
    assert whatsapp["niveau"] == "normal"
    montre = telephone.evaluer_application("com.montre", "com.android.vending", False, False, True, True, set(), None)
    assert montre["niveau"] == "normal" and montre["acces_puissant"]
    apk = telephone.evaluer_application("com.jeu.modifie", None, False, False, False, True, set(), None)
    assert apk["niveau"] == "a_verifier"
    espion = telephone.evaluer_application(
        "com.exemple.cache", "com.google.android.packageinstaller", True, True, False, False,
        {"android.permission.RECORD_AUDIO", "android.permission.ACCESS_FINE_LOCATION", "android.permission.READ_SMS"},
        None)
    assert espion["niveau"] == "important" and espion["score"] >= 5
    connu = telephone.evaluer_application("com.systemservice", "com.android.vending", False, False, False, True,
                                          set(), {"nom": "TheTruthSpy", "type": "stalkerware"})
    assert connu["niveau"] == "important" and "TheTruthSpy" in connu["raisons"][0]


def _analyse_telephone(applications, correctif="2026-09-01", root=False):
    return {"horodatage": "2026-10-25T12:00:00", "lieu": "téléphone", "telephone": {
        "ok": True, "appareil": {"serie": "X", "fabricant": "Samsung", "modele": "Galaxy", "android": "15",
                                 "correctif_securite": correctif, "root": root},
        "nb_applications": 250, "applications": applications, "connus_systeme": [],
        "autorises_a_installer": [], "icones_verifiees": True, "indicateurs": {"nb_paquets": 644}}}


def test_constats_telephone():
    propre = evaluer(_analyse_telephone([]), [], {})
    assert any(c.niveau == "normal" and c.domaine == "Téléphone" for c in propre)
    espion = telephone.evaluer_application("com.x.y", None, True, True, False, False, set(), None)
    constats = evaluer(_analyse_telephone([espion], correctif="2024-01-01", root=True), [], {})
    niveaux = {(c.niveau, c.titre.split(":")[0]) for c in constats}
    assert ("important", "Application à examiner ") in niveaux
    assert any("rooté" in c.titre for c in constats)
    assert any("Correctifs de sécurité" in c.titre for c in constats)
