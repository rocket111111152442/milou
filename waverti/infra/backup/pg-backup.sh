#!/usr/bin/env bash
# Sauvegarde PostgreSQL de Waverti (format custom, compressé), avec empreinte SHA-256, chiffrement
# facultatif (age) et rotation. À planifier (cron/systemd) sur le serveur, PUIS copier hors du serveur.
#
#   DATABASE_URL=postgresql://… BACKUP_DIR=/var/backups/waverti ./pg-backup.sh
#   Options : BACKUP_KEEP_DAYS (14), BACKUP_AGE_RECIPIENT (clé publique age → fichier .age chiffré),
#             PG_DUMP (commande pg_dump de même version majeure que le serveur, ex.
#             « docker exec -i waverti-postgres pg_dump »).
# Une sauvegarde n'est considérée valable qu'après un test de restauration (pg-restore-check.sh).
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL est requis}"
DIR=${BACKUP_DIR:-./backups}
KEEP=${BACKUP_KEEP_DAYS:-14}
PG_DUMP=${PG_DUMP:-pg_dump}
mkdir -p "$DIR"
umask 077
ts=$(date -u +%Y%m%dT%H%M%SZ)
file="$DIR/waverti-$ts.dump"
# --no-owner : restaurable par un autre rôle ; les droits (GRANT au rôle app_user) sont conservés.
$PG_DUMP --format=custom --compress=6 --no-owner --dbname="$DATABASE_URL" > "$file.partial"
mv "$file.partial" "$file"
if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  age --recipient "$BACKUP_AGE_RECIPIENT" --output "$file.age" "$file"
  rm -f "$file"
  file="$file.age"
fi
(cd "$DIR" && sha256sum "$(basename "$file")" > "$(basename "$file").sha256")
find "$DIR" -maxdepth 1 -name 'waverti-*.dump*' -mtime +"$KEEP" -delete
echo "$file"
