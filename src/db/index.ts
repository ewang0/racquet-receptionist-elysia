import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const db = drizzle(process.env.DATABASE_URL);

export { db };
