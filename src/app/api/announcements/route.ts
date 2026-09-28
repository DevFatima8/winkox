import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/serverAuth";
import { dbConnect } from "@/lib/mongo";
import { Settings } from "@/models";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getServerSessionUser();
  if (!user || user.level < 2) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  await dbConnect();
  const settings = await Settings.findOne({ key: "main" }).lean();
  return NextResponse.json({ announcement: settings?.announcement ?? "" }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getServerSessionUser();
  if (!user || user.level < 2) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const announcement = String(body.announcement ?? "").trim().slice(0, 500);
  if (!announcement) return NextResponse.json({ error: "Announcement khali nahi ho sakti." }, { status: 400 });
  await dbConnect();
  await Settings.updateOne({ key: "main" }, { $set: { announcement } }, { upsert: true });
  return NextResponse.json({ ok: true });
}