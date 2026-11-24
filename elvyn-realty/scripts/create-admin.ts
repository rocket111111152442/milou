/**
 * Creates (or resets the password of) a CRM user.
 *   npm run admin:create -- --email elvyn@drspacefinders.com --name "Elvyn Arnaud"
 * The password is read from ADMIN_PASSWORD or typed interactively (never passed as an argument).
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { eq } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth/password";

async function main() {
  const args = process.argv.slice(2);
  const get = (k: string) => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const email = get("email")?.trim().toLowerCase();
  const name = get("name")?.trim() || "Administrador";
  if (!email) throw new Error("Uso: npm run admin:create -- --email <correo> --name <nombre>");
  let password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) {
    const rl = createInterface({ input: stdin, output: stdout });
    password = await rl.question("Contraseña (mín. 12 caracteres): ");
    rl.close();
  }
  const hash = await hashPassword(password);
  const { getDb, schema } = await import("../src/lib/db");
  const db = await getDb();
  const [existing] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, email));
  if (existing) await db.update(schema.adminUsers).set({ passwordHash: hash, name }).where(eq(schema.adminUsers.id, existing.id));
  else await db.insert(schema.adminUsers).values({ email, name, passwordHash: hash });
  console.log(existing ? `Contraseña actualizada para ${email}` : `Usuario creado: ${email}`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
