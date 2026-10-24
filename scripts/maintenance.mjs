import { createServer } from "node:http";

// Deliberately independent of application modules, database clients, and workers.
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "0.0.0.0";
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("PORT must be a valid TCP port.");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workspace update · Catalyst Works</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:28px;background:#F4F7FB;color:#0A1628;font:16px/1.6 system-ui,sans-serif}main{width:100%;max-width:560px;border:1px solid #DCE3ED;border-radius:20px;padding:clamp(28px,7vw,56px);background:white;box-shadow:0 14px 48px #0A16280b}.brand{font-weight:700;letter-spacing:-.03em;font-size:22px}.mark{display:inline-block;width:12px;height:12px;margin-right:10px;background:#2F5D8F;border-radius:3px}.eyebrow{margin:38px 0 10px;color:#52657B;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}h1{font-size:clamp(28px,6vw,38px);line-height:1.15;letter-spacing:-.04em;margin:0 0 20px}p{color:#52657B;margin:0 0 26px}a{display:inline-block;padding:11px 18px;border-radius:8px;background:#0A1628;color:white;text-decoration:none;font-weight:600}a:focus-visible{outline:3px solid #2F5D8F;outline-offset:4px}footer{margin-top:36px;color:#52657B;font-size:12px}
</style></head><body><main><div class="brand"><span class="mark" aria-hidden="true"></span>Catalyst Works</div><div class="eyebrow">Workspace update</div><h1>We’ll be right back.</h1><p>Your workspace is temporarily unavailable while we complete an update. Please try again shortly.</p><a href="/">Try again</a><footer>By Catalyst Innovations</footer></main></body></html>`;
const server = createServer((request, response) => {
  const pathname = (request.url ?? "/").split("?")[0];
  const health = ["GET", "HEAD"].includes(request.method ?? "") && pathname === "/api/healthz";
  const api = pathname === "/api" || pathname.startsWith("/api/");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Catalyst-Mode", "maintenance");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader("Content-Type", health || api ? "application/json; charset=utf-8" : "text/html; charset=utf-8");
  response.statusCode = health ? 200 : 503;
  if (!health) response.setHeader("Retry-After", "60");
  request.resume();
  response.end(health ? JSON.stringify({ status: "ok", mode: "maintenance" }) : api ? JSON.stringify({ code: "MAINTENANCE", error: "Catalyst Works is being updated. Please try again shortly." }) : html);
});
server.listen(port, host, () => console.log(JSON.stringify({ event: "maintenance.listening", host, port: server.address().port })));
for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => {
  server.close(() => process.exit(0));
  server.closeIdleConnections();
  setTimeout(() => process.exit(1), 10000).unref();
});
