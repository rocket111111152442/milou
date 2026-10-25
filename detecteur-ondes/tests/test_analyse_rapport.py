from veille_ondes import analyse, rapport
from veille_ondes.historique import Historique


def reseau(ssid, bssid, dbm, securite="WPA2 - Personnel / CCMP", ouvert=False, connecte=False):
    return {"ssid": ssid, "bssid": bssid, "signal_dbm": dbm, "signal_sature": False, "canal": 6,
            "frequence_mhz": 2437, "bande": "2,4 GHz", "securite": securite, "ouvert": ouvert, "connecte": connecte}


def analyse_type(**extra):
    a = {
        "horodatage": "2026-10-25T22:00:00", "lieu": "chambre", "systeme": "Test", "version": "1.0.0",
        "wifi": {"ok": True, "reseaux": [
            reseau("MaBox", "3c:52:a1:00:11:22", -45, connecte=True),
            reseau("MaBox", "3c:52:a1:00:11:23", -50),
            reseau("Voisin", "10:20:30:40:50:60", -72),
        ]},
        "bluetooth": {"ok": True, "duree_s": 15, "appareils": [
            {"adresse": "AA", "nom": None, "rssi_max": -80, "traceur": False, "traceur_separe": False,
             "type": "iPhone", "fabricant": "Apple", "nb_annonces": 4},
        ]},
        "reseau_local": {"ok": True, "reseau": "192.168.1.0/24", "mon_ip": "192.168.1.20", "appareils": [
            {"ip": "192.168.1.1", "mac": "3c:52:a1:00:11:22", "passerelle": True, "mac_aleatoire": False},
        ]},
        "ordinateur": {"ok": True, "nb_processus": 120, "outils_acces_distant": [], "outils_au_demarrage": [],
                       "ports_acces_distant": [], "ecoute": [], "connexions_etablies": [], "demarrage": []},
        "sdr": {"ok": False, "disponible": False, "emissions": []},
    }
    a.update(extra)
    return a


def niveaux(constats):
    return [c.niveau for c in constats]


def test_situation_normale_sans_alerte():
    constats = analyse.evaluer(analyse_type(), [], {"mes_wifi": [], "appareils_reseau_connus": {}})
    assert "important" not in niveaux(constats)
    assert "a_verifier" not in niveaux(constats)
    expo = [c for c in constats if c.domaine == "Exposition" and "Wi-Fi" in c.titre][0]
    assert "61 V/m" in expo.detail
    assert analyse.synthese(constats).startswith("Rien d'anormal")


def test_logiciel_de_prise_de_controle():
    a = analyse_type()
    a["ordinateur"]["outils_acces_distant"] = [{"nom": "AnyDesk", "integre": False, "processus": ["AnyDesk.exe (pid 1)"]}]
    constats = analyse.evaluer(a, [], {})
    assert constats[0].niveau == "important" and "AnyDesk" in constats[0].titre


def test_mon_wifi_ouvert_et_faux_point_acces():
    a = analyse_type()
    a["wifi"]["reseaux"].append(reseau("MaBox", "de:ad:be:ef:00:01", -60, securite="Ouvrir / Aucune", ouvert=True))
    constats = analyse.evaluer(a, [], {})
    assert any(c.niveau == "important" and "même nom" in c.titre for c in constats)

    seul_ouvert = analyse_type()
    seul_ouvert["wifi"]["reseaux"] = [reseau("MaBox", "3c:52:a1:00:11:22", -45, securite="Ouvrir", ouvert=True,
                                             connecte=True)]
    assert any("pas de mot de passe" in c.titre for c in analyse.evaluer(seul_ouvert, [], {}))


def test_nouvel_emetteur_avec_le_nom_de_ma_box():
    precedentes = [analyse_type() for _ in range(3)]
    a = analyse_type()
    a["wifi"]["reseaux"].append(reseau("MaBox", "de:ad:be:ef:00:01", -60))
    a["wifi"]["reseaux"].append(reseau("MaBox", "3e:52:a1:00:11:2f", -60))  # même famille d'adresses : pas d'alerte
    constats = analyse.evaluer(a, precedentes, {})
    alertes = [c for c in constats if "Nouvel émetteur" in c.titre]
    assert len(alertes) == 1 and "de:ad:be:ef:00:01" in alertes[0].detail and "3e:52" not in alertes[0].detail


def test_traceur_separe_proche():
    a = analyse_type()
    a["bluetooth"]["appareils"].append({"adresse": "BB", "rssi_max": -58, "traceur": True, "traceur_separe": True,
                                        "type": "AirTag", "nb_annonces": 30})
    constats = analyse.evaluer(a, [], {})
    assert any(c.niveau == "a_verifier" and "traceur" in c.titre for c in constats)


def test_nouvel_appareil_sur_le_reseau():
    a = analyse_type()
    a["reseau_local"]["appareils"].append({"ip": "192.168.1.66", "mac": "00:11:22:33:44:55",
                                           "passerelle": False, "mac_aleatoire": False})
    config = {"appareils_reseau_connus": {"3c:52:a1:00:11:22": "box"}}
    constats = analyse.evaluer(a, [], config)
    assert any(c.niveau == "a_verifier" and "jamais vu" in c.titre for c in constats)


def test_rapport_echappe_les_noms(tmp_path):
    a = analyse_type()
    a["wifi"]["reseaux"].append(reseau("<script>alert(1)</script>", "11:11:11:11:11:11", -80))
    constats = analyse.evaluer(a, [], {})
    html = rapport.generer(a, constats, analyse.synthese(constats), [analyse_type(), a], {})
    assert "<script>alert" not in html and "&lt;script&gt;" in html
    assert "Comparaison des pièces" in html and "<svg" in html


def test_historique(tmp_path):
    h = Historique(tmp_path)
    h.enregistrer(analyse_type())
    assert len(h.charger()) == 1
    h.definir_mes_wifi(["MaBox", " MaBox ", ""])
    assert h.config()["mes_wifi"] == ["MaBox"]
    assert h.marquer_reference(analyse_type()) == 1
    assert "3c:52:a1:00:11:22" in h.config()["appareils_reseau_connus"]


def test_synthese_ne_parle_pas_de_ce_qui_n_a_pas_ete_mesure():
    a = analyse_type()
    a["wifi"] = {"ok": False, "erreur": "pas de carte", "reseaux": []}
    a["bluetooth"] = {"ok": False, "erreur": "pas d'adaptateur", "appareils": []}
    texte = analyse.synthese(analyse.evaluer(a, [], {}))
    assert "émissions" not in texte
    assert "Non mesuré cette fois" in texte and "Wi-Fi" in texte and "Bluetooth" in texte


def test_reseau_local_vide_n_est_pas_rassurant():
    a = analyse_type()
    a["reseau_local"]["appareils"] = []
    constats = analyse.evaluer(a, [], {})
    assert any(c.domaine == "Réseau local" and c.niveau == "non_mesure" for c in constats)
