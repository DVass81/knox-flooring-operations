import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.searchParams.set("uselibpqcompat", "true");

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl.toString(),
  },
});
