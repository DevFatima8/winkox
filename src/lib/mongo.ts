/**
 * DB bootstrap layer.
 * If MySQL env values are configured, the app uses MySQL-backed models.
 * Otherwise it falls back to the browser LocalDB mode for development.
 */
import { ensureMysqlReady, isMysqlEnabled } from "./mysql";

let seeded: Promise<void> | null = null;

export async function dbConnect() {
  if (typeof window === "undefined") {
    if (process.env.NODE_ENV === "production" && !isMysqlEnabled()) {
      throw new Error("MySQL is not configured. Set MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, and MYSQL_PASSWORD on the hosting server.");
    }
    if (!seeded) {
      seeded = import("./seed").then(async (m) => {
        await ensureMysqlReady();
        await m.seedAll();
      }).catch((e) => { seeded = null; throw e; });
    }
    await seeded;
    return;
  }

  if (!seeded) {
    seeded = import("./seed").then((m) => m.seedAll()).catch((e) => { seeded = null; throw e; });
  }
  await seeded;
}

export const mongoose = null;
