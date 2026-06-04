import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { disconnect, isConfigured } from '@/lib/googledrive'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/googledrive/me — whether the current user has connected Google Drive.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const acct = await prisma.googleAccount.findUnique({
    where: { userId: session.user.id },
    select: { id: true, email: true, displayName: true, createdAt: true },
  })

  return NextResponse.json({
    configured: isConfigured(),
    connected: !!acct,
    account: acct,
  })
}

/** DELETE /api/googledrive/me — disconnect Google Drive for the current user. */
export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await disconnect(session.user.id)
  return NextResponse.json({ ok: true })
}
