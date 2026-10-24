#!/bin/sh
set -e
cd "$(dirname "$0")"
for p in page_index page_savoir page_produits page_repas page_contact page_misc; do python3 $p.py; done
