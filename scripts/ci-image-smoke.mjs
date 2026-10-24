import assert from "node:assert/strict";

const base = new URL(process.env.CI_IMAGE_BASE_URL ?? "");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Image checks refuse non-loopback servers.");
const recovery = process.env.CI_IMAGE_MODE === "recovery";
assert.ok(recovery || process.env.CI_IMAGE_MODE === "release", "Choose a release or recovery image.");
assert.equal(process.env.OWNER_EMAIL, "owner@image.test", "Image checks use only the synthetic CI owner.");
const email = process.env.OWNER_EMAIL;
const password = process.env.OWNER_INITIAL_PASSWORD;
assert.ok(password, "The disposable owner password is required.");
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
  try { ready = (await fetch(new URL("/api/healthz", base), { signal: AbortSignal.timeout(2000) })).ok; } catch {}
  if (ready) break;
  await delay(1000);
}
assert.ok(ready, "Container did not become database-ready.");
const document = await fetch(base);
assert.equal(document.status, 200);
const html = await document.text();
assert.match(html, /<html/i);
if (recovery) assert.match(html, /Recovery view/);

const login = suppliedPassword => fetch(new URL("/api/auth/login", base), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: suppliedPassword }) });
assert.equal((await login("Intentionally-wrong-password")).status, 401, "Native Argon2 must reject a wrong password.");
const authenticated = await login(password);
const session = await authenticated.json();
assert.equal(authenticated.status, 200, JSON.stringify(session));
assert.equal(session.user.actualRole, "owner");
const cookie = authenticated.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie && session.csrfToken, "Real login must issue a session and CSRF token.");
async function request(route, { method = "GET", body, csrf = session.csrfToken, status = 200 } = {}) {
  const response = await fetch(new URL(`/api${route}`, base), { method, headers: { Cookie: cookie, "Content-Type": "application/json", "x-csrf-token": csrf }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = response.status === 204 ? null : await response.json();
  assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(result)}`);
  if (recovery) assert.equal(response.headers.get("x-catalyst-mode"), "read-only-recovery");
  return result;
}
await request("/auth/session");
assert.deepEqual(await request("/jobs"), [], "Image startup must not create demo jobs.");
if (recovery) {
  const customers = await request("/customers");
  assert.equal(customers.length, 1);
  assert.equal(customers[0].name, "Synthetic image check");
  await request("/customers", { method: "POST", body: { name: "Must remain blocked" }, status: 503 });
  await request("/quickbooks/connect", { status: 503 });
  await request("/auth/demo", { method: "POST", body: {}, status: 503 });
  assert.deepEqual(await request("/customers"), customers);
} else {
  assert.deepEqual(await request("/customers"), [], "Image startup must not create demo customers.");
  await request("/customers", { method: "POST", body: { name: "Blocked CSRF fixture" }, csrf: "incorrect", status: 403 });
  const customer = await request("/customers", { method: "POST", body: { name: "Synthetic image check" }, status: 201 });
  assert.ok(customer.id);
  assert.equal((await request("/customers")).length, 1);
}
await request("/auth/logout", { method: "POST", status: 204 });
await request("/auth/session", { status: 401 });
console.log(`${recovery ? "Recovery" : "Release"} container: native password verification, session/CSRF, database readiness, and ${recovery ? "preserved records/write protection" : "unseeded startup/persistent customer write"} passed.`);
