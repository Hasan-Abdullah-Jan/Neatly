import type { Area, Task, TaskInstance } from '@/types/database'
import { addZonedDays, startOfZonedDay, zonedDateKey } from '@features/tasks/lib/recurrence'
import { formatDueDate } from '@features/tasks/lib/taskViews'

export type AreaStatusTone = 'default' | 'primary' | 'amber' | 'success' | 'info' | 'outline'

export interface AreaStatusSource extends Pick<Area, 'active'> {
  instances: Array<Pick<TaskInstance, 'status' | 'due_at' | 'completed_at'>>
  timezone: string
  /** Open issue records linked to this area. */
  openIssueCount?: number
  /** Area+category patterns marked recurring in the rolling window. */
  recurringIssueCount?: number
}

export interface AreaStatus {
  key:
    | 'archived'
    | 'issue_open'
    | 'not_scheduled'
    | 'needs_attention'
    | 'due_today'
    | 'recent_progress'
    | 'upcoming'
    | 'quiet'
  label: string
  tone: AreaStatusTone
  reason: string
  overdueCount: number
  dueTodayCount: number
  recentCompletionCount: number
  openIssueCount: number
  recurringIssueCount: number
}

/**
 * Area status is derived from task instance records plus open issue records.
 * It never claims a hygiene or clinical outcome, and it never penalises missed
 * work.
 */
export function deriveAreaStatus(area: AreaStatusSource, now: Date = new Date()): AreaStatus {
  if (!area.active) {
    return {
      key: 'archived',
      label: 'Archived',
      tone: 'default',
      reason: 'This area is archived. Its history is kept.',
      overdueCount: 0,
      dueTodayCount: 0,
      recentCompletionCount: 0,
      openIssueCount: 0,
      recurringIssueCount: 0,
    }
  }

  const open = area.instances.filter(
    (instance) => instance.status === 'pending' || instance.status === 'in_progress'
  )
  const todayKey = zonedDateKey(now, area.timezone)
  const endOfToday = addZonedDays(startOfZonedDay(now, area.timezone), 1, area.timezone)
  const recentCutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000

  const overdue = open.filter(
    (instance) =>
      new Date(instance.due_at).getTime() < now.getTime() &&
      zonedDateKey(instance.due_at, area.timezone) < todayKey
  )
  const dueToday = open.filter(
    (instance) => zonedDateKey(instance.due_at, area.timezone) === todayKey
  )
  const upcoming = open
    .filter((instance) => new Date(instance.due_at).getTime() >= endOfToday.getTime())
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
  const recentCompletions = area.instances.filter(
    (instance) =>
      instance.status === 'completed' &&
      Boolean(instance.completed_at) &&
      new Date(instance.completed_at as string).getTime() >= recentCutoff
  )
  const openIssueCount = area.openIssueCount ?? 0
  const recurringIssueCount = area.recurringIssueCount ?? 0

  // An open issue is explicit human attention, so it takes priority over the
  // task-derived labels. Task counts stay in the reason instead of being lost.
  if (openIssueCount > 0) {
    const parts = [
      `${openIssueCount} ${openIssueCount === 1 ? 'open issue' : 'open issues'} reported in this area.`,
    ]
    if (recurringIssueCount > 0) {
      parts.push(
        `${recurringIssueCount} ${
          recurringIssueCount === 1 ? 'category has' : 'categories have'
        } repeated in the last 30 days.`
      )
    }
    if (overdue.length > 0) {
      parts.push(
        `${overdue.length} ${overdue.length === 1 ? 'task is' : 'tasks are'} also past due.`
      )
    }
    if (dueToday.length > 0) {
      parts.push(
        `${dueToday.length} ${dueToday.length === 1 ? 'task is' : 'tasks are'} due today.`
      )
    }
    parts.push('Open the issues list to see who is handling it.')

    return {
      key: 'issue_open',
      label: openIssueCount === 1 ? 'Issue open' : `${openIssueCount} issues open`,
      tone: 'amber',
      reason: parts.join(' '),
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      recentCompletionCount: recentCompletions.length,
      openIssueCount,
      recurringIssueCount,
    }
  }

  if (area.instances.length === 0) {
    return {
      key: 'not_scheduled',
      label: 'No schedule',
      tone: 'outline',
      reason: 'No task instances are scheduled in this period.',
      overdueCount: 0,
      dueTodayCount: 0,
      recentCompletionCount: 0,
      openIssueCount,
      recurringIssueCount,
    }
  }

  if (overdue.length > 0) {
    return {
      key: 'needs_attention',
      label: `${overdue.length} overdue`,
      tone: 'amber',
      reason: `${overdue.length} open ${
        overdue.length === 1 ? 'task is' : 'tasks are'
      } past due. Nothing is penalised; do what you can or reschedule.`,
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      recentCompletionCount: recentCompletions.length,
      openIssueCount,
      recurringIssueCount,
    }
  }

  if (dueToday.length > 0) {
    return {
      key: 'due_today',
      label: `${dueToday.length} due today`,
      tone: 'info',
      reason: `${dueToday.length} ${
        dueToday.length === 1 ? 'task is' : 'tasks are'
      } due today in ${area.timezone}.`,
      overdueCount: 0,
      dueTodayCount: dueToday.length,
      recentCompletionCount: recentCompletions.length,
      openIssueCount,
      recurringIssueCount,
    }
  }

  if (recentCompletions.length > 0) {
    return {
      key: 'recent_progress',
      label: 'Recent progress',
      tone: 'success',
      reason: `${recentCompletions.length} ${
        recentCompletions.length === 1 ? 'completion' : 'completions'
      } recorded in the last 7 days.`,
      overdueCount: 0,
      dueTodayCount: 0,
      recentCompletionCount: recentCompletions.length,
      openIssueCount,
      recurringIssueCount,
    }
  }

  if (upcoming.length > 0) {
    const next = upcoming[0]
    return {
      key: 'upcoming',
      label: 'Upcoming',
      tone: 'primary',
      reason: next ? `Next task due ${formatDueDate(next.due_at, area.timezone)}.` : 'Upcoming tasks.',
      overdueCount: 0,
      dueTodayCount: 0,
      recentCompletionCount: 0,
      openIssueCount,
      recurringIssueCount,
    }
  }

  return {
    key: 'quiet',
    label: 'No open work',
    tone: 'default',
    reason: 'No open tasks in this period. Completed and skipped records are kept.',
    overdueCount: 0,
    dueTodayCount: 0,
    recentCompletionCount: 0,
    openIssueCount,
    recurringIssueCount,
  }
}

/** Instances that belong to an area, via their task definitions. */
export function instancesForArea(
  areaId: string,
  tasks: Array<Pick<Task, 'id' | 'area_id'>>,
  instances: TaskInstance[]
): TaskInstance[] {
  const taskIds = new Set(
    tasks.filter((task) => task.area_id === areaId).map((task) => task.id)
  )
  return instances.filter((instance) => taskIds.has(instance.task_id))
}
