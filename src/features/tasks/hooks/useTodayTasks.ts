import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@contexts/AuthContext'
import { useToastHelpers } from '@components/ui/Toast'
import type { MembershipRole, TaskDependency, TaskInstance } from '@/types/database'
import { fetchAreas, fetchSpaceTaskTemplates } from '@features/areas/api/areas'
import { fetchSpaceMembers } from '@features/spaces/api/spaces'
import {
  completeTaskInstance,
  ensureInstancesForSpace,
  fetchInstancesInWindow,
  fetchMembershipRole,
  fetchOpenInstances,
  fetchTaskDependencies,
  fetchTasks,
  materializeTasksFromTemplates,
  mergeInstances,
  reopenTaskInstance,
  skipTaskInstance,
  undoTaskCompletion,
} from '../api/tasks'
import { addZonedDays, startOfZonedDay } from '../lib/recurrence'
import { isTaskManager } from '../lib/permissions'
import type { TaskInstanceView } from '../lib/taskViews'

export interface TodayTasksState {
  views: TaskInstanceView[]
  dependencies: TaskDependency[]
  role: MembershipRole | null
  taskCount: number
  templateCount: number
  loading: boolean
  error: string | null
  warning: string | null
  busyIds: string[]
  canManage: boolean
  reload: () => Promise<void>
  materializeSchedules: () => Promise<number | null>
  complete: (view: TaskInstanceView) => Promise<void>
  skip: (view: TaskInstanceView) => Promise<void>
  undoCompletion: (instanceId: string) => Promise<void>
  reopenInstance: (instanceId: string) => Promise<void>
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function useTodayTasks(): TodayTasksState {
  const { currentSpace, user } = useAuth()
  const { showSuccess, showError } = useToastHelpers()
  const [views, setViews] = useState<TaskInstanceView[]>([])
  const [dependencies, setDependencies] = useState<TaskDependency[]>([])
  const [role, setRole] = useState<MembershipRole | null>(null)
  const [taskCount, setTaskCount] = useState(0)
  const [templateCount, setTemplateCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [busyIds, setBusyIds] = useState<string[]>([])

  const replaceInstance = useCallback((updated: TaskInstance) => {
    setViews((current) =>
      current.map((view) =>
        view.instance.id === updated.id ? { ...view, instance: updated } : view
      )
    )
  }, [])

  const load = useCallback(async () => {
    if (!currentSpace || !user) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      const now = new Date()
      const todayStart = startOfZonedDay(now, currentSpace.timezone)
      const to = addZonedDays(todayStart, 14, currentSpace.timezone)
      const nextRole = await fetchMembershipRole(currentSpace.id, user.id)

      let generationWarning: string | null = null
      if (isTaskManager(nextRole)) {
        try {
          await ensureInstancesForSpace(
            currentSpace.id,
            todayStart.toISOString(),
            to.toISOString(),
            currentSpace.timezone
          )
        } catch (generationError) {
          generationWarning = messageOf(
            generationError,
            'Upcoming task instances could not be generated. Existing work is shown below.'
          )
        }
      }

      const [tasks, openInstances, windowInstances, nextDependencies, templates, areas, members] =
        await Promise.all([
          fetchTasks(currentSpace.id),
          fetchOpenInstances(currentSpace.id, to.toISOString()),
          fetchInstancesInWindow(currentSpace.id, todayStart.toISOString(), to.toISOString()),
          fetchTaskDependencies(currentSpace.id),
          fetchSpaceTaskTemplates(currentSpace.id),
          fetchAreas(currentSpace.id, true),
          fetchSpaceMembers(currentSpace.id),
        ])

      const areaNameById = new Map(areas.map((area) => [area.id, area.name]))
      const memberNameById = new Map(
        members.map((member) => [
          member.membership.user_id,
          member.profile?.full_name?.trim() || 'Member',
        ])
      )
      const taskById = new Map(tasks.map((task) => [task.id, task]))

      const nextViews = mergeInstances(openInstances, windowInstances)
        .map((instance) => {
          const task = taskById.get(instance.task_id)
          if (!task) return null
          return {
            instance,
            task,
            areaName: task.area_id ? areaNameById.get(task.area_id) ?? null : null,
            assigneeName: instance.assignee_id
              ? memberNameById.get(instance.assignee_id) ?? 'Member'
              : null,
          }
        })
        .filter((view): view is TaskInstanceView => view !== null)
        .sort(
          (a, b) => new Date(a.instance.due_at).getTime() - new Date(b.instance.due_at).getTime()
        )

      setViews(nextViews)
      setDependencies(nextDependencies)
      setRole(nextRole)
      setTaskCount(tasks.length)
      setTemplateCount(templates.length)
      setWarning(generationWarning)
    } catch (loadError) {
      setError(messageOf(loadError, 'Could not load today.'))
    } finally {
      setLoading(false)
    }
  }, [currentSpace, user])

  useEffect(() => {
    void load()
  }, [load])

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((current) =>
      busy ? [...new Set([...current, id])] : current.filter((value) => value !== id)
    )
  }, [])

  const undoCompletion = useCallback(
    async (instanceId: string) => {
      setBusy(instanceId, true)
      try {
        const updated = await undoTaskCompletion(instanceId)
        replaceInstance(updated)
        showSuccess('Completion undone', 'The task is open again. Nothing else changed.')
      } catch (undoError) {
        showError('Could not undo the completion', messageOf(undoError, 'Try again in a moment.'))
      } finally {
        setBusy(instanceId, false)
      }
    },
    [replaceInstance, setBusy, showError, showSuccess]
  )

  const complete = useCallback(
    async (view: TaskInstanceView) => {
      const instanceId = view.instance.id
      setBusy(instanceId, true)
      replaceInstance({
        ...view.instance,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })

      try {
        const updated = await completeTaskInstance(instanceId)
        replaceInstance(updated)
        showSuccess('Task completed', `${view.task.name} is recorded in history.`, {
          label: 'Undo',
          onClick: () => {
            void undoCompletion(instanceId)
          },
        })
      } catch (completeError) {
        replaceInstance(view.instance)
        showError(
          'Could not complete the task',
          messageOf(completeError, 'Check your connection and try again.')
        )
      } finally {
        setBusy(instanceId, false)
      }
    },
    [replaceInstance, setBusy, showError, showSuccess, undoCompletion]
  )

  const reopenInstance = useCallback(
    async (instanceId: string) => {
      setBusy(instanceId, true)
      try {
        const updated = await reopenTaskInstance(instanceId)
        replaceInstance(updated)
        showSuccess('Task reopened', 'It is back in your open work.')
      } catch (reopenError) {
        showError('Could not reopen the task', messageOf(reopenError, 'Try again in a moment.'))
      } finally {
        setBusy(instanceId, false)
      }
    },
    [replaceInstance, setBusy, showError, showSuccess]
  )

  const skip = useCallback(
    async (view: TaskInstanceView) => {
      const instanceId = view.instance.id
      setBusy(instanceId, true)
      replaceInstance({
        ...view.instance,
        status: 'skipped',
        skipped_at: new Date().toISOString(),
      })

      try {
        const updated = await skipTaskInstance(instanceId)
        replaceInstance(updated)
        showSuccess('Task skipped', 'It stays in history, without a completion.', {
          label: 'Undo',
          onClick: () => {
            void reopenInstance(instanceId)
          },
        })
      } catch (skipError) {
        replaceInstance(view.instance)
        showError('Could not skip the task', messageOf(skipError, 'Try again in a moment.'))
      } finally {
        setBusy(instanceId, false)
      }
    },
    [replaceInstance, reopenInstance, setBusy, showError, showSuccess]
  )

  const materializeSchedules = useCallback(async (): Promise<number | null> => {
    if (!currentSpace || !user) return null
    setBusy('materialize', true)
    try {
      const created = await materializeTasksFromTemplates(currentSpace.id, user.id)
      await load()
      if (created === 0) {
        showSuccess('Schedules are already set up', 'There are no new templates to schedule.')
      } else {
        showSuccess(
          'Schedules created',
          `${created} ${created === 1 ? 'routine is' : 'routines are'} ready. You can edit them in Tasks.`
        )
      }
      return created
    } catch (materializeError) {
      showError(
        'Could not create schedules',
        messageOf(
          materializeError,
          'Only owners, admins, and supervisors can create schedules.'
        )
      )
      return null
    } finally {
      setBusy('materialize', false)
    }
  }, [currentSpace, load, setBusy, showError, showSuccess, user])

  return {
    views,
    dependencies,
    role,
    taskCount,
    templateCount,
    loading,
    error,
    warning,
    busyIds,
    canManage: isTaskManager(role),
    reload: load,
    materializeSchedules,
    complete,
    skip,
    undoCompletion,
    reopenInstance,
  }
}
