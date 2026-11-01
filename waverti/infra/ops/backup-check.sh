#!/usr/bin/env bash
# Sauvegarde logique + PREUVE de restauration d'une base Waverti. LECTURE SEULE sur la base source.
#
#   SOURCE_URL='<adresse directe (non poolée) de la base à sauvegarder>' \
#   SCRATCH_ADMIN_URL='postgres://postgres:…@127.0.0.1:5432/postgres' \   # serveur JETABLE (jamais la production)
#   bash infra/ops/backup-check.sh [dossier-de-sortie]
#
# Étapes : 1) pg_dump au format custom ; 2) pg_restore --list (lisibilité) ; 3) restauration dans une base jetable créée sur le serveur
# SCRATCH ; 4) comparaison du nombre de lignes de CHAQUE table (public + waverti_migrations) source / restauration ; 5) suppression de
# la base jetable. Code de sortie ≠ 0 au moindre écart. L'adresse de connexion n'est jamais affichée.
set -euo pipefail
: "${SOURCE_URL:?SOURCE_URL requis}"
: "${SCRATCH_ADMIN_URL:?SCRATCH_ADMIN_URL requis (serveur jetable)}"
OUT="${1:-./backups}"; mkdir -p "$OUT"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"; FILE="$OUT/waverti-$STAMP.dump"
SCRATCH_DB="waverti_restore_check_${STAMP,,}"
SRC_HOST="$(printf '%s' "$SOURCE_URL" | sed -E 's#^[a-z]+://[^@]*@([^/:?]+).*#\1#')"
SCR_HOST="$(printf '%s' "$SCRATCH_ADMIN_URL" | sed -E 's#^[a-z]+://[^@]*@([^/:?]+).*#\1#')"
if [ "$SRC_HOST" = "$SCR_HOST" ]; then echo "Refus : le serveur jetable est le même que la source." >&2; exit 2; fi
scratch_url() { printf '%s' "$SCRATCH_ADMIN_URL" | sed -E "s#/[^/?]*(\\?|\$)#/$SCRATCH_DB\\1#"; }

echo "1/5 pg_dump (lecture seule)…"
pg_dump --format=custom --no-owner --no-privileges --file "$FILE" "$SOURCE_URL"
echo "    fichier : $FILE ($(du -h "$FILE" | cut -f1)) sha256 $(sha256sum "$FILE" | cut -d' ' -f1)"
echo "2/5 pg_restore --list…"
N_OBJ=$(pg_restore --list "$FILE" | grep -vc '^;' || true); echo "    $N_OBJ objets listés"; [ "$N_OBJ" -gt 10 ]
echo "3/5 restauration dans une base jetable…"
psql "$SCRATCH_ADMIN_URL" -qc "create database \"$SCRATCH_DB\""
trap 'psql "$SCRATCH_ADMIN_URL" -qc "drop database if exists \"$SCRATCH_DB\" with (force)" >/dev/null 2>&1 || true' EXIT
pg_restore --no-owner --no-privileges --exit-on-error --dbname "$(scratch_url)" "$FILE"
echo "4/5 comparaison des lignes table par table…"
COUNT_SQL="select n.nspname||'.'||c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('public','waverti_migrations') order by 1"
BAD=0
for T in $(psql "$SOURCE_URL" -Atc "$COUNT_SQL"); do
  A=$(psql "$SOURCE_URL" -Atc "select count(*) from $T"); B=$(psql "$(scratch_url)" -Atc "select count(*) from $T")
  if [ "$A" != "$B" ]; then echo "    ÉCART $T : source $A / restauré $B"; BAD=1; fi
done
[ "$BAD" = 0 ] && echo "    toutes les tables concordent"
echo "5/5 base jetable supprimée."
[ "$BAD" = 0 ] && echo "SAUVEGARDE VALIDÉE : $FILE" || { echo "SAUVEGARDE NON VALIDÉE" >&2; exit 1; }
