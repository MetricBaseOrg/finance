import { format } from 'date-fns'

/**
 * Task start/due timestamps. `Task.dueDate`/`startDate` are full `DateTime`s, but
 * historically only the day was set (stored at UTC midnight) because the UI used
 * date-only inputs. FieldFlow assigns work with real hour:minute windows, so the
 * UI now supports time-of-day.
 *
 * Distinguishing "date-only" from "timed" without a schema flag: a value stored
 * at exactly UTC midnight is treated as date-only (legacy day, or a user who left
 * the time at 00:00). Anything else carries a meaningful time. This keeps existing
 * day-level tasks rendering as a bare day (no spurious "7:00 AM" in +07:00) while
 * timed tasks show the clock.
 */

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = typeof value === 'string' ? new Date(value) : value
  return isNaN(d.getTime()) ? null : d
}

/** A value pinned to UTC midnight is a day-level date with no meaningful time. */
export function isDateOnly(value: string | Date | null | undefined): boolean {
  const d = toDate(value)
  if (!d) return false
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Value for a `datetime-local` input. Date-only values use their UTC calendar day
 * at 00:00 (so the day doesn't drift by timezone); timed values use local wall time.
 */
export function toLocalInput(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return ''
  if (isDateOnly(d)) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T00:00`
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Convert a `datetime-local` value (local, tz-naive) to an absolute ISO string for storage. */
export function localInputToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value) // parsed in the browser's local timezone
  return isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Human display. Date-only → "MMM d" (UTC calendar day); timed → "MMM d, h:mm a"
 * in local time. Pass { year: true } to include the year.
 */
export function formatWhen(value: string | Date | null | undefined, opts?: { year?: boolean }): string {
  const d = toDate(value)
  if (!d) return ''
  const datePart = opts?.year ? 'MMM d, yyyy' : 'MMM d'
  if (isDateOnly(d)) {
    // Render the UTC calendar day so it doesn't shift across timezones.
    const dayLocal = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    return format(dayLocal, datePart)
  }
  return format(d, `${datePart}, h:mm a`)
}

/** Just the clock time ("2:30 PM"), or "" for date-only values. */
export function formatTime(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d || isDateOnly(d)) return ''
  return format(d, 'h:mm a')
}
