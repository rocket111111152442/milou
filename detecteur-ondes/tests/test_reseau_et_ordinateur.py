from veille_ondes import ordinateur, reseau_local

ARP_WINDOWS = """
Interface : 192.168.1.20 --- 0x7
  Adresse Internet      Adresse physique      Type
  192.168.1.1           3c-52-a1-00-11-22     dynamique
  192.168.1.34          da-a1-19-00-00-01     dynamique
  192.168.1.255         ff-ff-ff-ff-ff-ff     statique
  224.0.0.22            01-00-5e-00-00-16     statique
"""

ARP_MAC = """? (192.168.1.1) at 3c:52:a1:0:11:22 on en0 ifscope [ethernet]
? (192.168.1.40) at (incomplete) on en0 ifscope [ethernet]
? (192.168.1.41) at 0:1a:2b:3c:4d:5e on en0 ifscope [ethernet]
? (224.0.0.251) at 1:0:5e:0:0:fb on en0 ifscope permanent [ethernet]
"""

IP_NEIGH = """192.168.1.1 dev wlan0 lladdr 3c:52:a1:00:11:22 REACHABLE
192.168.1.50 dev wlan0  FAILED
192.168.1.51 dev wlan0 lladdr 02:11:22:33:44:55 STALE
"""


def test_arp_windows():
    appareils = reseau_local.analyser_arp_windows(ARP_WINDOWS)
    assert [a["ip"] for a in appareils] == ["192.168.1.1", "192.168.1.34"]
    assert appareils[0]["mac"] == "3c:52:a1:00:11:22"


def test_arp_mac_complete_les_zeros():
    appareils = reseau_local.analyser_arp_mac(ARP_MAC)
    assert [a["mac"] for a in appareils] == ["3c:52:a1:00:11:22", "00:1a:2b:3c:4d:5e"]


def test_ip_neigh():
    appareils = reseau_local.analyser_ip_neigh(IP_NEIGH)
    assert [a["ip"] for a in appareils] == ["192.168.1.1", "192.168.1.51"]


def test_mac_aleatoire():
    assert reseau_local.mac_aleatoire("da:a1:19:00:00:01")
    assert reseau_local.mac_aleatoire("02:11:22:33:44:55")
    assert not reseau_local.mac_aleatoire("3c:52:a1:00:11:22")


def test_passerelle():
    windows = "Itinéraires actifs :\n  0.0.0.0          0.0.0.0      192.168.1.1     192.168.1.20     35\n"
    assert reseau_local.analyser_passerelle(windows, "windows") == "192.168.1.1"
    assert reseau_local.analyser_passerelle("   route to: default\n    gateway: 192.168.0.254\n", "mac") == "192.168.0.254"
    assert reseau_local.analyser_passerelle("default via 10.0.0.1 dev wlan0 proto dhcp", "linux") == "10.0.0.1"


def test_outils_acces_distant():
    assert ordinateur.outil_acces_distant("AnyDesk.exe") == ("AnyDesk", False)
    assert ordinateur.outil_acces_distant("C:\\Program Files\\TeamViewer\\TeamViewer_Service.exe")[0] == "TeamViewer"
    assert ordinateur.outil_acces_distant("explorer.exe") is None
    assert ordinateur.outil_acces_distant("sshd") == ("Serveur SSH", True)


def test_outils_dans_le_demarrage():
    assert ordinateur.chercher_outils_dans_texte('AnyDesk — "C:\\Program Files (x86)\\AnyDesk\\AnyDesk.exe" --tray') == ["AnyDesk"]
    assert ordinateur.chercher_outils_dans_texte("OneDrive — C:\\Users\\moi\\OneDrive.exe /background") == []


def test_tasklist_et_ps():
    tasklist = '"System Idle Process","0","Services","0","8 Ko"\n"AnyDesk.exe","4242","Console","1","20 000 Ko"\n'
    assert ordinateur.analyser_tasklist(tasklist)[1] == {"pid": 4242, "nom": "AnyDesk.exe"}
    assert ordinateur.analyser_ps("  1 /sbin/launchd\n 512 /usr/sbin/sshd\n")[1] == {"pid": 512, "nom": "sshd"}
