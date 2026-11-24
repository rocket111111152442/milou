/**
 * Minimal structured logger. Only pass identifiers and technical fields:
 * never tokens, message bodies, names, emails or phone numbers.
 */
type Fields = Record<string, string | number | boolean | null | undefined>;
function out(level: "info" | "warn" | "error", event: string, fields?: Fields) {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const line = JSON.stringify({ level, event, ...fields, t: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
export const log = {
  info: (e: string, f?: Fields) => out("info", e, f),
  warn: (e: string, f?: Fields) => out("warn", e, f),
  error: (e: string, f?: Fields) => out("error", e, f),
};
