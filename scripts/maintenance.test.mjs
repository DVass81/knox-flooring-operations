import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("maintenance command boots without a database and blocks every application route", { timeout: 15000 }, async () => {
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(path|systemroot|windir|comspec|temp|tmp|home|userprofile)$/i.test(key)));
  const child = spawn(process.execPath, [fileURLToPath(new URL("./maintenance.mjs", import.meta.url))], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...environment, PORT: "0", HOST: "127.0.0.1", NODE_ENV: "production", BACKGROUND_WORKERS_ENABLED: "true", DEMO_ACCESS_ENABLED: "true" } });
  try {
    const port = await new Promise((resolve, reject) => {
      let output = "";
      const timeout = setTimeout(() => reject(new Error("Maintenance startup timed out")), 5000);
      child.once("error", error => { clearTimeout(timeout); reject(error); });
      child.once("exit", code => { clearTimeout(timeout); reject(new Error(`Maintenance exited before readiness (${code})`)); });
      child.stdout.on("data", chunk => { output += chunk; if (output.includes("\n")) { clearTimeout(timeout); try { resolve(JSON.parse(output.split("\n")[0]).port); } catch (error) { reject(error); } } });
    });
    const base = `http://127.0.0.1:${port}`;
    const health = await fetch(`${base}/api/healthz`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("x-catalyst-mode"), "maintenance");
    assert.deepEqual(await health.json(), { status: "ok", mode: "maintenance" });
    for (const [route, method] of [["/", "GET"], ["/inventory", "GET"], ["/api/jobs", "GET"], ["/api/customers", "POST"], ["/api/jobs/a", "PATCH"], ["/api/jobs/a", "DELETE"], ["/api/quickbooks/webhook", "POST"], ["/api/auth/login", "POST"], ["/api/healthz", "POST"], ["/api", "OPTIONS"]]) {
      const response = await fetch(base + route, { method });
      assert.equal(response.status, 503, `${method} ${route}`);
      assert.equal(response.headers.get("retry-after"), "60");
      assert.equal(response.headers.get("cache-control"), "no-store");
      if (route.startsWith("/api")) assert.equal((await response.json()).code, "MAINTENANCE");
      else assert.match(await response.text(), /Catalyst Works/);
    }
    const head = await fetch(`${base}/api/healthz`, { method: "HEAD" });
    assert.equal(head.status, 200); assert.equal(await head.text(), "");
  } finally {
    if (child.exitCode === null) { child.kill(); await new Promise(resolve => child.once("exit", resolve)); }
  }
});
