import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { Card } from '@components/ui/Card'
import { Link } from 'react-router-dom'
import { ErrorState } from '@components/ui/ErrorState'
import { Skeleton } from '@components/ui/Skeleton'
import { useAuth } from '@contexts/AuthContext'
import { fetchSpaceMembers } from '../api/spaces'
import type { SpaceMember } from '../api/spaces'
import { fetchTasks, fetchInstancesInWindow } from '@features/tasks/api/tasks'
import { addZonedDays, startOfZonedDay, zonedDateKey } from '@features/tasks/lib/recurrence'
import type { Task, TaskInstance } from '@/types/database'
import { calculateWeeklyWorkload, findUnequalLoadSuggestion, type WeeklyLoadSnapshot } from '../lib/workload'
import { cancelSwap, getAwayPeriods, getTaskSwaps, respondToSwap, type TaskSwapWithInstance } from '../api/assignments'
import { fetchMembershipRole } from '@features/tasks/api/tasks'
import { isTaskManager } from '@features/tasks/lib/permissions'
import { Button } from '@components/ui/Button'
import { useNow } from '@hooks/useNow'

export function WorkloadPage() {
  const { currentSpace, user } = useAuth()
  const now = useNow()
  const [members, setMembers] = useState<SpaceMember[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [instances, setInstances] = useState<TaskInstance[]>([])
  const [historyInstances, setHistoryInstances] = useState<TaskInstance[]>([])
  const [awayPeriods, setAwayPeriods] = useState<Awaited<ReturnType<typeof getAwayPeriods>>>([])
  const [swaps, setSwaps] = useState<TaskSwapWithInstance[]>([])
  const [canManage, setCanManage] = useState(false)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timezone = currentSpace?.timezone ?? 'UTC'

  const load = useCallback(async () => {
    if (!currentSpace) return
    setLoading(true)
    setError(null)
    try {
      const today = startOfZonedDay(new Date(), timezone)
      const day = new Date(`${zonedDateKey(today, timezone)}T12:00:00Z`).getUTCDay()
      const weekStart = addZonedDays(today, -((day + 6) % 7), timezone)
      const weekEnd = addZonedDays(weekStart, 7, timezone)
      const historyStart = addZonedDays(weekStart, -28, timezone)
      const [nextMembers, nextTasks, nextInstances, nextHistory, nextAway, nextSwaps, role] = await Promise.all([
        fetchSpaceMembers(currentSpace.id),
        fetchTasks(currentSpace.id, true),
        fetchInstancesInWindow(
          currentSpace.id,
          weekStart.toISOString(),
          weekEnd.toISOString(),
          1000
        ),
        fetchInstancesInWindow(
          currentSpace.id,
          historyStart.toISOString(),
          weekStart.toISOString(),
          3000
        ),
        getAwayPeriods(currentSpace.id),
        getTaskSwaps(currentSpace.id),
        user ? fetchMembershipRole(currentSpace.id, user.id) : Promise.resolve(null),
      ])
      setMembers(nextMembers)
      setTasks(nextTasks)
      setInstances(nextInstances)
      setHistoryInstances(nextHistory)
      setAwayPeriods(nextAway)
      setSwaps(nextSwaps)
      setCanManage(isTaskManager(role))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load team workload.')
    } finally {
      setLoading(false)
    }
  }, [currentSpace, timezone, user])

  useEffect(() => {
    void load()
  }, [load])

  const workload = useMemo(
    () => calculateWeeklyWorkload(instances, tasks),
    [instances, tasks]
  )
  const previousWeeks: WeeklyLoadSnapshot[] = useMemo(() => {
    if (members.length === 0) return []
    const taskMinutes = new Map(tasks.map((task) => [task.id, task.estimated_minutes ?? 0]))
    const weeks: WeeklyLoadSnapshot[] = []
    const currentWeekStart = addZonedDays(
      startOfZonedDay(now, timezone),
      -((new Date(`${zonedDateKey(now, timezone)}T12:00:00Z`).getUTCDay() + 6) % 7),
      timezone
    )
    for (let weekIndex = 4; weekIndex >= 1; weekIndex -= 1) {
      const start = addZonedDays(currentWeekStart, -weekIndex * 7, timezone)
      const end = addZonedDays(start, 7, timezone)
      const minutesByMember = new Map<string, number>()
      for (const instance of historyInstances) {
        if (instance.status === 'skipped' || instance.deleted_at) continue
        const dueAt = new Date(instance.due_at).getTime()
        if (dueAt < start.getTime() || dueAt >= end.getTime() || !instance.assignee_id) continue
        minutesByMember.set(
          instance.assignee_id,
          (minutesByMember.get(instance.assignee_id) ?? 0) + (taskMinutes.get(instance.task_id) ?? 0)
        )
      }
      const availableMemberIds = members
        .map((member) => member.membership.user_id)
        .filter((userId) =>
          !awayPeriods.some((away) =>
            away.user_id === userId &&
            new Date(away.starts_at).getTime() < end.getTime() &&
            (away.ends_at === null || new Date(away.ends_at).getTime() >= start.getTime())
          )
        )
      weeks.push({ minutesByMember, availableMemberIds })
    }
    return weeks
  }, [awayPeriods, historyInstances, members, now, tasks, timezone])
  const unequalLoadSuggestion = canManage ? findUnequalLoadSuggestion(previousWeeks) : null
  const workloadByUser = new Map(workload.members.map((entry) => [entry.userId, entry]))
  const displayMembers = members
    .map((member) => ({
      member,
      workload: workloadByUser.get(member.membership.user_id) ?? {
        userId: member.membership.user_id,
        minutes: 0,
        taskCount: 0,
      },
    }))
    .sort((a, b) =>
      (a.member.profile?.full_name ?? '').localeCompare(b.member.profile?.full_name ?? '')
    )
  const taskNameById = new Map(tasks.map((task) => [task.id, task.name]))
  const memberNameById = new Map(
    members.map((member) => [
      member.membership.user_id,
      member.profile?.full_name?.trim() || 'Member',
    ])
  )
  const pendingSwaps = swaps.filter(({ swap }) => swap.status === 'pending')
  const handleSwapResponse = async (swapId: string, response: 'accepted' | 'declined') => {
    setSwapError(null)
    try {
      await respondToSwap(swapId, response)
      await load()
    } catch (responseError) {
      setSwapError(responseError instanceof Error ? responseError.message : 'Could not update request.')
    }
  }
  const handleCancelSwap = async (swapId: string) => {
    setSwapError(null)
    try {
      await cancelSwap(swapId)
      await load()
    } catch (cancelError) {
      setSwapError(cancelError instanceof Error ? cancelError.message : 'Could not cancel request.')
    }
  }

  if (loading) {
    return <div className="space-y-3"><Skeleton className="h-8 w-56" /><Skeleton variant="card" /></div>
  }
  if (error) return <ErrorState title="Could not load workload" message={error} onRetry={() => void load()} />

  const today = startOfZonedDay(now, timezone)
  const weekday = new Date(`${zonedDateKey(today, timezone)}T12:00:00Z`).getUTCDay()
  const weekStart = addZonedDays(today, -((weekday + 6) % 7), timezone)
  const weekLabel = `Week of ${formatInTimeZone(weekStart, timezone, 'MMM d, yyyy')}`

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display-sm font-semibold text-text">Weekly workload</h1>
        <p className="mt-1 text-text-muted">
          {weekLabel} · Assigned task estimates in minutes. This is context for rebalancing, not a
          ranking or leaderboard.
        </p>
      </header>
      {unequalLoadSuggestion && (
        <Card className="border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20">
          <h2 className="font-semibold text-text">A workload rebalance may help</h2>
          <p className="mt-1 text-sm text-text-muted">
            {memberNameById.get(unequalLoadSuggestion.userId) ?? 'One member'} had at least 50% more
            estimated assigned minutes than the average of available teammates in each of the last
            four full weeks ({unequalLoadSuggestion.memberMinutes.map((minutes, index) =>
              `${minutes} vs ${unequalLoadSuggestion.peerAverageMinutes[index]}`
            ).join(', ')} minutes). This is workload context, not a judgment about anyone.
          </p>
          <Link
            to="/tasks"
            className="mt-3 inline-flex min-h-11 items-center font-medium text-primary-700 underline dark:text-primary-300"
          >
            Review task assignments
          </Link>
        </Card>
      )}
      <Card>
        <ul className="divide-y divide-border">
          {displayMembers.map(({ member, workload: memberWork }) => (
            <li key={member.membership.user_id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="font-medium text-text">
                  {member.profile?.full_name?.trim() || 'Member'}
                </p>
                <p className="text-sm capitalize text-text-muted">{member.membership.role}</p>
              </div>
              <p className="text-right text-sm text-text">
                <span className="font-semibold">{memberWork.minutes} min</span>
                <span className="block text-text-muted">{memberWork.taskCount} assigned tasks</span>
              </p>
            </li>
          ))}
        </ul>
        {workload.unassignedMinutes > 0 && (
          <p className="mt-4 border-t border-border pt-3 text-sm text-text-muted">
            Unassigned work: {workload.unassignedMinutes} estimated minutes
          </p>
        )}
      </Card>
      {pendingSwaps.length > 0 && (
        <section className="space-y-3" aria-labelledby="swap-requests-heading">
          <h2 id="swap-requests-heading" className="text-heading-md font-semibold text-text">
            Swap and support requests
          </h2>
          {pendingSwaps.map(({ swap, instance }) => {
            const canRespond =
              swap.requested_to === null ||
              swap.requested_to === user?.id ||
              canManage
            const isUnable = swap.reason?.startsWith('Unable:') ?? false
            return (
              <Card key={swap.id} padding="md">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-medium text-text">
                      {isUnable ? "Can't do this" : 'Swap requested'} ·{' '}
                      {taskNameById.get(instance.task_id) ?? 'Task'}
                    </p>
                    <p className="text-sm text-text-muted">
                      {memberNameById.get(swap.requested_by) ?? 'Member'}
                      {swap.reason?.replace(/^Unable:\s*/, '').trim()
                        ? ` · ${swap.reason.replace(/^Unable:\s*/, '')}`
                        : ''}
                      {swap.requested_to
                        ? ` · Asked ${memberNameById.get(swap.requested_to) ?? 'a member'}`
                        : ' · Open to the team'}
                    </p>
                  </div>
                  {swap.requested_by === user?.id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleCancelSwap(swap.id)}
                    >
                      Cancel request
                    </Button>
                  ) : canRespond ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void handleSwapResponse(swap.id, 'accepted')}>
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleSwapResponse(swap.id, 'declined')}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Card>
            )
          })}
          {swapError && <p className="text-sm text-destructive-600" role="alert">{swapError}</p>}
        </section>
      )}
      {swaps.some(({ swap }) => swap.status !== 'pending') && (
        <details className="rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer font-medium text-text">Recent request history</summary>
          <ul className="mt-3 space-y-2">
            {swaps
              .filter(({ swap }) => swap.status !== 'pending')
              .slice(0, 10)
              .map(({ swap, instance }) => (
                <li key={swap.id} className="text-sm text-text-muted">
                  {swap.status} · {taskNameById.get(instance.task_id) ?? 'Task'} ·{' '}
                  {memberNameById.get(swap.requested_by) ?? 'Member'}
                </li>
              ))}
          </ul>
        </details>
      )}
      <p className="text-xs text-text-muted">
        Estimates include scheduled instances due this week, whether open or completed. Skipped work
        is excluded. Away periods do not count as a penalty.
      </p>
    </div>
  )
}
