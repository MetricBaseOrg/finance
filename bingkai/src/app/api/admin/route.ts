import { NextResponse } from "next/server";
import { USING_DB, db, setListedBySlug } from "@/lib/store";
import { isAdmin } from "@/lib/sponsor/admin";
import { isSponsorId } from "@/lib/sponsor/memo";

/** Admin moderation: hide/show a sponsor, list/unlist a campaign in the directory. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData();
  const id = String(form.get("id") ?? "");
  const action = String(form.get("action") ?? "");
  const back = NextResponse.redirect(new URL("/admin", req.url), 303);

  if (action === "unlist" || action === "list") {
    await setListedBySlug(id, action === "list");
    return back;
  }
  if (!USING_DB || !isSponsorId(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const p = await db();
  if (action === "hide") await p.$executeRaw`update sponsors set hidden = true, hidden_reason = 'admin' where id = ${id}`;
  else if (action === "show") {
    await p.$executeRaw`update sponsors set hidden = false, hidden_reason = null where id = ${id}`;
    await p.$executeRaw`delete from sponsor_reports where sponsor_id = ${id}`;
  } else return NextResponse.json({ error: "bad action" }, { status: 400 });
  return back;
}
