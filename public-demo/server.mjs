import http from "node:http";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sampleProducts, sampleSettings } from "./sample-data.mjs";

const COOKIE = "catalyst_flooring_sample";
export const IDLE_TTL = 2 * 60 * 60 * 1000;
const MAX_SESSIONS = 200;
const MAX_DRAFTS = 20;
const MAX_BODY = 64 * 1024;
const flooringTypes = new Set(["Carpet", "Hardwood", "Tile", "Laminate", "Luxury Vinyl Plank (LVP)", "Luxury Vinyl Tile (LVT)", "Waterproof Flooring", "Commercial Carpet Tile", "Commercial LVT"]);
const createFields = new Set(["customerName", "projectLocation", "flooringType", "roomList", "lineItems", "totalSqFt", "scopeOfWork", "estimatedPrice", "expectedTimeline", "materialAssumptions", "exclusions", "warrantyNote", "status"]);
const editFields = new Set(["lineItems", "depositType", "depositValue", "paymentTerms"]);

class SampleError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function text(value, maximum = 4000, required = false) {
  if (typeof value !== "string" || value.length > maximum || (required && !value.trim())) throw new SampleError(400, "Check the sample text fields and use fictional information.");
  return value.trim();
}
function amount(value, maximum = 1_000_000) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) throw new SampleError(400, "Enter a finite, nonnegative sample value within the allowed range.");
  return value;
}
function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SampleError(400, "A sample draft object is required.");
  return value;
}
function closedFields(value, fields) {
  object(value);
  if (Object.keys(value).some(key => !fields.has(key))) throw new SampleError(400, "That field is unavailable in this sample.");
}
function lineItems(value) {
  if (!Array.isArray(value) || value.length > 20) throw new SampleError(400, "Use no more than 20 sample material items.");
  const ids = new Set();
  return value.map(item => {
    closedFields(item, new Set(["id", "productId", "name", "category", "sku", "unit", "quantity", "unitPrice"]));
    const product = sampleProducts.find(product => product.id === item.productId);
    if (!product || item.unit !== product.unit || item.unitPrice !== product.price || item.name !== product.name) throw new SampleError(400, "Choose a product from the fictional catalog.");
    const id = text(item.id, 80, true);
    if (ids.has(id)) throw new SampleError(400, "Material item identifiers must be unique.");
    ids.add(id);
    return { id, productId: product.id, name: product.name, category: product.category, sku: product.sku, unit: product.unit, quantity: amount(item.quantity, 100_000), unitPrice: product.price };
  });
}
export function validateDraft(input) {
  closedFields(input, createFields);
  if (input.status !== "Draft") throw new SampleError(403, "Only sample drafts can be created.");
  if (!flooringTypes.has(input.flooringType)) throw new SampleError(400, "Choose a supported flooring type.");
  if (!Array.isArray(input.roomList) || input.roomList.length < 1 || input.roomList.length > 20) throw new SampleError(400, "Include between one and 20 sample rooms.");
  const roomIds = new Set();
  const rooms = input.roomList.map(room => {
    closedFields(room, new Set(["id", "name", "length", "width"]));
    const id = text(room.id, 80, true);
    if (roomIds.has(id)) throw new SampleError(400, "Room identifiers must be unique.");
    roomIds.add(id);
    return { id, name: text(room.name, 100, true), length: amount(room.length, 500), width: amount(room.width, 500) };
  });
  const area = rooms.reduce((sum, room) => sum + room.length * room.width, 0);
  const totalSqFt = amount(input.totalSqFt, 5_000_000);
  if (area <= 0 || Math.abs(area - totalSqFt) > 0.01) throw new SampleError(400, "Review the room measurements and total area.");
  return {
    customerName: text(input.customerName, 160, true), projectLocation: text(input.projectLocation, 160, true),
    flooringType: input.flooringType, roomList: rooms, lineItems: lineItems(input.lineItems), totalSqFt,
    scopeOfWork: text(input.scopeOfWork), estimatedPrice: amount(input.estimatedPrice, 100_000_000),
    expectedTimeline: text(input.expectedTimeline, 100), materialAssumptions: text(input.materialAssumptions),
    exclusions: text(input.exclusions), warrantyNote: text(input.warrantyNote), status: "Draft",
    depositType: "none", depositValue: 0, paymentTerms: "Illustrative draft only. No payment is requested.",
    shareToken: "", signature: "", convertedJobId: null, convertedInvoiceId: null,
  };
}
export function validateEdit(input, draft) {
  if (input?.status || input?.shareToken || input?.convertedJobId || input?.signature) throw new SampleError(403, "Sending, sharing, acceptance and conversion are unavailable in this public sample.");
  closedFields(input, editFields);
  if (!Object.keys(input).length) throw new SampleError(400, "No editable draft fields were supplied.");
  const next = { ...draft };
  if ("lineItems" in input) next.lineItems = lineItems(input.lineItems);
  if ("depositType" in input) {
    if (!["none", "percent", "amount"].includes(input.depositType)) throw new SampleError(400, "Choose a sample deposit type.");
    next.depositType = input.depositType;
  }
  if ("depositValue" in input) next.depositValue = amount(input.depositValue);
  if (next.depositType === "percent" && next.depositValue > 100) throw new SampleError(400, "A sample deposit percentage cannot exceed 100.");
  if (next.depositType === "amount" && next.depositValue > next.estimatedPrice) throw new SampleError(400, "A sample deposit cannot exceed the draft price.");
  if ("paymentTerms" in input) next.paymentTerms = text(input.paymentTerms, 500);
  return next;
}

/** An independent entry: no imports of app, database, auth, seeds or providers. */
export function createPublicSampleServer({ origin, secure = true, staticDir, now = Date.now, maxSessions = MAX_SESSIONS } = {}) {
  if (!origin || new URL(origin).origin !== origin) throw new Error("Set the exact public sample origin.");
  if (secure && !origin.startsWith("https://")) throw new Error("Production sample cookies require an HTTPS origin.");
  const sessions = new Map();
  const sweep = () => { for (const [key, session] of sessions) if (now() - session.lastUsed >= IDLE_TTL) sessions.delete(key); };
  const cleanup = setInterval(sweep, 60_000); cleanup.unref();
  const json = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(body)); };
  const cookieToken = req => {
    const cookie = String(req.headers.cookie ?? "").split(";").find(part => part.trim().startsWith(`${COOKIE}=`));
    const token = cookie?.trim().slice(COOKIE.length + 1);
    return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
  };
  const setCookie = (res, token) => res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${IDLE_TTL / 1000}${secure ? "; Secure" : ""}`);
  const getSession = (req, res) => {
    const token = cookieToken(req);
    const session = token ? sessions.get(token) : null;
    if (!session || now() - session.lastUsed >= IDLE_TTL) { if (token) sessions.delete(token); return null; }
    session.lastUsed = now();
    setCookie(res, token); // Renew the browser cookie with the server's idle timeout.
    return session;
  };
  const readBody = async req => {
    if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) throw new SampleError(415, "Use JSON for sample draft changes.");
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) throw new SampleError(413, "The sample draft is too large."); chunks.push(chunk); }
    try { return JSON.parse(Buffer.concat(chunks).toString() || "{}"); } catch { throw new SampleError(400, "The sample draft is not valid JSON."); }
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer"); res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const pathname = new URL(req.url, origin).pathname;
      if (pathname === "/api/healthz" && req.method === "GET") { json(res, 200, { status: "ok", mode: "public-sample", database: false }); return; }
      if (pathname.startsWith("/api/")) {
        const safe = req.method === "GET" || req.method === "HEAD";
        if (req.headers["sec-fetch-site"] === "cross-site" || (req.headers.origin && req.headers.origin !== origin) || (!safe && req.headers.origin !== origin)) throw new SampleError(403, "Use the public sample from its own website.");
        if (pathname === "/api/demo/session" && req.method === "POST") {
          await readBody(req); sweep(); let session = getSession(req, res);
          if (!session) {
            if (sessions.size >= maxSessions) throw new SampleError(503, "The sample is busy. Please try again shortly.");
            const token = randomBytes(32).toString("base64url");
            session = { csrf: randomBytes(32).toString("base64url"), lastUsed: now(), proposals: new Map() };
            sessions.set(token, session);
            setCookie(res, token);
          }
          json(res, 200, { csrfToken: session.csrf, mode: "public-sample", idleSeconds: IDLE_TTL / 1000 }); return;
        }
        const session = getSession(req, res);
        if (!session) throw new SampleError(401, "Your sample session expired. Start a fresh sample to continue.");
        if (!safe) {
          const csrf = String(req.headers["x-csrf-token"] ?? "");
          if (!/^[A-Za-z0-9_-]{43}$/.test(csrf) || !timingSafeEqual(Buffer.from(csrf), Buffer.from(session.csrf))) throw new SampleError(403, "Refresh the sample before changing a draft.");
        }
        if (pathname === "/api/demo/reset" && req.method === "POST") { await readBody(req); session.proposals.clear(); json(res, 200, { reset: true }); return; }
        if (req.method === "GET" && pathname === "/api/settings") { json(res, 200, sampleSettings); return; }
        if (req.method === "GET" && pathname === "/api/products") { json(res, 200, sampleProducts); return; }
        if (req.method === "GET" && pathname === "/api/proposals") { json(res, 200, [...session.proposals.values()]); return; }
        if (req.method === "POST" && pathname === "/api/proposals") {
          const input = await readBody(req);
          if (session.proposals.size >= MAX_DRAFTS) throw new SampleError(429, "Reset your sample before creating more than 20 drafts.");
          const draft = { ...validateDraft(input), id: randomUUID(), createdAt: new Date(now()).toISOString() };
          session.proposals.set(draft.id, draft); json(res, 201, draft); return;
        }
        const proposalMatch = /^\/api\/proposals\/([a-f0-9-]{36})$/.exec(pathname);
        if (req.method === "PATCH" && proposalMatch) {
          const input = await readBody(req);
          const draft = session.proposals.get(proposalMatch[1]);
          if (!draft) throw new SampleError(404, "This sample draft was not found in your session.");
          const edited = validateEdit(input, draft);
          session.proposals.set(draft.id, edited); json(res, 200, edited); return;
        }
        throw new SampleError(404, "This action is unavailable in the public estimating sample.");
      }
      if (req.method !== "GET" && req.method !== "HEAD") throw new SampleError(404, "Not found.");
      if (!staticDir) throw new SampleError(404, "Not found.");
      const isPage = ["/", "/estimator", "/proposals"].includes(pathname);
      const relative = isPage ? "public-demo.html" : decodeURIComponent(pathname).slice(1);
      const filename = path.resolve(staticDir, relative);
      if (!filename.startsWith(`${path.resolve(staticDir)}${path.sep}`) || (!isPage && !pathname.startsWith("/assets/") && !["/catalyst-official.png", "/robots.txt"].includes(pathname))) throw new SampleError(404, "Not found.");
      const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };
      const contents = await readFile(filename);
      res.writeHead(200, { "Content-Type": mime[path.extname(filename)] ?? "application/octet-stream" }); res.end(req.method === "HEAD" ? undefined : contents);
    } catch (error) {
      const status = error instanceof SampleError ? error.status : error?.code === "ENOENT" ? 404 : 500;
      json(res, status, { error: error instanceof SampleError ? error.message : status === 404 ? "Not found." : "The sample could not complete that request." });
    }
  });
  server.on("close", () => { clearInterval(cleanup); sessions.clear(); });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const forbidden of ["DATABASE_URL", "OPENAI_API_KEY", "RESEND_API_KEY", "REPL_IDENTITY", "QUICKBOOKS_CLIENT_SECRET"]) if (process.env[forbidden]) throw new Error(`Remove ${forbidden} from the isolated public sample service.`);
  const port = Number(process.env.PORT ?? 3114);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error("Invalid sample port.");
  const secure = process.env.NODE_ENV === "production";
  const origin = process.env.PUBLIC_SAMPLE_ORIGIN ?? (secure ? "" : `http://127.0.0.1:${port}`);
  const staticDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../artifacts/knox-flooring/dist/public-sample");
  createPublicSampleServer({ origin, secure, staticDir }).listen(port, "0.0.0.0", () => console.log(`Flooring public sample listening on port ${port}.`));
}
