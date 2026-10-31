#!/usr/bin/env bash
# Test de restauration : restaure une sauvegarde dans une base temporaire, vérifie son contenu,
# puis supprime la base temporaire. Ne touche JAMAIS à la base de production.
#
#   ADMIN_URL=postgresql://postgres:…@hote:5432/postgres ./pg-restore-check.sh /var/backups/waverti/waverti-….dump
#   PG_RESTORE : commande pg_restore de même version majeure que le serveur (facultatif).
set -euo pipefail
: "${ADMIN_URL:?ADMIN_URL est requis (connexion administrateur, base postgres)}"
dump=${1:?chemin de la sauvegarde requis}
PG_RESTORE=${PG_RESTORE:-pg_restore}
PSQL=${PSQL:-psql}
if [ -f "$dump.sha256" ]; then (cd "$(dirname "$dump")" && sha256sum -c "$(basename "$dump").sha256" >/dev/null); fi
db="waverti_restore_check_$(date +%s)"
target="${ADMIN_URL%/*}/$db"
$PSQL "$ADMIN_URL" -v ON_ERROR_STOP=1 -qc "create database $db"
trap '$PSQL "$ADMIN_URL" -qc "drop database if exists $db" >/dev/null' EXIT
$PG_RESTORE --no-owner --exit-on-error --dbname="$target" < "$dump"
$PSQL "$target" -v ON_ERROR_STOP=1 -tAc "select 'migrations=' || count(*) from waverti_migrations.schema_migrations"
$PSQL "$target" -v ON_ERROR_STOP=1 -tAc "select 'users=' || count(*) || ' profiles=' || (select count(*) from profiles) || ' tasks=' || (select count(*) from monitoring_tasks) || ' plans=' || (select count(*) from plans) from users"
echo "Restauration vérifiée : $dump"
