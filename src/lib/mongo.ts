/** DB bootstrap layer. Application data is only persisted on the server in MySQL. */
import { ensureMysqlReady, isMysqlEnabled } from "./mysql";

let seeded: Promise<void> | null = null;

export async function dbConnect() {
  if (typeof window !== "undefined") throw new Error("Browser database access is disabled. Use a server API route.");
  if (!isMysqlEnabled()) throw new Error("MySQL is required. Configure MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, and MYSQL_PASSWORD.");
  if (!seeded) seeded = import("./seed").then(async (m) => { await ensureMysqlReady(); await m.seedAll(); }).catch((e) => { seeded = null; throw e; });
  await seeded;
}

export const mongoose = null;
