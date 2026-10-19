#!/usr/bin/env bash
# Vérifications en lecture seule d'un déploiement : pages publiques, redirections, API protégée, noindex, en-têtes.
# Usage : bash scripts/tests/verif-production.sh https://acorimmo.vercel.app
B=${1:-https://acorimmo.vercel.app}
ok=0; ko=0
t() { # t "nom" commande-de-test
  if eval "$2" >/dev/null 2>&1; then echo "OK    $1"; ok=$((ok+1)); else echo "ÉCHEC $1"; ko=$((ko+1)); fi
}
code() { curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$@"; }
ID=$(curl -s --max-time 30 "$B/api/biens" | python3 -c "import json,sys; d=json.load(sys.stdin); print(next(b['id'] for b in d if b.get('photos') and b['statut']=='disponible'))")
echo "Bien testé : $ID"
for p in / /biens /bien/$ID /immobilier/la-seyne-sur-mer /immobilier/six-fours-les-plages /immobilier/sanary-sur-mer /immobilier/toulon /immobilier/saint-mandrier-sur-mer /agences.html /honoraires.html /mentions-legales.html /confidentialite.html /cookies.html /espace-client.html /admin /sitemap.xml /robots.txt; do
  t "200 $p" "[ \$(code '$B$p') = 200 ]"
done
t "404 bien inconnu" "[ \$(code '$B/bien/inexistant-xyz') = 404 ]"
t "301 /bien.html?id= → /bien/<id>" "curl -s -o /dev/null -D - --max-time 30 '$B/bien.html?id=$ID' | grep -qi '^location: .*/bien/$ID' && [ \$(code '$B/bien.html?id=$ID') = 308 -o \$(code '$B/bien.html?id=$ID') = 301 ]"
t "301 /bien.html → /biens" "curl -s -o /dev/null -D - --max-time 30 '$B/bien.html' | grep -qi '^location: .*/biens'"
for p in /api/admin/biens /api/admin/demandes /api/admin/contacts /api/admin/utilisateurs /api/auth/me; do
  t "401 $p (sans session)" "[ \$(code '$B$p') = 401 ]"
done
t "403 écriture admin sans origine (CSRF)" "c=\$(code -X POST -H 'content-type: application/json' -d '{}' '$B/api/admin/biens'); [ \$c = 403 -o \$c = 401 ]"
t "API de synchronisation fermée sans clé" "c=\$(code '$B/api/v1/biens'); [ \$c = 401 -o \$c = 503 ]"
t "noindex sur l'accueil" "curl -s --max-time 30 '$B/' | grep -q 'name=\"robots\" content=\"noindex'"
t "noindex sur une fiche" "curl -s --max-time 30 '$B/bien/$ID' | grep -q 'name=\"robots\" content=\"noindex'"
t "robots.txt : Disallow /" "curl -s --max-time 30 '$B/robots.txt' | grep -q '^Disallow: /\$'"
t "X-Robots-Tag noindex sur /admin/" "curl -s -I --max-time 30 '$B/admin/index.html' | grep -qi 'x-robots-tag: noindex'"
t "CSP présente" "curl -s -I --max-time 30 '$B/' | grep -qi '^content-security-policy:.*player.previsite.net'"
t "HSTS présent" "curl -s -I --max-time 30 '$B/' | grep -qi '^strict-transport-security'"
t "X-Frame-Options DENY" "curl -s -I --max-time 30 '$B/' | grep -qi '^x-frame-options: deny'"
PH=$(curl -s --max-time 30 "$B/api/biens/$ID" | python3 -c "import json,sys; print(json.load(sys.stdin)['photos'][0])" 2>/dev/null || curl -s --max-time 30 "$B/api/biens" | python3 -c "import json,sys; print(next(b for b in json.load(sys.stdin) if b['id']=='$ID')['photos'][0])")
t "photo servie (image/webp) : $PH" "curl -s -o /dev/null -D - --max-time 30 '$B$PH' | grep -qi '^content-type: image/webp'"
t "aucune donnée privée dans l'API publique" "! curl -s --max-time 30 '$B/api/biens' | grep -q '\"adresse\"\\|\"externalRef\"\\|\"etapeVente\"'"
N=$(curl -s --max-time 30 "$B/api/biens" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
t "biens publiés en ligne : $N" "[ $N -ge 194 ]"
echo "$ok réussies, $ko échouées"
