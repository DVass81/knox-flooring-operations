import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.searchParams.set("uselibpqcompat", "true");

export const pool = new Pool({ connectionString: databaseUrl.toString() });
export const db = drizzle(pool, { schema });

export * from "./schema";
