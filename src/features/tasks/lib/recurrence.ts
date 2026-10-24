import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import type { TaskFrequency } from '@/types/database'

/**
 * The task fields the recurrence engine needs. Keeping this narrow makes the
 * function pure and easy to test without a database row.
 */
export interface RecurrenceTask {
  id: string
  frequency: TaskFrequency
  custom_frequency_days?: number | null
  due_time?: string | null
  schedule_anchor_at?: string | null
  is_one_off?: boolean
  created_at: string
}

export interface GeneratedInstance {
  taskId: string
  /** UTC instant, safe to store in TIMESTAMPTZ. */
  dueAt: string
  /** Local calendar date in the space timezone, useful for grouping. */
  localDate: string
  timezone: string
}

interface CalendarDate {
  year: number
  month: number
  day: number
}

interface WallTime {
  hours: number
  minutes: number
}

const DEFAULT_DUE_TIME: WallTime = { hours: 9, minutes: 0 }
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_INSTANCES_PER_CALL = 5000

function parseDueTime(value: string | null | undefined): WallTime {
  if (!value) return DEFAULT_DUE_TIME
  const [hoursPart, minutesPart] = value.split(':')
  const hours = Number(hoursPart)
  const minutes = Number(minutesPart)
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return DEFAULT_DUE_TIME
  }
  return { hours, minutes }
}

function toValidDate(value: string | Date): Date | null {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function assertTimezone(timezone: string): void {
  if (!timezone || !timezone.trim()) {
    throw new Error('A space timezone is required to generate task instances.')
  }
  try {
    // Intl rejects unknown IANA names; date-fns-tz silently falls back to UTC.
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(0))
    toZonedTime(new Date(0), timezone)
  } catch {
    throw new Error(`Unknown time zone: ${timezone}`)
  }
}

function localParts(instant: Date, timezone: string): CalendarDate {
  const zoned = toZonedTime(instant, timezone)
  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth(),
    day: zoned.getDate(),
  }
}

function dayNumber(parts: CalendarDate): number {
  return Math.floor(Date.UTC(parts.year, parts.month, parts.day, 12) / DAY_MS)
}

function partsFromDayNumber(value: number): CalendarDate {
  const date = new Date(value * DAY_MS + 12 * 60 * 60 * 1000)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  }
}

function addMonthsClamped(anchor: CalendarDate, months: number): CalendarDate {
  const firstOfMonth = new Date(Date.UTC(anchor.year, anchor.month + months, 1, 12))
  const year = firstOfMonth.getUTCFullYear()
  const month = firstOfMonth.getUTCMonth()
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate()
  return { year, month, day: Math.min(anchor.day, lastDay) }
}

function dueInstant(parts: CalendarDate, time: WallTime, timezone: string): Date {
  // fromZonedTime reads the system-local fields of its input, so build the
  // requested wall clock in local fields and let it resolve the UTC offset.
  const wallClock = new Date(parts.year, parts.month, parts.day, time.hours, time.minutes, 0, 0)
  return fromZonedTime(wallClock, timezone)
}

function localDateKey(parts: CalendarDate): string {
  const month = String(parts.month + 1).padStart(2, '0')
  const day = String(parts.day).padStart(2, '0')
  return `${parts.year}-${month}-${day}`
}

function intervalDaysFor(task: RecurrenceTask): number {
  switch (task.frequency) {
    case 'daily':
      return 1
    case 'weekly':
      return 7
    case 'biweekly':
      return 14
    case 'custom': {
      const value = task.custom_frequency_days
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.max(1, Math.floor(value))
      }
      // Custom without a usable interval behaves like weekly, matching the
      // onboarding estimate instead of silently creating no instances.
      return 7
    }
    default:
      return 7
  }
}

/**
 * Generate the due instants for one task inside a half-open window
 * [windowStart, windowEnd). The result is pure: the same inputs always
 * produce the same output, in ascending due order.
 *
 * Recurrence is anchored on `schedule_anchor_at` (falling back to `created_at`)
 * and uses the task's local due time in the space timezone. Monthly and yearly
 * occurrences clamp to the end of shorter months, then return to the original
 * day in later months (Jan 31 -> Feb 28 -> Mar 31).
 */
export function generateInstances(
  task: RecurrenceTask,
  windowStart: string | Date,
  windowEnd: string | Date,
  spaceTimezone: string
): GeneratedInstance[] {
  assertTimezone(spaceTimezone)

  const start = toValidDate(windowStart)
  const end = toValidDate(windowEnd)
  if (!start || !end || start.getTime() >= end.getTime()) return []

  const anchorSource = task.schedule_anchor_at ?? task.created_at
  const anchorInstant = toValidDate(anchorSource)
  if (!anchorInstant) return []

  const anchor = localParts(anchorInstant, spaceTimezone)
  const windowStartParts = localParts(start, spaceTimezone)
  const dueTime = parseDueTime(task.due_time)
  const results: GeneratedInstance[] = []

  const pushIfInside = (parts: CalendarDate): boolean => {
    const due = dueInstant(parts, dueTime, spaceTimezone)
    if (!Number.isFinite(due.getTime())) return false
    if (due.getTime() >= end.getTime()) return true
    if (due.getTime() >= start.getTime()) {
      results.push({
        taskId: task.id,
        dueAt: due.toISOString(),
        localDate: localDateKey(parts),
        timezone: spaceTimezone,
      })
    }
    return false
  }

  // A one-off task (for example an issue follow-up) has exactly one due
  // instant: the local date of its schedule anchor at its due time.
  if (task.is_one_off) {
    pushIfInside(anchor)
    return results
  }

  if (
    task.frequency === 'daily' ||
    task.frequency === 'weekly' ||
    task.frequency === 'biweekly' ||
    task.frequency === 'custom'
  ) {
    const interval = intervalDaysFor(task)
    const anchorDay = dayNumber(anchor)
    const startDay = dayNumber(windowStartParts)
    // Start one interval before the first candidate so a window that begins
    // after the due time still includes that day's occurrence.
    let index = Math.max(0, Math.floor((startDay - anchorDay) / interval) - 1)

    for (let count = 0; count < MAX_INSTANCES_PER_CALL; count += 1) {
      const parts = partsFromDayNumber(anchorDay + index * interval)
      if (pushIfInside(parts)) break
      index += 1
    }

    return results
  }

  const stepMonths = task.frequency === 'quarterly' ? 3 : task.frequency === 'yearly' ? 12 : 1
  const monthDifference =
    (windowStartParts.year - anchor.year) * 12 + (windowStartParts.month - anchor.month)
  let monthIndex = Math.max(0, Math.floor(monthDifference / stepMonths) - 1)

  for (let count = 0; count < MAX_INSTANCES_PER_CALL; count += 1) {
    const parts = addMonthsClamped(anchor, monthIndex * stepMonths)
    if (pushIfInside(parts)) break
    monthIndex += 1
  }

  return results
}

/** First instant of the local calendar day containing `instant`. */
export function startOfZonedDay(instant: string | Date, timezone: string): Date {
  assertTimezone(timezone)
  const date = toValidDate(instant)
  if (!date) throw new Error('A valid date is required.')
  const parts = localParts(date, timezone)
  return fromZonedTime(new Date(parts.year, parts.month, parts.day, 0, 0, 0, 0), timezone)
}

/** Add whole calendar days in the space timezone, preserving local midnight. */
export function addZonedDays(instant: string | Date, days: number, timezone: string): Date {
  const start = startOfZonedDay(instant, timezone)
  const parts = localParts(start, timezone)
  const next = partsFromDayNumber(dayNumber(parts) + Math.trunc(days))
  return fromZonedTime(new Date(next.year, next.month, next.day, 0, 0, 0, 0), timezone)
}

/** Local date key (YYYY-MM-DD) for grouping and "is today" checks. */
export function zonedDateKey(instant: string | Date, timezone: string): string {
  assertTimezone(timezone)
  const date = toValidDate(instant)
  if (!date) return ''
  return localDateKey(localParts(date, timezone))
}
