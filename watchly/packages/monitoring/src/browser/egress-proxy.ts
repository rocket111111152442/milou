/**
 * Proxy de sortie local pour le navigateur automatisé.
 * Chromium est forcé à passer par ce proxy (y compris pour les adresses locales grâce à
 * --proxy-bypass-list=<-loopback>) : CHAQUE connexion (page, sous-ressource, XHR, WebSocket)
 * est soumise à la même politique que safeFetch — résolution DNS validée, IP publique uniquement,
 * ports autorisés. Le navigateur ne peut donc pas atteindre le réseau interne du serveur.
 */
import { createServer, request as httpRequest, type IncomingMessage, type Server } from "node:http";
import { connect, type Socket } from "node:net";
import { lookup } from "node:dns/promises";
import { isPublicAddress } from "../net/ip-policy";
import { DEFAULT_ALLOWED_PORTS } from "../net/safe-url";

export interface EgressProxyOptions {
  allowLoopback?: boolean;
  allowAnyPort?: boolean;
  /** Nombre maximal d'octets échangés par connexion (protège la bande passante du serveur). */
  maxBytesPerConnection?: number;
  onBlocked?: (host: string, reason: string) => void;
}

export interface EgressProxy {
  url: string;
  port: number;
  blocked: number;
  close(): Promise<void>;
}

async function resolveSafe(host: string, opts: EgressProxyOptions): Promise<string> {
  const h = host.replace(/^\[|\]$/g, "");
  const allowLoopback = Boolean(opts.allowLoopback) && process.env.NODE_ENV !== "production";
  if (/^[\d.]+$/.test(h) || h.includes(":")) {
    if (!isPublicAddress(h, { allowLoopback })) throw new Error("blocked_address");
    return h;
  }
  const addrs = await lookup(h, { all: true, verbatim: true });
  if (!addrs.length) throw new Error("dns_error");
  for (const a of addrs) if (!isPublicAddress(a.address, { allowLoopback })) throw new Error("blocked_address");
  return addrs[0]!.address;
}

function portAllowed(port: number, opts: EgressProxyOptions) {
  return opts.allowAnyPort || DEFAULT_ALLOWED_PORTS.has(port);
}

export async function startEgressProxy(opts: EgressProxyOptions = {}): Promise<EgressProxy> {
  const maxBytes = opts.maxBytesPerConnection ?? 20 * 1024 * 1024;
  const state = { blocked: 0 };
  const block = (host: string, reason: string) => {
    state.blocked++;
    opts.onBlocked?.(host, reason);
  };

  // Toutes les connexions sont suivies pour pouvoir être coupées à l'arrêt (arrêt propre du worker).
  const sockets = new Set<Socket>();
  const track = (sock: Socket) => {
    sockets.add(sock);
    sock.once("close", () => sockets.delete(sock));
  };

  const server: Server = createServer(async (req: IncomingMessage, res) => {
    // Requête HTTP en clair (forme absolue de l'URL).
    try {
      const target = new URL(req.url ?? "");
      if (target.protocol !== "http:") throw new Error("unsupported_protocol");
      const port = Number(target.port || 80);
      if (!portAllowed(port, opts)) throw new Error("blocked_port");
      const ip = await resolveSafe(target.hostname, opts);
      const upstream = httpRequest(
        // agent: false : pas de connexion réutilisée d'une requête (ou d'un client) à l'autre.
        { host: ip, port, method: req.method, path: target.pathname + target.search, headers: { ...req.headers, host: target.host }, timeout: 30_000, agent: false },
        (up) => {
          res.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(res);
        },
      );
      upstream.on("socket", track);
      upstream.on("error", () => res.destroy());
      req.pipe(upstream);
    } catch (err) {
      block(req.url ?? "", (err as Error).message);
      res.writeHead(403, { "content-type": "text/plain" });
      res.end("Blocked by Watchly egress policy");
    }
  });

  server.on("connect", async (req: IncomingMessage, client: Socket, head: Buffer) => {
    client.on("error", () => undefined);
    const [host = "", portStr = "443"] = (req.url ?? "").split(/:(?=\d+$)/);
    const port = Number(portStr);
    try {
      if (!portAllowed(port, opts)) throw new Error("blocked_port");
      const ip = await resolveSafe(host, opts);
      const upstream: Socket = connect({ host: ip, port, timeout: 30_000 }, () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        let bytes = 0;
        const count = (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > maxBytes) {
            upstream.destroy();
            client.destroy();
          }
        };
        upstream.on("data", count);
        client.on("data", count);
        upstream.pipe(client);
        client.pipe(upstream);
      });
      track(upstream);
      track(client);
      upstream.on("error", () => client.destroy());
      upstream.on("timeout", () => upstream.destroy());
    } catch (err) {
      block(host, (err as Error).message);
      client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    }
  });

  server.on("connection", track);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as { port: number }).port;
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    get blocked() {
      return state.blocked;
    },
    close: () =>
      new Promise<void>((resolve) => {
        for (const sock of sockets) sock.destroy();
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
