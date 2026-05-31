import { addDays, addMonths, addYears, addWeeks, differenceInMilliseconds } from 'date-fns'
import { prisma } from '@/lib/prisma'

/**
 * Recurrence rules supported in v1. Keep this list tight — every value here
 * must be handled by `advanceDate()` below.
 */
export const RECURRENCE_KINDS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const
export type RecurrenceKind = typeof RECURRENCE_KINDS[number]

export const RECURRENCE_LABELS: Record<RecurrenceKind, string> = {
  DAILY:   'Daily',
  WEEKLY:  'Weekly',
  MONTHLY: 'Monthly',
  YEARLY:  'Yearly',
}

export function isValidRecurrence(s: unknown): s is RecurrenceKind {
  return typeof s === 'string' && (RECURRENCE_KINDS as readonly string[]).includes(s)
}

/** Advance a date forward by one tick of the given rule. */
export function advanceDate(date: Date, kind: RecurrenceKind): Date {
  switch (kind) {
    case 'DAILY':   return addDays(date, 1)
    case 'WEEKLY':  return addWeeks(date, 1)
    case 'MONTHLY': return addMonths(date, 1)
    case 'YEARLY':  return addYears(date, 1)
  }
}

/**
 * Given a task that's about to be marked DONE and has a recurrence rule,
 * spawn the next instance and return it. Returns null when the chain has ended
 * (i.e. the next dueDate would exceed `recurrenceEnd`, or the parent task
 * lacks the info to compute the next due date).
 *
 * Carries forward: title, description, priority, project, assignee, milestone,
 *                  labels, recurrence, recurrenceEnd, recurringFromId, and the
 *                  FieldFlow link (fieldRefType/fieldRefId) so recurring field
 *                  tasks keep pointing at their node/lifting.
 * Does NOT carry: comments, activity log, attachments, subtasks, dependencies,
 *                 _count, status (always TODO), order (default).
 */
export async function spawnNextRecurringInstance(taskId: string, actorId: string) {
  const src = await prisma.task.findUnique({
    where: { id: taskId },
    include: { labels: { select: { id: true } } },
  })
  if (!src || !src.recurrence || !isValidRecurrence(src.recurrence)) return null

  // Need at least one anchor date to advance. Prefer dueDate, fall back to startDate, then now().
  const anchorDue = src.dueDate ?? src.startDate ?? new Date()
  const nextDue = advanceDate(anchorDue, src.recurrence)
  const nextStart = src.startDate && src.dueDate
    ? new Date(nextDue.getTime() - differenceInMilliseconds(src.dueDate, src.startDate))
    : src.startDate
      ? advanceDate(src.startDate, src.recurrence)
      : null

  // Stop if we've passed the end date
  if (src.recurrenceEnd && nextDue > src.recurrenceEnd) return null

  // Determine where the chain root lives
  const recurringFromId = src.recurringFromId || src.id

  // Get the next `order` value for the same status column
  const lastTask = await prisma.task.findFirst({
    where: { projectId: src.projectId, status: 'TODO' },
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  const nextOrder = (lastTask?.order ?? 0) + 1000

  const created = await prisma.task.create({
    data: {
      title:        src.title,
      description:  src.description,
      status:       'TODO',
      priority:     src.priority,
      dueDate:      nextDue,
      startDate:    nextStart ?? undefined,
      projectId:    src.projectId,
      creatorId:    actorId,
      assigneeId:   src.assigneeId,
      milestoneId:  src.milestoneId,
      // Subtasks are not copied automatically; users add a Templates feature
      // later if they need recurring checklists. Keeping behaviour predictable.
      parentId:     null,
      order:        nextOrder,
      recurrence:   src.recurrence,
      recurrenceEnd: src.recurrenceEnd,
      recurringFromId,
      fieldRefType: src.fieldRefType,
      fieldRefId:   src.fieldRefId,
      ...(src.labels.length > 0 && {
        labels: { connect: src.labels.map(l => ({ id: l.id })) },
      }),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      labels: true,
      _count: { select: { comments: true, subTasks: true } },
    },
  })
  return created
}
