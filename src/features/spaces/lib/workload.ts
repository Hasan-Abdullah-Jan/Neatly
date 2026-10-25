import type { Task, TaskInstance } from '@/types/database'

export interface MemberWorkload {
  userId: string
  minutes: number
  taskCount: number
}

export interface WeeklyLoadSnapshot {
  minutesByMember: ReadonlyMap<string, number>
  availableMemberIds: string[]
}

export interface UnequalLoadSuggestion {
  userId: string
  memberMinutes: number[]
  peerAverageMinutes: number[]
}

function normalizeMemberId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return value ?? null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function calculateWeeklyWorkload(
  instances: TaskInstance[],
  tasks: Task[]
): { members: MemberWorkload[]; unassignedMinutes: number } {
  const taskMinutes = new Map(tasks.map((task) => [task.id, task.estimated_minutes ?? 0]))
  const byMember = new Map<string, MemberWorkload>()
  let unassignedMinutes = 0

  for (const instance of instances) {
    if (instance.status === 'skipped' || instance.deleted_at) continue
    const minutes = taskMinutes.get(instance.task_id) ?? 0
    const assigneeId = normalizeMemberId(instance.assignee_id)
    if (!assigneeId) {
      unassignedMinutes += minutes
      continue
    }
    const workload = byMember.get(assigneeId) ?? {
      userId: assigneeId,
      minutes: 0,
      taskCount: 0,
    }
    workload.minutes += minutes
    workload.taskCount += 1
    byMember.set(assigneeId, workload)
  }

  return { members: [...byMember.values()], unassignedMinutes }
}

export function findUnequalLoadSuggestion(
  weeks: WeeklyLoadSnapshot[],
  minimumMinutes = 60,
  ratioThreshold = 1.5
): UnequalLoadSuggestion | null {
  if (weeks.length !== 4) return null

  const candidates = weeks[0]?.availableMemberIds ?? []
  const suggestions = candidates.flatMap((userId) => {
    const memberMinutes: number[] = []
    const peerAverageMinutes: number[] = []
    for (const week of weeks) {
      if (!week.availableMemberIds.includes(userId)) return []
      const peers = week.availableMemberIds.filter((id) => id !== userId)
      if (peers.length === 0) return []
      const minutes = week.minutesByMember.get(userId) ?? 0
      const average = peers.reduce((sum, peerId) => sum + (week.minutesByMember.get(peerId) ?? 0), 0) / peers.length
      if (minutes < minimumMinutes || minutes <= average * ratioThreshold) return []
      memberMinutes.push(minutes)
      peerAverageMinutes.push(Math.round(average))
    }
    return [{ userId, memberMinutes, peerAverageMinutes }]
  })

  return suggestions.sort(
    (a, b) =>
      b.memberMinutes.reduce((sum, minutes) => sum + minutes, 0) -
      a.memberMinutes.reduce((sum, minutes) => sum + minutes, 0)
  )[0] ?? null
}
