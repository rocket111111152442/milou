import { runMigrations } from "./migrate.js";
import { closeDb } from "./db/client.js";

/** Point d'entrée CLI : npm run db:migrate (développement) ou node dist/migrate-cli.js (production). */
runMigrations()
  .then(async () => {
    console.log("Migrations appliquées.");
    await closeDb();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
