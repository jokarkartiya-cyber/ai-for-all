import { config } from "./index";
import { logger } from "../utils/logger";

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number };

let db: DatabaseDriver;

interface DatabaseDriver {
  query(text: string, params?: unknown[]): Promise<QueryResult>;
  close(): Promise<void>;
}

async function createPostgresDriver(): Promise<DatabaseDriver> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    database: config.postgres.database,
    user: config.postgres.user,
    password: config.postgres.password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on("error", (err) => {
    logger.error("PostgreSQL pool error", { error: err.message });
  });

  return {
    async query(text: string, params?: unknown[]) {
      const start = Date.now();
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug("PG query", { text: text.slice(0, 80), duration, rows: result.rowCount });
      return { rows: result.rows as Record<string, unknown>[], rowCount: result.rowCount ?? 0 };
    },
    async close() {
      await pool.end();
    },
  };
}

function createSqliteDriver(): DatabaseDriver {
  const Database = require("better-sqlite3");
  const path = require("path");
  const dbPath = path.resolve(process.cwd(), "dev.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  logger.info(`SQLite database opened at ${dbPath}`);

  return {
    query(text: string, params?: unknown[]) {
      const upper = text.trim().toUpperCase();
      const hasReturning = upper.includes("RETURNING");
      const isSelect = upper.startsWith("SELECT") || upper.startsWith("WITH") || upper.startsWith("RETURNING");
      const start = Date.now();

      const transformedSql = text
        .replace(/\$(\d+)/g, "?")
        .replace(/NOW\(\)/gi, "(datetime('now'))")
        .replace(/TRUE/gi, "1")
        .replace(/FALSE/gi, "0")
        .replace(/::jsonb/g, "")
        .replace(/::json/g, "")
        .replace(/::text\[\]/g, "")
        .replace(/COALESCE\(/gi, "IFNULL(")
        .replace(/jsonb_array_length/gi, "json_array_length")
        .replace(/LEFT\(([^,]+),\s*(\d+)\)/gi, "SUBSTR($1, 1, $2)")
        .replace(/gen_random_uuid\(\)/gi, "(lower(hex(randomblob(16))))")
        .replace(/uuid_generate_v4\(\)/gi, "(lower(hex(randomblob(16))))");

      try {
        const stmt = sqlite.prepare(transformedSql);

        if (isSelect || hasReturning) {
          const rows = params ? stmt.all(...params) : stmt.all();
          const duration = Date.now() - start;
          logger.debug("SQLite query", { text: transformedSql.slice(0, 80), duration, rows: rows.length });
          return { rows: rows as Record<string, unknown>[], rowCount: rows.length };
        }

        const info = params ? stmt.run(...params) : stmt.run();
        const duration = Date.now() - start;
        logger.debug("SQLite exec", { text: transformedSql.slice(0, 80), duration, changes: info.changes });
        return { rows: [], rowCount: info.changes };
      } catch (err) {
        logger.error("SQLite error", { text: transformedSql, params, error: (err as Error).message });
        throw err;
      }
    },
    async close() {
      sqlite.close();
      logger.info("SQLite database closed");
    },
  };
}

export async function initDatabase(): Promise<boolean> {
  if (config.nodeEnv === "production") {
    try {
      db = await createPostgresDriver();
      await db.query("SELECT 1");
      logger.info("PostgreSQL connection established");
      return true;
    } catch (err) {
      logger.error("PostgreSQL connection failed", { error: (err as Error).message });
      return false;
    }
  }

  try {
    db = await createPostgresDriver();
    await db.query("SELECT 1");
    logger.info("PostgreSQL connection established");
    return true;
  } catch {
    logger.info("PostgreSQL not available, falling back to SQLite");
    db = createSqliteDriver();
    return true;
  }
}

export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  if (!db) {
    db = createSqliteDriver();
  }
  return db.query(text, params);
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
  }
}
