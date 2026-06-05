import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: "up" });
  } catch (e) {
    return Response.json(
      { ok: false, db: "down", error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
