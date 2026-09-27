import type { Pool } from "mysql2/promise";
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

let pool: Pool | null = null;
let initPromise: Promise<boolean> | null = null;
let mysqlModule: Promise<typeof import("mysql2/promise")> | null = null;

function loadMysql() {
    // client.ts (a "use client" module) transitively imports this file via mongo.ts/support.ts.
    // Hide this server-only dependency behind an indirect import so client bundlers can't
    // statically resolve 'mysql2' (which needs Node's net/tls) into the browser bundle.
    if (!mysqlModule) {
        mysqlModule = (Function("return import('mysql2/promise')")() as Promise<typeof import("mysql2/promise")>).catch((error) => {
            mysqlModule = null;
            const msg = error instanceof Error ? error.message : String(error);
            if (/mysql2/.test(msg) && /module|package|find/i.test(msg)) {
                throw new Error("Database driver missing on server. Install production dependency 'mysql2' and redeploy.");
            }
            throw error;
        });
    }
    return mysqlModule;
}

function parseMysqlUrl(url: string): MysqlConfig | null {
    try {
        const u = new URL(url);
        if (u.protocol !== "mysql:" && u.protocol !== "mariadb:") return null;
        if (!u.hostname || !u.username || !u.pathname || u.pathname === "/") return null;
        return {
            host: u.hostname,
            port: Number(u.port || 3306),
            user: decodeURIComponent(u.username),
            password: decodeURIComponent(u.password),
            database: decodeURIComponent(u.pathname.replace(/^\//, "")),
            ssl: u.searchParams.get("ssl") !== "false",
        };
    } catch {
        return null;
    }
}

export function getMysqlConfig(): MysqlConfig | null {
    const fromUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
    if (fromUrl) {
        const cfg = parseMysqlUrl(fromUrl);
        if (cfg) return cfg;
    }

    const host = process.env.MYSQL_HOST || process.env.DB_HOST || process.env.DATABASE_HOST;
    const user = process.env.MYSQL_USER || process.env.DB_USER || process.env.DATABASE_USER;
    const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD;
    const database = process.env.MYSQL_DATABASE || process.env.DB_NAME || process.env.DATABASE_NAME;
    const port = Number(process.env.MYSQL_PORT || process.env.DB_PORT || process.env.DATABASE_PORT || 3306);
    if (!host || !user || !password || !database) return null;
    return { host, port, user, password, database, ssl: (process.env.MYSQL_SSL || process.env.DB_SSL || "true").toLowerCase() !== "false" };
}

export function isMysqlEnabled(): boolean {
    return Boolean(getMysqlConfig());
}

function tableName(name: string) {
    return `\`${name.replace(/`/g, "")}\``;
}

export async function getMysqlPool(): Promise<Pool | null> {
    if (!pool) {
        await ensureMysqlReady();
    }
    return pool;
}

export async function ensureMysqlReady(): Promise<boolean> {
    const cfg = getMysqlConfig();
    if (!cfg) {
        pool = null;
        initPromise = null;
        throw new Error("MySQL is required. Configure MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, and MYSQL_PASSWORD.");
    }

    if (pool) return true;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        const mysql = await loadMysql();
        // Hostinger provisions the database in hPanel. Its application users usually
        // do not have permission to create databases, only tables inside their database.
        pool = mysql.createPool({
            host: cfg.host,
            port: cfg.port,
            user: cfg.user,
            password: cfg.password,
            database: cfg.database,
            waitForConnections: true,
            connectionLimit: 10,
            connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT || 5000),
            charset: "utf8mb4",
            ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
        });
        const currentPool = pool;
        // Idle connections dropped by the server/firewall (e.g. ECONNRESET) surface as pool
        // 'error' events; mysql2's Pool type omits this event, so listen via EventEmitter.
        (pool as unknown as EventEmitter).on("error", (err: Error) => {
            console.error("[mysql] pool error:", err.message);
        });

        try {
            for (const table of COLLECTIONS) {
                await currentPool.execute(`
        CREATE TABLE IF NOT EXISTS ${tableName(table)} (
          id VARCHAR(64) PRIMARY KEY,
          data JSON NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `);
            }
        } catch (error) {
            pool = null;
            initPromise = null;
            void currentPool.end().catch(() => undefined);
            throw error;
        }

        return true;
    })();

    return initPromise;
}

export async function ensureMysqlTable(collection: string): Promise<void> {
    const active = await ensureMysqlReady();
    if (!active) return;
    const current = await getMysqlPool();
    if (!current) return;
    await current.execute(`
    CREATE TABLE IF NOT EXISTS ${tableName(collection)} (
      id VARCHAR(64) PRIMARY KEY,
      data JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
