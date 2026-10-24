import { access, cp, copyFile, mkdir, readFile, readdir, symlink, unlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const execute = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const priorUi = "f95182adab46ee9dc2a651a8193c9891ab4d0de2";
const gitArgs = ["-c", `safe.directory=${root.replaceAll("\\", "/").replace(/\/$/, "")}`];
const clean = { ...process.env, CATALYST_ISOLATED_TEST_BUILD: "false", NODE_ENV: "production", PORT: "8080", BASE_PATH: "/" };
const stamp = new Date().toISOString().replace(/[^0-9]/g, "");
const output = path.join(root, ".cache", "catalyst-recovery", stamp);
const stage = path.join(output, "source");
await mkdir(output, { recursive: true }); await mkdir(stage);
const resolveGit = async (...args) => (await execute("git", [...gitArgs, ...args], { cwd: root, windowsHide: true })).stdout.trim();
if (await resolveGit("rev-parse", priorUi) !== priorUi) throw new Error("The pinned previous UI commit is unavailable.");
await execute(process.execPath, ["artifacts/api-server/build.mjs"], { cwd: root, env: clean, windowsHide: true });
const excluded = new Set(["node_modules", "dist", "dist-test", "test-results", "playwright-report", ".cache", "out-tsc"]);
const filter = filename => !excluded.has(path.basename(filename)) && !path.basename(filename).endsWith(".tsbuildinfo");
for (const folder of ["lib", "scripts", "artifacts/api-server", "artifacts/knox-ad", "artifacts/mockup-sandbox"]) await cp(path.join(root, folder), path.join(stage, folder), { recursive: true, filter });
for (const file of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc", "tsconfig.json", "tsconfig.base.json"]) await copyFile(path.join(root, file), path.join(stage, file));
const uiTar = path.join(output, "prior-ui.tar");
await execute("git", [...gitArgs, "archive", "--format=tar", `--output=${uiTar}`, priorUi, "artifacts/knox-flooring"], { cwd: root, windowsHide: true });
await execute("tar", ["-xf", uiTar, "-C", stage], { windowsHide: true });
// Keep the reviewed dependency lock; only the UI sources/assets come from the prior commit.
await copyFile(path.join(root, "artifacts/knox-flooring/package.json"), path.join(stage, "artifacts/knox-flooring/package.json"));
const uiDirectory = path.join(stage, "artifacts/knox-flooring");
const moduleLinks = [];
async function linkDependencies(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  if (entries.some(entry => entry.name === "package.json")) {
    const original = path.join(root, path.relative(stage, folder), "node_modules");
    if (await access(original).then(() => true, () => false)) {
      const link = path.join(folder, "node_modules");
      await symlink(original, link, process.platform === "win32" ? "junction" : "dir"); moduleLinks.push(link);
    }
  }
  for (const entry of entries) if (entry.isDirectory() && !excluded.has(entry.name)) await linkDependencies(path.join(folder, entry.name));
}
await linkDependencies(stage);
try { await execute(process.execPath, [path.join(root, "artifacts/knox-flooring/node_modules/vite/bin/vite.js"), "build", "--config", path.join(uiDirectory, "vite.config.ts")], { cwd: uiDirectory, env: clean, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }); }
finally { for (const link of moduleLinks.reverse()) await unlink(link); }
const htmlPath = path.join(uiDirectory, "dist/public/index.html");
const html = await readFile(htmlPath, "utf8");
await writeFile(htmlPath, html.replace("</body>", '<aside role="status" style="position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#292017;color:#fff3cf;text-align:center;padding:8px 16px;font:13px system-ui">Recovery view · Changes and integrations are temporarily paused.</aside></body>'));
await cp(path.join(root, "artifacts/api-server/dist"), path.join(stage, "artifacts/api-server/dist"), { recursive: true });
await copyFile(path.join(root, "scripts/recovery.Dockerfile"), path.join(stage, "Dockerfile"));
await writeFile(path.join(stage, ".dockerignore"), "node_modules\n.git\n.cache\n*.private.*\n.env\n");
const files = [];
async function inventory(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) await inventory(full);
    else files.push({ path: path.relative(stage, full).replaceAll("\\", "/"), sha256: createHash("sha256").update(await readFile(full)).digest("hex") });
  }
}
await inventory(stage); files.sort((a, b) => a.path.localeCompare(b.path));
const migrationIds = (await readdir(path.join(stage, "lib/db/migrations"))).filter(file => /^\d{4}_[a-z0-9_]+\.sql$/.test(file)).sort().map(file => file.slice(0, -4));
const manifest = { createdAt: new Date().toISOString(), mode: "read-only-recovery", pinnedUiCommit: priorUi, backendGitHead: await resolveGit("rev-parse", "HEAD"), backendHasWorkingChanges: Boolean(await resolveGit("status", "--porcelain")), sourceTreeSha256: createHash("sha256").update(JSON.stringify(files)).digest("hex"), schemaVersion: migrationIds.at(-1), migrationIds, entrypoint: "artifacts/api-server/dist/recovery.mjs", nativeAuthentication: "Production argon2 dependency; Linux image authentication still requires staging verification", files };
await writeFile(path.join(stage, "recovery-manifest.json"), JSON.stringify(manifest, null, 2));
const archive = path.join(output, "catalyst-read-only-recovery.tar.gz");
await execute("tar", ["-czf", archive, "-C", stage, "."], { windowsHide: true });
const digest = createHash("sha256").update(await readFile(archive)).digest("hex");
await writeFile(archive + ".sha256", `${digest}  catalyst-read-only-recovery.tar.gz\n`);
console.log(JSON.stringify({ archive, sha256: digest, manifest: path.join(stage, "recovery-manifest.json"), pinnedUiCommit: priorUi, schemaVersion: manifest.schemaVersion }, null, 2));
