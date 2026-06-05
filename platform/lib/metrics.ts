/**
 * Shared performance-metric helpers.
 *
 * `resolveDoneAt` mirrors the done-timestamp logic used by the S-curve API
 * (app/api/projects/[id]/s-curve/route.ts): the moment a task first transitioned
 * to DONE, read from the TaskActivity log, with a fallback to `updatedAt` for
 * currently-DONE tasks that predate the activity log.
 */

export type DoneActivity = { taskId: string; metadata: string | null; createdAt: Date }
export type DoneTask = { id: string; status: string; updatedAt: Date }

/**
 * Build a map of taskId → the Date it first became DONE.
 *
 * @param tasks       tasks to consider (only status==='DONE' get a fallback)
 * @param activities  TaskActivity rows with kind='status.changed', any order
 */
export function resolveDoneAt(tasks: DoneTask[], activities: DoneActivity[]): Map<string, Date> {
  const doneAt = new Map<string, Date>()

  // Earliest logged transition to DONE wins. Activities may arrive unordered,
  // so keep the minimum createdAt per task.
  for (const e of activities) {
    if (!e.metadata) continue
    try {
      const m = JSON.parse(e.metadata) as { to?: unknown }
      if (m.to !== 'DONE') continue
      const prev = doneAt.get(e.taskId)
      if (!prev || e.createdAt < prev) doneAt.set(e.taskId, e.createdAt)
    } catch {
      // Ignore malformed metadata
    }
  }

  // Fallback for currently-DONE tasks with no logged transition.
  for (const t of tasks) {
    if (t.status === 'DONE' && !doneAt.has(t.id)) doneAt.set(t.id, t.updatedAt)
  }

  return doneAt
}

const DAY_MS = 24 * 3600 * 1000

/**
 * Split [from, to] into 7-day buckets and count how many of `dates` fall in
 * each. Used for the throughput sparkline.
 */
export function weeklyBuckets(dates: Date[], from: Date, to: Date): number[] {
  const span = Math.max(to.getTime() - from.getTime(), DAY_MS)
  const nBuckets = Math.max(1, Math.ceil(span / (7 * DAY_MS)))
  const buckets = new Array<number>(nBuckets).fill(0)
  for (const d of dates) {
    const offset = d.getTime() - from.getTime()
    if (offset < 0 || offset > span) continue
    const idx = Math.min(nBuckets - 1, Math.floor(offset / (7 * DAY_MS)))
    buckets[idx] += 1
  }
  return buckets
}
