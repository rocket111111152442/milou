import math

from veille_ondes import exposition, sdr


def test_champ_v_m():
    # -40 dBm à 2 437 MHz avec une antenne 0 dBi ≈ 0,18 V/m
    assert math.isclose(exposition.champ_v_m(-40, 2437), 0.176, rel_tol=0.02)


def test_limites_reglementaires():
    assert exposition.limite_v_m(100) == 28
    assert round(exposition.limite_v_m(900)) == 41
    assert round(exposition.limite_v_m(1800)) == 58
    assert exposition.limite_v_m(2437) == 61


def test_cumul_et_format():
    assert math.isclose(exposition.cumul_v_m([3, 4]), 5)
    assert exposition.formater_v_m(0.176) == "0,18 V/m"
    assert exposition.formater_nombre(1234.6) == "1 235"


def _csv(bas_mhz, niveaux, pas_mhz=0.5):
    bas = int(bas_mhz * 1e6)
    haut = int(bas + pas_mhz * 1e6 * len(niveaux))
    return f"2026-10-25, 22:00:00, {bas}, {haut}, {int(pas_mhz * 1e6)}, 4096, " + ", ".join(map(str, niveaux))


def test_lecture_csv_et_detection():
    niveaux = [-40.0] * 200
    niveaux[50] = niveaux[51] = -15.0   # 433,25 et 433,75 MHz -> ISM 433
    niveaux[150] = -20.0                # 483,25 MHz -> TNT
    texte = _csv(408, niveaux)
    points = sdr.lire_csv_rtl_power(texte)
    assert len(points) == 200 and points[0][0] == 408.25
    emissions = sdr.detecter_emissions(points)
    assert len(emissions) == 2
    assert emissions[0]["bande"] == "ISM 433 MHz" and emissions[0]["debut_mhz"] == 433.25 and emissions[0]["fin_mhz"] == 433.75
    assert emissions[1]["bande"] == "TNT"


def test_bande_inconnue_et_artefact():
    assert sdr.identifier_bande(98.0)[0] == "Radio FM"
    assert sdr.identifier_bande(1650.0) is None
    niveaux = [-40.0] * 100
    niveaux[40] = -10.0   # 1 600 + 40,5×0,5 = 1 620,25 MHz : hors bandes
    emissions = sdr.detecter_emissions(sdr.lire_csv_rtl_power(_csv(1600, niveaux)))
    assert emissions[0]["bande"] is None and not emissions[0]["artefact_possible"]


def test_scanner_sans_cle(monkeypatch):
    monkeypatch.setattr(sdr, "trouver_rtl_power", lambda: None)
    r = sdr.scanner()
    assert not r["ok"] and r["disponible"] is False
