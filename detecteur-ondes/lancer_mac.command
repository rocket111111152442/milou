#!/bin/bash
# Double-cliquez sur ce fichier dans le Finder (la première fois : clic droit > Ouvrir).
cd "$(dirname "$0")" || exit 1

if [ ! -x ".venv/bin/python" ]; then
    echo "Première utilisation : installation (une minute environ)..."
    if ! command -v python3 >/dev/null; then
        echo "Python 3.10+ est nécessaire : https://www.python.org/downloads/"
        read -r -p "Appuyez sur Entrée pour fermer."
        exit 1
    fi
    python3 -m venv .venv && .venv/bin/python -m pip install --upgrade pip >/dev/null || {
        read -r -p "L'installation a échoué. Appuyez sur Entrée pour fermer."
        exit 1
    }
fi
# Toujours vérifier les dépendances (rapide si déjà à jour) : une mise à jour du
# logiciel peut en ajouter de nouvelles, même quand .venv existait déjà.
.venv/bin/python -m pip install -q -r requirements.txt || {
    read -r -p "L'installation a échoué. Appuyez sur Entrée pour fermer."
    exit 1
}
.venv/bin/python -m veille_ondes
