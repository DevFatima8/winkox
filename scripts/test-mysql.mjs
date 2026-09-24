import "dotenv/config";
import mysql from "mysql2/promise";

const cfg = {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: (process.env.MYSQL_SSL || "true").toLowerCase() !== "false" ? { rejectUnauthorized: false } : undefined,
};

const COLLECTIONS = [
    "users", "loginevents", "paymentaccounts", "transactions", "games", "gameresults",
    "aviatorrounds", "chickengames", "chickendashes", "plinkobets", "cardrounds", "cardbets",
    "settings", "notifications", "supportthreads", "supportmessages", "helparticles",
    "commissions", "adminlogs", "feedbacks", "gatewaysessions", "minesgames",
];

const pool = mysql.createPool({ ...cfg, waitForConnections: true, connectionLimit: 5, charset: "utf8mb4" });

try {
    const conn = await pool.getConnection();
    console.log("Connected to MySQL:", cfg.host, cfg.database);
    conn.release();

    for (const table of COLLECTIONS) {
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS \`${table}\` (
        id VARCHAR(64) PRIMARY KEY,
        data JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    }
    console.log("All tables ensured:", COLLECTIONS.length);

    const [rows] = await pool.query("SHOW TABLES");
    console.log("Tables in database:", rows.map((r) => Object.values(r)[0]));
} catch (e) {
    console.error("MYSQL TEST FAILED:", e && (e.stack || e.message || JSON.stringify(e)));
    console.error("code:", e?.code, "errno:", e?.errno, "sqlState:", e?.sqlState, "address:", e?.address, "port:", e?.port);
    process.exitCode = 1;
} finally {
    await pool.end();
}
