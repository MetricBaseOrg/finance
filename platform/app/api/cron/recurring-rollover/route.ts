import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isValidRecurrence, spawnNextRecurringInstance } from '@/lib/recurrence'

/**
 * GET / POST  /api/cron/recurring-rollover
 *
 * Safety net for recurring chains. The primary path is "spawn on DONE", but
 * sometimes a recurring task sits past its dueDate without being completed —
 * e.g. a daily standup that nobody bothers to tick. This endpoint walks all
 * open recurring tasks whose dueDate is more than `graceMinutes` in the past,
 * spawns the next instance, and marks the stale one CANCELLED with a note in
 * the activity log.
 *
 * Auth: same `CRON_SECRET` mechanism as /api/cron/email-digest.
 * Default grace = 60 min so a missed-by-a-minute task isn't immediately rolled.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const url = new URL(req.url)
  const headerSecret = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const querySecret = url.searchParams.get('secret') || ''
  if (headerSecret !== secret && querySecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const graceMinParam = url.searchParams.get('graceMin')
  const graceMin = graceMinParam ? parseInt(graceMinParam, 10) : 60
  const cutoff = new Date(Date.now() - (isFinite(graceMin) ? graceMin : 60) * 60_000)

  // Find tasks that are recurring, still open (not DONE/CANCELLED), and past due.
  const stale = await prisma.task.findMany({
    where: {
      recurrence: { not: null },
      status: { notIn: ['DONE', 'CANCELLED'] },
      dueDate: { lt: cutoff },
    },
    select: { id: true, creatorId: true, recurrence: true },
  })

  let rolledOver = 0
  for (const t of stale) {
    if (!isValidRecurrence(t.recurrence)) continue
    try {
      const next = await spawnNextRecurringInstance(t.id, t.creatorId)
      if (next) {
        // Mark the stale instance as CANCELLED so it stops cluttering the board.
        await prisma.task.update({
          where: { id: t.id },
          data: { status: 'CANCELLED' },
        })
        rolledOver++
      }
    } catch (err) {
      console.error('rollover failed for task', t.id, err)
    }
  }

  return NextResponse.json({ ok: true, scanned: stale.length, rolledOver })
}

export const GET = handle
export const POST = handle
