#!/bin/bash
# Prérequis : python3, python3-venv, python3-tk, NetworkManager (nmcli) et BlueZ.
cd "$(dirname "$0")" || exit 1

if [ ! -x ".venv/bin/python" ]; then
    echo "Première utilisation : installation..."
    python3 -m venv .venv && .venv/bin/python -m pip install --upgrade pip >/dev/null || {
        echo "Échec. Sur Debian/Ubuntu : sudo apt install python3-venv python3-tk"
        exit 1
    }
fi
# Toujours vérifier les dépendances (rapide si déjà à jour) : une mise à jour du
# logiciel peut en ajouter de nouvelles, même quand .venv existait déjà.
.venv/bin/python -m pip install -q -r requirements.txt || {
    echo "Échec de l'installation des dépendances."
    exit 1
}
exec .venv/bin/python -m veille_ondes "$@"
