#!/usr/bin/env bash
# Prépare l'environnement E2E (CI ou poste local), à lancer depuis waverti/ :
# PostgreSQL (port 55432, base « waverti »), Mailpit (SMTP 1025 / API 8025) et stripe-mock (12111) doivent tourner.
# Migrations, données de référence (prix Stripe fictifs du mode test) et apps/web/.env.local.
# Aucun secret réel : clés générées aléatoirement, stripe-mock, e-mails capturés par Mailpit.
set -euo pipefail
DB=${E2E_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:55432/waverti}
psql "${DB%/*}/postgres" -tAc "select 1 from pg_database where datname = 'waverti'" | grep -q 1 || psql "${DB%/*}/postgres" -c "create database waverti"
DATABASE_URL="$DB" pnpm db:migrate
DATABASE_URL="$DB" STRIPE_PRICE_PLUS=price_1PlusLocal STRIPE_PRICE_PRO=price_1ProLocal STRIPE_PRICE_MAX=price_1MaxLocal STRIPE_PRICE_BUSINESS=price_1BusinessLocal STRIPE_PRICE_BUSINESS_EXTRA_SITE=price_1ExtraLocal pnpm db:seed
{
  echo "NEXT_PUBLIC_APP_URL=http://localhost:3000"
  echo "DATABASE_URL=$DB"
  echo "WAVERTI_HASH_PEPPER=$(openssl rand -hex 32)"
  echo "WAVERTI_ENCRYPTION_KEY=$(openssl rand -base64 32)"
  echo "SMTP_URL=smtp://127.0.0.1:1025"
  echo "EMAIL_FROM=Waverti <alertes@waverti.test>"
  echo "STRIPE_SECRET_KEY=sk_test_123"
  echo "STRIPE_API_BASE=http://localhost:12111"
  echo "STRIPE_WEBHOOK_SECRET=whsec_ci_$(openssl rand -hex 16)"
  echo "ADMIN_REQUIRE_MFA=1"
} > apps/web/.env.local
