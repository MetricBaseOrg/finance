import { NextRequest, NextResponse } from 'next/server'
import { authorizeBot } from '@/server/bot'

export const dynamic = 'force-dynamic'

// Who is this Telegram user, and which workspace/role is the bot acting under?
export async function POST(req: NextRequest) {
  const a = await authorizeBot(req)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })

  return NextResponse.json({
    name: a.actor.user.name,
    email: a.actor.user.email,
    workspace: a.actor.organizationName,
    role: a.actor.role,
    workspaces: a.actor.orgs.map((o) => ({ id: o.id, name: o.name, role: o.role })),
  })
}
