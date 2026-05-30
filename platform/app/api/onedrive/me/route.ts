import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { disconnect, isConfigured } from '@/lib/onedrive'

/**
 * GET /api/onedrive/me — returns whether the current user has connected
 * OneDrive, and basic info if so.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const acct = await prisma.microsoftAccount.findUnique({
    where: { userId: session.user.id },
    select: { id: true, email: true, displayName: true, createdAt: true },
  })

  return NextResponse.json({
    configured: isConfigured(),
    connected: !!acct,
    account: acct,
  })
}

/** DELETE /api/onedrive/me — disconnect OneDrive for the current user. */
export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await disconnect(session.user.id)
  return NextResponse.json({ ok: true })
}
