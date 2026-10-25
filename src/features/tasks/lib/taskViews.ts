import { formatInTimeZone } from 'date-fns-tz'
import type { Task, TaskDependency, TaskInstance } from '@/types/database'
import { addZonedDays, startOfZonedDay, zonedDateKey } from './recurrence'

export interface TaskInstanceView {
  instance: TaskInstance
  task: Task
  areaName: string | null
  assigneeName: string | null
}

export interface DependencyBlocker {
  taskId: string
  taskName: string
  instanceId: string
  dueAt: string
}

export function isOpenInstance(instance: Pick<TaskInstance, 'status'>): boolean {
  return instance.status === 'pending' || instance.status === 'in_progress'
}

export function isOverdueInstance(
  instance: Pick<TaskInstance, 'status' | 'due_at'>,
  now: Date = new Date()
): boolean {
  return isOpenInstance(instance) && new Date(instance.due_at).getTime() < now.getTime()
}

export function isDueOnLocalDay(
  instance: Pick<TaskInstance, 'due_at'>,
  day: Date,
  timezone: string
): boolean {
  return zonedDateKey(instance.due_at, timezone) === zonedDateKey(day, timezone)
}

export function isCompletedOnLocalDay(
  instance: Pick<TaskInstance, 'status' | 'completed_at'>,
  day: Date,
  timezone: string
): boolean {
  return (
    instance.status === 'completed' &&
    Boolean(instance.completed_at) &&
    zonedDateKey(instance.completed_at as string, timezone) === zonedDateKey(day, timezone)
  )
}

function byDueAscending(a: TaskInstanceView, b: TaskInstanceView): number {
  return new Date(a.instance.due_at).getTime() - new Date(b.instance.due_at).getTime()
}

/**
 * The action-first list: at most `max` open items that are already due
 * (overdue first, then today). No future work is promoted into this list.
 */
export function selectTodayFocus(
  views: TaskInstanceView[],
  now: Date,
  timezone: string,
  max = 3
): TaskInstanceView[] {
  const endOfToday = addZonedDays(startOfZonedDay(now, timezone), 1, timezone)
  return views
    .filter(
      (view) =>
        isOpenInstance(view.instance) &&
        new Date(view.instance.due_at).getTime() < endOfToday.getTime()
    )
    .sort(byDueAscending)
    .slice(0, Math.max(0, max))
}

/** Open items due today or earlier that did not fit in the prominent list. */
export function selectTodayRemaining(
  views: TaskInstanceView[],
  now: Date,
  timezone: string,
  focus: TaskInstanceView[]
): TaskInstanceView[] {
  const endOfToday = addZonedDays(startOfZonedDay(now, timezone), 1, timezone)
  const focusIds = new Set(focus.map((view) => view.instance.id))
  return views
    .filter(
      (view) =>
        isOpenInstance(view.instance) &&
        new Date(view.instance.due_at).getTime() < endOfToday.getTime() &&
        !focusIds.has(view.instance.id)
    )
    .sort(byDueAscending)
}

/** Open items due after today, within the next `days` local days. */
export function selectUpcoming(
  views: TaskInstanceView[],
  now: Date,
  timezone: string,
  days = 7
): TaskInstanceView[] {
  const startOfToday = startOfZonedDay(now, timezone)
  const endOfToday = addZonedDays(startOfToday, 1, timezone)
  const horizon = addZonedDays(startOfToday, days + 1, timezone)
  return views
    .filter((view) => {
      const due = new Date(view.instance.due_at).getTime()
      return isOpenInstance(view.instance) && due >= endOfToday.getTime() && due < horizon.getTime()
    })
    .sort(byDueAscending)
}

export function countCompletedToday(
  views: TaskInstanceView[],
  now: Date,
  timezone: string
): number {
  return views.filter((view) => isCompletedOnLocalDay(view.instance, now, timezone)).length
}

/**
 * A task is blocked while the latest occurrence of any dependency due on or
 * before this instance is still open. Older missed occurrences do not stack.
 */
export function dependencyBlockers(
  view: TaskInstanceView,
  allViews: TaskInstanceView[],
  dependencies: Pick<TaskDependency, 'task_id' | 'depends_on_task_id'>[]
): DependencyBlocker[] {
  const blockers: DependencyBlocker[] = []
  const directDependencies = dependencies.filter(
    (dependency) => dependency.task_id === view.task.id
  )

  for (const dependency of directDependencies) {
    const dueAt = new Date(view.instance.due_at).getTime()
    const candidates = allViews
      .filter(
        (candidate) =>
          candidate.task.id === dependency.depends_on_task_id &&
          new Date(candidate.instance.due_at).getTime() <= dueAt
      )
      .sort(byDueAscending)

    const latest = candidates[candidates.length - 1]
    if (!latest) continue
    if (latest.instance.status === 'completed' || latest.instance.status === 'skipped') continue

    blockers.push({
      taskId: latest.task.id,
      taskName: latest.task.name,
      instanceId: latest.instance.id,
      dueAt: latest.instance.due_at,
    })
  }

  return blockers
}

export function formatDueTime(dueAt: string, timezone: string): string {
  return formatInTimeZone(new Date(dueAt), timezone, 'h:mm a')
}

export function formatDueDate(dueAt: string, timezone: string): string {
  return formatInTimeZone(new Date(dueAt), timezone, 'EEE, MMM d')
}

export function describeDue(
  view: TaskInstanceView,
  now: Date,
  timezone: string
): string {
  if (view.instance.status === 'completed') return 'Completed'
  if (view.instance.status === 'skipped') return 'Skipped'

  const dueKey = zonedDateKey(view.instance.due_at, timezone)
  const todayKey = zonedDateKey(now, timezone)
  const tomorrowKey = zonedDateKey(addZonedDays(startOfZonedDay(now, timezone), 1, timezone), timezone)
  const time = formatDueTime(view.instance.due_at, timezone)

  if (dueKey < todayKey) {
    const dueDay = Date.parse(`${dueKey}T12:00:00Z`)
    const todayDay = Date.parse(`${todayKey}T12:00:00Z`)
    const days = Math.max(1, Math.round((todayDay - dueDay) / (24 * 60 * 60 * 1000)))
    return `Overdue by ${days} ${days === 1 ? 'day' : 'days'}`
  }
  if (dueKey === todayKey) return `Due today at ${time}`
  if (dueKey === tomorrowKey) return `Tomorrow at ${time}`
  return `${formatDueDate(view.instance.due_at, timezone)} at ${time}`
}

function normalizeId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return value ?? null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function canCompleteInstance(
  role: string | null,
  userId: string | null,
  instance: Pick<TaskInstance, 'assignee_id'>
): boolean {
  const normalizedUserId = normalizeId(userId)
  const assigneeId = normalizeId(instance.assignee_id)

  if (!normalizedUserId) return false
  if (role === 'owner' || role === 'admin' || role === 'supervisor') return true
  return assigneeId === null || assigneeId === normalizedUserId
}
