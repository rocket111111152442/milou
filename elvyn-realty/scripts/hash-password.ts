/** Prints the scrypt hash of a password (for ADMIN_BOOTSTRAP_PASSWORD_HASH). Reads it from stdin. */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hashPassword } from "../src/lib/auth/password";

const rl = createInterface({ input: stdin, output: stdout });
const pw = process.env.ADMIN_PASSWORD || (await rl.question("Contraseña: "));
rl.close();
console.log(await hashPassword(pw));
