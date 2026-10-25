import json

from veille_ondes import wifi

NETSH_FR = """
Nom de l'interface : Wi-Fi
Il existe actuellement 3 réseaux visibles.

SSID 1 : Livebox-A1B2
    Type de réseau          : Infrastructure
    Authentification        : WPA2 - Personnel
    Chiffrement             : CCMP
    BSSID 1                 : 3c:52:a1:00:11:22
         Signal             : 100%
         Type de radio      : 802.11ax
         Bande              : 2,4 GHz
         Canal              : 6
         Débits de base (Mbits/s) : 1 2 5.5 11
    BSSID 2                 : 3c:52:a1:00:11:23
         Signal             : 86%
         Type de radio      : 802.11ax
         Bande              : 5 GHz
         Canal              : 36
         Utilisation des canaux : 12 (4 %)

SSID 2 :
    Type de réseau          : Infrastructure
    Authentification        : WPA2 - Personnel
    Chiffrement             : CCMP
    BSSID 1                 : aa:bb:cc:dd:ee:01
         Signal             : 30%
         Type de radio      : 802.11n
         Canal              : 11

SSID 3 : FreeWifi_secure
    Type de réseau          : Infrastructure
    Authentification        : Ouvrir
    Chiffrement             : Aucune
    BSSID 1                 : f4:ca:e5:00:00:01
         Signal             : 50%
         Bande              : 2,4 GHz
         Canal              : 1
"""

NETSH_EN = """
Interface name : Wi-Fi
There are 1 networks currently visible.

SSID 1 : Neighbour
    Network type            : Infrastructure
    Authentication          : WPA3-Personal
    Encryption              : CCMP
    BSSID 1                 : 10:20:30:40:50:60
         Signal             : 64%
         Radio type         : 802.11ax
         Band               : 6 GHz
         Channel            : 37
"""

NETSH_INTERFACES_FR = """
Il existe 1 interface sur le système :

    Nom                    : Wi-Fi
    Description            : Intel(R) Wi-Fi 6 AX201 160MHz
    État                   : connecté
    SSID                   : Livebox-A1B2
    BSSID                  : 3c:52:a1:00:11:23
    Type de réseau         : Infrastructure
"""


def test_netsh_francais():
    reseaux = wifi.analyser_netsh(NETSH_FR)
    assert [r.ssid for r in reseaux] == ["Livebox-A1B2", "Livebox-A1B2", "", "FreeWifi_secure"]
    box_24, box_5, masque, ouvert = reseaux
    assert box_24.bssid == "3c:52:a1:00:11:22"
    assert box_24.signal_dbm == -50 and box_24.signal_sature
    assert box_24.bande == "2,4 GHz" and box_24.canal == 6 and box_24.frequence_mhz == 2437
    assert box_5.signal_dbm == -57 and not box_5.signal_sature
    assert box_5.bande == "5 GHz" and box_5.frequence_mhz == 5180
    assert box_5.canal == 36  # « Utilisation des canaux » ne doit pas écraser le canal
    assert masque.bande == "2,4 GHz" and masque.frequence_mhz == 2462  # déduit du canal
    assert "WPA2" in box_24.securite and not box_24.ouvert
    assert ouvert.ouvert


def test_netsh_anglais_6ghz():
    (r,) = wifi.analyser_netsh(NETSH_EN)
    assert r.ssid == "Neighbour" and r.bande == "6 GHz" and r.frequence_mhz == 6135
    assert r.signal_dbm == -68


def test_netsh_interfaces():
    assert wifi.analyser_netsh_interfaces(NETSH_INTERFACES_FR) == ("Livebox-A1B2", "3c:52:a1:00:11:23")


def test_message_localisation_windows():
    message = wifi._message_erreur_windows(
        "Network shell commands need location permission to access WLAN information.")
    assert "Localisation" in message


NMCLI = (
    "*:MaBox:AA\\:BB\\:CC\\:DD\\:EE\\:FF:6:2437 MHz:100:WPA2\n"
    " :Voisin\\:5G:11\\:22\\:33\\:44\\:55\\:66:44:5220 MHz:52:WPA1 WPA2\n"
    " ::77\\:88\\:99\\:AA\\:BB\\:CC:1:2412 MHz:20:\n"
)


def test_nmcli():
    reseaux = wifi.analyser_nmcli(NMCLI)
    assert len(reseaux) == 3
    box, voisin, masque = reseaux
    assert box.connecte and box.bssid == "aa:bb:cc:dd:ee:ff" and box.signal_dbm == -40 and box.signal_sature
    assert voisin.ssid == "Voisin:5G" and voisin.bande == "5 GHz" and round(voisin.signal_dbm, 1) == -68.8
    assert masque.ssid == "" and masque.ouvert


SYSTEM_PROFILER = {
    "SPAirPortDataType": [{
        "spairport_airport_interfaces": [{
            "_name": "en0",
            "spairport_current_network_information": {
                "_name": "MaBox", "spairport_network_channel": "36 (5GHz, 80MHz)",
                "spairport_security_mode": "spairport_security_mode_wpa2_personal",
                "spairport_signal_noise": "-48 dBm / -95 dBm",
            },
            "spairport_airport_other_local_wireless_networks": [
                {"_name": "Voisin", "spairport_network_channel": "11 (2GHz, 20MHz)",
                 "spairport_security_mode": "spairport_security_mode_none",
                 "spairport_signal_noise": "-81 dBm / -96 dBm"},
            ],
        }]
    }]
}


def test_system_profiler():
    reseaux = wifi.analyser_system_profiler(json.dumps(SYSTEM_PROFILER))
    assert len(reseaux) == 2
    box, voisin = reseaux
    assert box.connecte and box.signal_dbm == -48 and box.bande == "5 GHz" and box.frequence_mhz == 5180
    assert "WPA2" in box.securite and not box.ouvert
    assert voisin.ouvert and voisin.bande == "2,4 GHz" and voisin.canal == 11


def test_system_profiler_json_invalide():
    assert wifi.analyser_system_profiler("pas du json") == []
