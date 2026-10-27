from veille_ondes import cameras, sdr
from veille_ondes.analyse import evaluer


def test_noms_de_camera():
    for nom in ("IPC-8812", "HDWiFiCam_12AB", "V380-123456", "MV+123456789", "Tapo_C200_1A2B", "spy cam",
                "Hikvision-DS2CD", "CAM_salon"):
        assert cameras.nom_ressemble_a_camera(nom), nom
    for nom in ("Livebox-A1B2", "Freebox-4C21AB", "Camille", "Spyder", "DIRECT-5E-HP OfficeJet", None, ""):
        assert not cameras.nom_ressemble_a_camera(nom), nom


def test_reponse_http_de_camera():
    texte = ('HTTP/1.1 401 Unauthorized\r\nServer: Hikvision-Webs\r\n'
             'WWW-Authenticate: Digest realm="IP Camera(C1234)", nonce="x"\r\n\r\n<html><title>Login</title>')
    indices = cameras.analyser_reponse_http(texte)
    assert len(indices) == 2 and "Hikvision" in indices[0]
    assert cameras.analyser_reponse_http("HTTP/1.1 200 OK\r\nServer: nginx\r\n\r\n<title>Livebox</title>") == []


def test_reponse_onvif():
    texte = ('<d:Scopes>onvif://www.onvif.org/type/video_encoder onvif://www.onvif.org/name/IPC%20Salon '
             'onvif://www.onvif.org/hardware/C6N</d:Scopes>')
    assert cameras.analyser_reponse_onvif(texte) == {"name": "IPC Salon", "hardware": "C6N"}


def test_scanner_cameras(monkeypatch):
    examens = {
        "192.168.1.1": {"ip": "192.168.1.1", "ports": [80, 554], "rtsp": True, "indices_web": []},
        "192.168.1.30": {"ip": "192.168.1.30", "ports": [554, 80], "rtsp": True, "indices_web": []},
        "192.168.1.31": {"ip": "192.168.1.31", "ports": [6668], "rtsp": False, "indices_web": []},
        "192.168.1.32": {"ip": "192.168.1.32", "ports": [80], "rtsp": False, "indices_web": []},
    }
    monkeypatch.setattr(cameras, "examiner_appareil", lambda ip: examens[ip])
    monkeypatch.setattr(cameras, "decouverte_onvif", lambda: {})
    reseau = {"ok": True, "appareils": [
        {"ip": ip, "mac": f"00:00:00:00:00:{i:02x}", "passerelle": ip.endswith(".1")}
        for i, ip in enumerate(examens)]}
    wifi = {"ok": True, "reseaux": [{"ssid": "IPC-8812", "bssid": "aa:aa:aa:aa:aa:aa", "signal_dbm": -48},
                                    {"ssid": "Livebox-A1B2", "bssid": "bb:bb:bb:bb:bb:bb", "signal_dbm": -40}]}
    r = cameras.scanner(reseau, wifi, None)
    assert [c["ip"] for c in r["cameras_reseau"]] == ["192.168.1.30"]
    assert {a["ip"] for a in r["autres_appareils_reseau"]} == {"192.168.1.1", "192.168.1.31"}
    assert r["wifi_cameras"][0]["ssid"] == "IPC-8812"
    constats = evaluer({"cameras": r}, [], {})
    assert sum(1 for c in constats if c.niveau == "a_verifier") == 2


def test_aucune_camera_ne_rassure_pas_trop(monkeypatch):
    monkeypatch.setattr(cameras, "examiner_appareil", lambda ip: {"ip": ip, "ports": [], "rtsp": False,
                                                                 "indices_web": []})
    monkeypatch.setattr(cameras, "decouverte_onvif", lambda: {})
    r = cameras.scanner({"ok": True, "appareils": [{"ip": "192.168.1.1", "mac": "00:00:00:00:00:01"}]}, None, None)
    (constat,) = evaluer({"cameras": r}, [], {})
    assert constat.niveau == "normal" and "carte mémoire" in constat.detail


def test_sortie_tinysa():
    texte = "scan 2400000000 2500000000 290 3\r\n2400000000 -87.50\r\n2400344827 -60.25\r\nch> "
    assert sdr.analyser_sortie_tinysa(texte) == [(2400.0, -87.5), (2400.3448, -60.25)]


def test_sortie_tinysa_format_firmware_recent():
    """Micrologiciel v1.4-217 (et d'autres) : notation scientifique et une 3e colonne (trace
    mémorisée) à ignorer. C'était rejeté par erreur (0 point mesuré) avant correction."""
    texte = ("scan 2400000000 2500000000 20 3\r\n"
             "2400000000 -8.881250e+01 0.000000000 \r\n"
             "2442105263 -4.925000e+01 0.000000000 \r\n"
             "ch> ")
    assert sdr.analyser_sortie_tinysa(texte) == [(2400.0, -88.8125), (2442.1053, -49.25)]


def test_csv_hackrf_garde_le_maximum():
    lignes = ["2026-10-25, 22:00:00, 2400000000, 2405000000, 1000000.00, 20, -70, -60, -70, -70, -70",
              "2026-10-25, 22:00:01, 2400000000, 2405000000, 1000000.00, 20, -70, -30, -70, -70, -70"]
    points = sdr.lire_csv_rtl_power("\n".join(lignes), combiner="max")
    assert dict(points)[2401.5] == -30


def _sdr(max_db, absolu=True, materiel="tinysa"):
    points = [(2400 + i, -90.0) for i in range(100)]
    points[50] = (2450, max_db)
    return {"ok": True, "source": "tinySA", "materiel": materiel, "absolu": absolu, "emissions": [],
            "micro_ondes": sdr.resume_bande_micro_ondes(points, absolu)}


def test_resume_bande_micro_ondes():
    mo = _sdr(-30)["micro_ondes"]
    assert mo["pic_mhz"] == 2450 and mo["max_db"] == -30
    assert 0.1 < mo["champ_v_m"] < 1  # -30 dBm à 2,45 GHz ≈ 0,6 V/m


def test_comparaison_avec_le_four():
    reference = {"horodatage": "2026-10-25T10:00:00", "lieu": "test micro-ondes", "sdr": _sdr(-20)}
    calme = evaluer({"lieu": "chambre", "sdr": _sdr(-50)}, [reference], {})
    mo = [c for c in calme if c.domaine == "Micro-ondes (2,4 GHz)"][0]
    assert mo.niveau == "normal" and "30 dB sous votre four" in mo.titre and "1 000 fois moins" in mo.detail
    fort = evaluer({"lieu": "chambre", "sdr": _sdr(-21)}, [reference], {})
    assert [c for c in fort if c.domaine == "Micro-ondes (2,4 GHz)"][0].niveau == "a_verifier"
    ref = evaluer({"lieu": "Test micro-ondes", "sdr": _sdr(-20)}, [], {})
    assert [c for c in ref if c.domaine == "Micro-ondes (2,4 GHz)"][0].titre.startswith("Mesure de référence")


def test_cle_rtl_ne_couvre_pas_les_micro_ondes():
    s = {"ok": True, "source": "clé RTL-SDR", "materiel": "rtlsdr", "absolu": False, "emissions": [],
         "micro_ondes": None}
    constats = evaluer({"lieu": "salon", "sdr": s}, [], {})
    assert any(c.niveau == "non_mesure" and "2,45 GHz" in c.titre for c in constats)


def test_camera_connue_n_alerte_pas():
    cam = {"ok": True, "reseau_verifie": True, "wifi_cameras": [], "bluetooth_cameras": [],
           "autres_appareils_reseau": [],
           "cameras_reseau": [{"ip": "192.168.1.42", "mac": "c0:56:e3:11:22:33", "indices": ["RTSP"], "ports": []}]}
    connue = evaluer({"cameras": cam}, [], {"appareils_reseau_connus": {"c0:56:e3:11:22:33": "ma caméra"}})
    assert [c.niveau for c in connue] == ["info"]
    inconnue = evaluer({"cameras": cam}, [], {"appareils_reseau_connus": {}})
    assert [c.niveau for c in inconnue] == ["a_verifier"]
