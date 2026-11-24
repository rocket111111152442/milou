/** Applies SQL migrations to DATABASE_URL (or the local PGlite database). */
async function main() {
  const { getDb } = await import("../src/lib/db");
  await getDb();
  console.log("Migraciones aplicadas.");
  process.exit(0);
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
