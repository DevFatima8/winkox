import { dbConnect } from "./mongo";
import { Feedback, oid } from "@/models";
import { getCurrentUser } from "./auth";

export async function submitFeedback(b: { name?: string; phone?: string; type?: string; message?: string }) {
  await dbConnect();
  const me = await getCurrentUser();
  const message = String(b.message ?? "").trim().slice(0, 3000);
  const type = (["reward", "complaint", "suggestion", "other"].includes(String(b.type)) ? String(b.type) : "reward") as "reward" | "complaint" | "suggestion" | "other";
  if (!message) return { error: "Message required." };
  const name = me?.name ?? String(b.name ?? "").trim().slice(0, 80);
  const phone = me?.phone ?? String(b.phone ?? "").trim().slice(0, 20);
  if (!me && (!name || !phone)) return { error: "Name and phone required." };
  await Feedback.create({ userId: me ? oid(me.id) : null, name, phone, type, message });
  return { ok: true };
}
