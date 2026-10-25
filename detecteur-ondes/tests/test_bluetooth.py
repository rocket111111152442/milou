from veille_ondes.bluetooth import classer, uuid_court


def test_uuid_court():
    assert uuid_court("0000FD5A-0000-1000-8000-00805F9B34FB") == "fd5a"
    assert uuid_court("6e400001-b5a3-f393-e0a9-e50e24dcca9e") == "6e400001-b5a3-f393-e0a9-e50e24dcca9e"


def test_airtag_separe():
    donnees = bytes([0x12, 0x19, 0x10]) + bytes(25)
    r = classer({0x004C: donnees}, [], {})
    assert r["traceur"] and r["traceur_separe"] and r["fabricant"] == "Apple"


def test_localiser_pres_du_proprietaire():
    r = classer({0x004C: bytes([0x12, 0x02, 0x00, 0x00])}, [], {})
    assert r["traceur"] and not r["traceur_separe"]


def test_iphone_n_est_pas_un_traceur():
    r = classer({0x004C: bytes([0x10, 0x05, 0x01, 0x18, 0x00, 0x00, 0x00])}, [], {})
    assert not r["traceur"] and "iPhone" in r["type"]


def test_smarttag_et_tile():
    assert classer({}, ["0000fd5a-0000-1000-8000-00805f9b34fb"], {})["traceur"]
    assert classer({}, [], {"0000feed-0000-1000-8000-00805f9b34fb": b"\x01"})["fabricant"] == "Tile"


def test_eddystone_ordinaire_vs_traceur_google():
    normal = classer({}, [], {"0000feaa-0000-1000-8000-00805f9b34fb": b"\x10\x00"})
    assert not normal["traceur"]
    separe = classer({}, [], {"0000feaa-0000-1000-8000-00805f9b34fb": b"\x41" + bytes(20)})
    assert separe["traceur"] and separe["traceur_separe"]


def test_appareil_inconnu():
    r = classer({0x0059: b"\x01\x02"}, [], {}, nom="Capteur")
    assert not r["traceur"] and r["fabricant"].startswith("Nordic")
