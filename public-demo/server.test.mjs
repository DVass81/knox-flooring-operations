import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createPublicSampleServer, IDLE_TTL, validateDraft, validateEdit } from "./server.mjs";
import { sampleProducts } from "./sample-data.mjs";

const origin = "http://127.0.0.1:3114";
const primary = sampleProducts.find(product => product.category === "Vinyl Plank");
function draftInput() {
  return {
    customerName: "Demo Customer", projectLocation: "Knoxville", flooringType: "Luxury Vinyl Plank (LVP)",
    roomList: [{ id: "room-1", name: "Living Room", length: 20, width: 15 }],
    lineItems: [{ id: "material-1", productId: primary.id, name: primary.name, category: primary.category, sku: primary.sku, unit: primary.unit, quantity: 330, unitPrice: primary.price }],
    totalSqFt: 300, scopeOfWork: "Install sample flooring, with 10% waste and tear-out.", estimatedPrice: 2655 / 0.65,
    expectedTimeline: "1 day", materialAssumptions: "Fictional catalog selection", exclusions: "Structural repairs",
    warrantyNote: "Illustrative sample only", status: "Draft",
  };
}
async function fixture(t, options = {}) {
  let time = Date.UTC(2026, 9, 8);
  const configuredOrigin = options.origin ?? origin;
  const server = createPublicSampleServer({ origin, secure: false, now: () => time, ...options });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  async function request(path, { session, method = "GET", body, headers = {}, omitOrigin = false } = {}) {
    const response = await fetch(base + path, {
      method, headers: {
        ...(!omitOrigin ? { Origin: configuredOrigin } : {}), ...(session ? { Cookie: session.cookie, "X-CSRF-Token": session.csrf } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers,
      }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  async function session() {
    const result = await request("/api/demo/session", { method: "POST", body: {} });
    assert.equal(result.status, 200);
    return { cookie: result.headers.get("set-cookie").split(";")[0], csrf: result.body.csrfToken };
  }
  return { request, session, advance: milliseconds => { time += milliseconds; } };
}

test("two visitors never see or edit one another's drafts; reset affects only its own visitor", async t => {
  const { request, session } = await fixture(t); const a = await session(); const b = await session();
  const created = await request("/api/proposals", { session: a, method: "POST", body: draftInput() });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.roomList, draftInput().roomList);
  assert.deepEqual(created.body.lineItems, draftInput().lineItems);
  assert.equal(created.body.estimatedPrice, 2655 / 0.65);
  assert.equal(created.body.scopeOfWork, draftInput().scopeOfWork);
  assert.equal(created.body.status, "Draft"); assert.equal(created.body.shareToken, "");
  assert.equal(created.body.convertedJobId, null);
  assert.deepEqual((await request("/api/proposals", { session: b })).body, []);
  assert.equal((await request(`/api/proposals/${created.body.id}`, { session: b, method: "PATCH", body: { paymentTerms: "Changed" } })).status, 404);
  const own = await request(`/api/proposals/${created.body.id}`, { session: a, method: "PATCH", body: { paymentTerms: "Illustrative review terms", depositType: "percent", depositValue: 25 } });
  assert.equal(own.status, 200); assert.equal(own.body.depositValue, 25); assert.deepEqual(own.body.roomList, draftInput().roomList);
  const bDraft = await request("/api/proposals", { session: b, method: "POST", body: draftInput() });
  assert.equal((await request("/api/demo/reset", { session: a, method: "POST", body: {} })).status, 200);
  assert.deepEqual((await request("/api/proposals", { session: a })).body, []);
  assert.equal((await request("/api/proposals", { session: b })).body[0].id, bDraft.body.id);
});

test("HTTP-only same-site cookie renews with sliding activity, expires after two idle hours", async t => {
  const { request, session, advance } = await fixture(t); const visitor = await session();
  advance(IDLE_TTL - 1);
  const active = await request("/api/settings", { session: visitor });
  assert.equal(active.status, 200); assert.match(active.headers.get("set-cookie"), /HttpOnly; SameSite=Strict; Path=\/; Max-Age=7200/);
  assert.equal(active.headers.get("cache-control"), "no-store");
  advance(IDLE_TTL - 1); assert.equal((await request("/api/products", { session: visitor })).status, 200);
  advance(IDLE_TTL); assert.equal((await request("/api/proposals", { session: visitor })).status, 401);
  const fresh = await session(); assert.notEqual(fresh.cookie, visitor.cookie);
  assert.deepEqual((await request("/api/proposals", { session: fresh })).body, []);
});

test("production cookie is secure and the exact HTTPS origin is enforced", async t => {
  const { request } = await fixture(t, { origin: "https://flooring.example", secure: true });
  const accepted = await request("/api/demo/session", { method: "POST", body: {} });
  assert.equal(accepted.status, 200); assert.match(accepted.headers.get("set-cookie"), /; Secure/);
  assert.equal((await request("/api/demo/session", { method: "POST", body: {}, headers: { Origin: "https://flooring.example.evil.test" } })).status, 403);
});

test("origin, fetch-site and CSRF checks block unauthorized changes without throwing", async t => {
  const { request, session } = await fixture(t); const visitor = await session();
  for (const headers of [{ Origin: "https://untrusted.example" }, { "Sec-Fetch-Site": "cross-site" }]) {
    assert.equal((await request("/api/demo/session", { method: "POST", body: {}, headers })).status, 403);
    assert.equal((await request("/api/proposals", { session: visitor, headers })).status, 403);
  }
  assert.equal((await request("/api/proposals", { session: visitor, method: "POST", body: draftInput(), omitOrigin: true })).status, 403);
  for (const token of ["", "wrong", "é".repeat(43), "a".repeat(43), "a".repeat(10_000)]) {
    assert.equal((await request("/api/proposals", { session: visitor, method: "POST", body: draftInput(), headers: { "X-CSRF-Token": token } })).status, 403);
  }
  assert.deepEqual((await request("/api/proposals", { session: visitor })).body, []);
});

test("direct requests to owner, job, sending, acceptance, payment, uploads and providers are blocked", async t => {
  const { request, session } = await fixture(t); const visitor = await session();
  const draft = await request("/api/proposals", { session: visitor, method: "POST", body: draftInput() });
  const blocked = ["/api/auth/demo", "/api/auth/me", "/api/jobs", "/api/invoices", "/api/payments", "/api/uploads/request-url", "/api/ai/estimate", "/api/admin/settings", "/api/quickbooks/connect", "/api/measuresquare/sync", `/api/proposals/${draft.body.id}/convert`, `/api/proposals/${draft.body.id}/send`, "/api/q/sample-token/accept"];
  for (const pathname of blocked) for (const method of ["GET", "POST"]) assert.equal((await request(pathname, { session: visitor, method, ...(method === "POST" ? { body: {} } : {}) })).status, 404, `${method} ${pathname}`);
  for (const input of [{ status: "Sent" }, { status: "Accepted" }, { signature: "Sample" }, { shareToken: "sample" }, { convertedJobId: "fake" }]) {
    assert.equal((await request(`/api/proposals/${draft.body.id}`, { session: visitor, method: "PATCH", body: input })).status, 403);
  }
  assert.equal((await request("/api/proposals", { session: visitor })).body[0].status, "Draft");
});

test("draft validation rejects unexpected fields, invalid ranges and changes to fictional catalog pricing", async t => {
  const { request, session } = await fixture(t); const visitor = await session();
  for (const changed of [
    { ...draftInput(), email: "unwanted@example.test" }, { ...draftInput(), totalSqFt: 301 },
    { ...draftInput(), estimatedPrice: -1 }, { ...draftInput(), customerName: "" },
    { ...draftInput(), roomList: [{ id: "r", name: "Room", length: 501, width: 2 }] },
    { ...draftInput(), lineItems: [{ ...draftInput().lineItems[0], unitPrice: 0.01 }] },
    { ...draftInput(), lineItems: [{ ...draftInput().lineItems[0], quantity: -5 }] },
  ]) assert.equal((await request("/api/proposals", { session: visitor, method: "POST", body: changed })).status, 400);
  assert.equal((await request("/api/proposals", { session: visitor, method: "POST", body: { ...draftInput(), status: "Sent" } })).status, 403);
  assert.throws(() => validateDraft({ ...draftInput(), estimatedPrice: NaN }));
  assert.throws(() => validateDraft({ ...draftInput(), estimatedPrice: Infinity }));
  const draft = validateDraft(draftInput());
  assert.throws(() => validateEdit({ depositType: "percent", depositValue: 101 }, draft));
  assert.throws(() => validateEdit({ depositType: "amount", depositValue: draft.estimatedPrice + 1 }, draft));
  assert.throws(() => validateEdit({ customerName: "Other" }, draft));
  assert.equal((await request("/api/proposals", { session: visitor })).body.length, 0);
});

test("sessions and drafts are bounded and production requires HTTPS", async t => {
  assert.throws(() => createPublicSampleServer({ origin, secure: true }), /HTTPS/);
  const { request, session } = await fixture(t, { maxSessions: 1 }); const visitor = await session();
  assert.equal((await request("/api/demo/session", { method: "POST", body: {} })).status, 503);
  for (let i = 0; i < 20; i++) assert.equal((await request("/api/proposals", { session: visitor, method: "POST", body: draftInput() })).status, 201);
  assert.equal((await request("/api/proposals", { session: visitor, method: "POST", body: draftInput() })).status, 429);
  await request("/api/demo/reset", { session: visitor, method: "POST", body: {} });
  assert.equal((await request("/api/proposals", { session: visitor, method: "POST", body: draftInput() })).status, 201);
  const concurrent = await Promise.all(Array.from({ length: 25 }, () => request("/api/proposals", { session: visitor, method: "POST", body: draftInput() })));
  assert.equal(concurrent.filter(result => result.status === 201).length, 19);
  assert.equal(concurrent.filter(result => result.status === 429).length, 6);
  assert.equal((await request("/api/proposals", { session: visitor })).body.length, 20);
  const health = await request("/api/healthz"); assert.deepEqual(health.body, { status: "ok", mode: "public-sample", database: false });
});
