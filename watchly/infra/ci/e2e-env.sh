#!/usr/bin/env bash
# Prépare l'environnement E2E de la CI (à lancer depuis watchly/, après `supabase start`) :
# migrations, données de référence (prix Stripe fictifs du mode test), apps/web/.env.local.
# Aucun secret réel : clés de la pile Supabase locale, stripe-mock, poivre aléatoire.
set -euo pipefail
eval "$(supabase status -o env)"
DB=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DATABASE_URL="$DB" pnpm db:migrate
DATABASE_URL="$DB" STRIPE_PRICE_PLUS=price_1PlusLocal STRIPE_PRICE_PRO=price_1ProLocal STRIPE_PRICE_MAX=price_1MaxLocal STRIPE_PRICE_BUSINESS=price_1BusinessLocal STRIPE_PRICE_BUSINESS_EXTRA_SITE=price_1ExtraLocal pnpm db:seed
{
  echo "NEXT_PUBLIC_APP_URL=http://localhost:3000"
  echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL"
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"
  echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
  echo "DATABASE_URL=$DB"
  echo "WATCHLY_HASH_PEPPER=$(openssl rand -hex 32)"
  echo "STRIPE_SECRET_KEY=sk_test_123"
  echo "STRIPE_API_BASE=http://localhost:12111"
  echo "STRIPE_WEBHOOK_SECRET=whsec_ci_$(openssl rand -hex 16)"
  echo "ADMIN_REQUIRE_MFA=1"
} > apps/web/.env.local
echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY" >> "$GITHUB_ENV"
