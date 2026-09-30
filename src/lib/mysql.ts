import mysql, { type Pool } from "mysql2/promise";
import type { EventEmitter } from "events";

export type MysqlConfig = {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl: boolean;
};

const COLLECTIONS = [
    "users",
    "loginevents",
    "paymentaccounts",
    "transactions",
    "games",
    "gameresults",
    "aviatorrounds",
    "chickengames",
    "chickendashes",
    "plinkobets",
    "cardrounds",
    "cardbets",
    "settings",
    "notifications",
    "supportthreads",
    "supportmessages",
    "helparticles",
    "commissions",
    "adminlogs",
    "feedbacks",
    "gatewaysessions",
    "minesgames",
    "winholds",
];

// Ridexd-nextjs approach: Use single DATABASE_URL or fallback to individual vars
let databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
if (!databaseUrl) {
    const host = process.env.MYSQL_HOST || process.env.DB_HOST || process.env.DATABASE_HOST;
    const user = process.env.MYSQL_USER || process.env.DB_USER || process.env.DATABASE_USER;
    const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD;
    const database = process.env.MYSQL_DATABASE || process.env.DB_NAME || process.env.DATABASE_NAME;
    const port = process.env.MYSQL_PORT || process.env.DB_PORT || process.env.DATABASE_PORT || "3306";
    if (host && user && password && database) {
        databaseUrl = `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
    }
}

const globalForDb = globalThis as typeof globalThis & {
  __winkoxMysqlPool?: Pool;
  __winkoxInitPromise?: Promise<boolean>;
};

// Exact Ridexd-nextjs pool creation
export const pool =
  globalForDb.__winkoxMysqlPool ??
  (databaseUrl ? mysql.createPool({
    uri: databaseUrl,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: "utf8mb4_unicode_ci",
    timezone: "Z",
    connectTimeout: 10000,
  }) : null);

if (process.env.NODE_ENV !== "production" && pool) {
  globalForDb.__winkoxMysqlPool = pool;
}

if (pool && !(pool as unknown as EventEmitter).listenerCount("error")) {
    (pool as unknown as EventEmitter).on("error", (err: Error) => {
        console.error("[mysql] pool error:", err.message);
    });
}

function tableName(name: string) {
    return `\`${name.replace(/`/g, "")}\``;
}

export function getMysqlConfig(): MysqlConfig | null {
    if (!databaseUrl) return null;
    return { host: "uri", port: 3306, user: "uri", password: "uri", database: "uri", ssl: false };
}

export function isMysqlEnabled(): boolean {
    return Boolean(pool);
}

const MYSQL_RETRY_DELAY = Number(process.env.MYSQL_RETRY_DELAY || 10000);
let initFailure: { error: unknown; retryAt: number } | null = null;

export async function getMysqlPool(): Promise<Pool | null> {
    if (pool) {
        await ensureMysqlReady();
    }
    return pool;
}

export async function ensureMysqlReady(): Promise<boolean> {
    if (!pool) {
        throw new Error("DATABASE_URL is required (mysql://user:password@host:3306/database)");
    }

    if (globalForDb.__winkoxInitPromise) return globalForDb.__winkoxInitPromise;
    if (initFailure && Date.now() < initFailure.retryAt) throw initFailure.error;

    const promise = (async () => {
        try {
            for (const table of COLLECTIONS) {
                await pool.execute(`
        CREATE TABLE IF NOT EXISTS ${tableName(table)} (
          id VARCHAR(64) PRIMARY KEY,
          data JSON NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `);
            }
        } catch (error) {
            initFailure = { error, retryAt: Date.now() + MYSQL_RETRY_DELAY };
            throw error;
        }
        initFailure = null;
        return true;
    })();

    globalForDb.__winkoxInitPromise = promise;
    try {
        return await promise;
    } catch (e) {
        globalForDb.__winkoxInitPromise = undefined;
        throw e;
    }
}

export async function ensureMysqlTable(collection: string): Promise<void> {
    const active = await ensureMysqlReady();
    if (!active || !pool) return;
    await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${tableName(collection)} (
      id VARCHAR(64) PRIMARY KEY,
      data JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
