// Isolated Windows test build only. Production keeps the existing argon2 package.
import { argon2 as derive, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const local = new URL(process.env.DATABASE_URL || "postgresql://invalid/invalid");
if (process.env.CATALYST_ISOLATED_TEST !== "true" || !["localhost", "127.0.0.1", "[::1]"].includes(local.hostname)) throw new Error("The test Argon2 adapter only runs against an explicitly isolated local database.");
const argon2 = promisify(derive);
const base64 = buffer => buffer.toString("base64").replace(/=+$/, "");
async function hash(password, options = {}) {
  const memory = options.memoryCost ?? 19456, passes = options.timeCost ?? 3, parallelism = options.parallelism ?? 1;
  const salt = randomBytes(16);
  const digest = await argon2("argon2id", { message: password, nonce: salt, memory, passes, parallelism, tagLength: 32 });
  return `$argon2id$v=19$m=${memory},t=${passes},p=${parallelism}$${base64(salt)}$${base64(digest)}`;
}
async function verify(encoded, password) {
  const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(encoded);
  if (!match) return false;
  const [, m, t, p, salt, expected] = match;
  if (+m !== 19456 || +t !== 3 || +p !== 1) return false;
  const digest = Buffer.from(expected, "base64");
  const actual = await argon2("argon2id", { message: password, nonce: Buffer.from(salt, "base64"), memory: +m, passes: +t, parallelism: +p, tagLength: digest.length });
  return timingSafeEqual(actual, digest);
}
export default { hash, verify, argon2id: 2 };
