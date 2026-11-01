import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { BrowserPool } from "../../packages/monitoring/src/browser/pool";

process.env.WAVERTI_ENCRYPTION_KEY = "SECRET-PROBE-VALUE";
process.env.DATABASE_URL = "postgres://probe:probe@db.internal/x";
const srv = createServer((_, res) => res.writeHead(200, { "content-type": "text/html" }).end("<html><body><div id='root'></div><script>document.getElementById('root').textContent='ok '.repeat(300)</script></body></html>"));
await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
const port = (srv.address() as { port: number }).port;
const pool = new BrowserPool({ maxConcurrency: 2, egress: { allowLoopback: true, allowAnyPort: true } });
const t0 = Date.now();
const rs = await Promise.all([1, 2].map(() => pool.render(`http://127.0.0.1:${port}/`, { timeoutMs: 20000, allowLoopback: true, allowAnyPort: true })));
console.log("renders ok:", rs.map((r) => r.status), "ms:", Date.now() - t0);
const pids = execSync("ps -eo pid=").toString().split("\n").map((x) => x.trim()).filter(Boolean);
const procs: { pid: string; cmd: string[]; env: string }[] = [];
for (const pid of pids) {
  try {
    const cmd = readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
    if (!cmd.some((a) => /chrom|headless_shell/.test(a))) continue;
    procs.push({ pid, cmd, env: readFileSync(`/proc/${pid}/environ`, "utf8") });
  } catch {}
}
const mains = procs.filter((p) => p.cmd.includes("--remote-debugging-pipe") && !p.cmd.some((a) => a.startsWith("--type=")));
console.log("chromium processes total:", procs.length, "| browser (main) processes:", mains.length);
console.log("--no-sandbox in main:", mains.map((m) => m.cmd.includes("--no-sandbox")), "| flags:", mains[0]?.cmd.filter((a) => /sandbox|headless|proxy|js-flags|renderer-process-limit/.test(a)).join(" "));
console.log("renderer types:", [...new Set(procs.map((p) => p.cmd.find((a) => a.startsWith("--type="))?.slice(7) ?? "main"))].join(","));
console.log("secret in ANY chromium process environ:", procs.some((p) => p.env.includes("SECRET-PROBE-VALUE")), "| DATABASE_URL in any:", procs.some((p) => p.env.includes("db.internal")));
await pool.close(); srv.close();
