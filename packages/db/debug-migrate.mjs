import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations réussies !");
} catch (error) {
    console.error("Erreur de migration :", error);
    console.error("Cause :", error.cause);
    process.exitCode = 1;
} finally {
    await pool.end();
}