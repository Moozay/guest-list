import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Set NEON_DATABASE_URL for Neon or DATABASE_URL for the configured PostgreSQL database.",
  );
}

const serverlessRuntime = process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
const configuredPoolMax = process.env.PG_POOL_MAX;
const poolMax = configuredPoolMax === undefined
  ? serverlessRuntime ? 1 : 10
  : Number(configuredPoolMax);

if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 50) {
  throw new Error("PG_POOL_MAX must be an integer between 1 and 50.");
}

export const pool = new Pool({
  connectionString: databaseUrl,
  max: poolMax,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  allowExitOnIdle: serverlessRuntime,
});
pool.on("error", (error) => {
  console.error("Unexpected error from an idle PostgreSQL client.", error);
});
export const db = drizzle(pool, { schema });

export * from "./schema";
