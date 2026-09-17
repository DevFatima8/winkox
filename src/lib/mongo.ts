/**
 * LocalDB mode: there is no server database. `dbConnect()` is kept for API compatibility with the
 * game engines; it just makes sure default data (accounts, games, settings) exists in the browser store.
 */
let seeded: Promise<void> | null = null;
export async function dbConnect() {
  if (typeof window === "undefined") return; // SSR: nothing to do
  if (!seeded) {
    seeded = import("./seed").then((m) => m.seedAll()).catch((e) => { seeded = null; throw e; });
  }
  await seeded;
}
export const mongoose = null;
