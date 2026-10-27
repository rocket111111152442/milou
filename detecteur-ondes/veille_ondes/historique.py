"""Enregistrement local des analyses et de la configuration (dossier « donnees »)."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

DOSSIER_PAR_DEFAUT = Path(__file__).resolve().parent.parent / "donnees"

CONFIG_PAR_DEFAUT = {
    "mes_wifi": [],                  # noms de vos propres réseaux Wi-Fi
    "appareils_reseau_connus": {},   # adresse MAC -> description
    "date_reference": None,
    "chemin_adb": None,              # emplacement d'adb.exe choisi à la main
    "port_tinysa": None,              # port série du tinySA choisi à la main (ex. : COM5)
}


class Historique:
    def __init__(self, dossier: Path | str | None = None):
        self.dossier = Path(dossier) if dossier else DOSSIER_PAR_DEFAUT
        self.dossier_analyses = self.dossier / "analyses"
        self.dossier_rapports = self.dossier / "rapports"
        self.fichier_config = self.dossier / "config.json"

    def _preparer(self) -> None:
        self.dossier_analyses.mkdir(parents=True, exist_ok=True)
        self.dossier_rapports.mkdir(parents=True, exist_ok=True)

    # --- analyses -------------------------------------------------------------

    def enregistrer(self, analyse: dict) -> Path:
        self._preparer()
        horodatage = datetime.fromisoformat(analyse["horodatage"])
        fichier = self.dossier_analyses / f"{horodatage:%Y-%m-%d_%H%M%S}.json"
        fichier.write_text(json.dumps(analyse, ensure_ascii=False, indent=1), encoding="utf-8")
        return fichier

    def charger(self, limite: int | None = None) -> list[dict]:
        if not self.dossier_analyses.exists():
            return []
        fichiers = sorted(self.dossier_analyses.glob("*.json"))
        if limite:
            fichiers = fichiers[-limite:]
        analyses = []
        for f in fichiers:
            try:
                analyses.append(json.loads(f.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError):
                continue
        return analyses

    # --- configuration -----------------------------------------------------------

    def config(self) -> dict:
        config = json.loads(json.dumps(CONFIG_PAR_DEFAUT))
        try:
            config.update(json.loads(self.fichier_config.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError):
            pass
        return config

    def enregistrer_config(self, config: dict) -> None:
        self.dossier.mkdir(parents=True, exist_ok=True)
        self.fichier_config.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")

    def definir_mes_wifi(self, noms: list[str]) -> dict:
        """Remplace la liste de vos réseaux Wi-Fi par celle indiquée."""
        config = self.config()
        config["mes_wifi"] = list(dict.fromkeys(n.strip() for n in noms if n.strip()))
        self.enregistrer_config(config)
        return config

    def marquer_reference(self, analyse: dict) -> int:
        """Enregistre les appareils actuellement sur le réseau comme « connus »."""
        config = self.config()
        appareils = analyse.get("reseau_local", {}).get("appareils", [])
        for a in appareils:
            config["appareils_reseau_connus"].setdefault(a["mac"], f"vu le {analyse['horodatage'][:16]} ({a['ip']})")
        config["date_reference"] = analyse["horodatage"]
        self.enregistrer_config(config)
        return len(appareils)
