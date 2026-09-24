/**
 * DB bootstrap layer.
 * If MySQL env values are configured, the app uses MySQL-backed models.
 * Otherwise it falls back to the browser LocalDB mode for development.
 */
import { ensureMysqlReady } from "./mysql";

let seeded: Promise<void> | null = null;

export async function dbConnect() {
  if (typeof window === "undefined") {
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
