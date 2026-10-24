import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@contexts/AuthContext'
import { useToastHelpers } from '@components/ui/Toast'
import type {
  Area,
  MembershipRole,
  Task,
  TaskDependency,
  TaskInstance,
  TaskTemplate,
} from '@/types/database'
import { fetchAreas, fetchSpaceTaskTemplates } from '@features/areas/api/areas'
import { fetchSpaceMembers, type SpaceMember } from '@features/spaces/api/spaces'
import {
  createTaskRecord,
  ensureInstancesForSpace,
  fetchInstancesInWindow,
  fetchMembershipRole,
  fetchOpenInstances,
  fetchTaskDependencies,
  fetchTasks,
  freshStartSpace,
  materializeTasksFromTemplates,
  mergeInstances,
  setTaskActive,
  setTaskDeleted,
  updateTaskRecord,
} from '../api/tasks'
import { firstTaskIssue, taskInputSchema, type TaskInput } from '../api/schema'
import { addZonedDays, startOfZonedDay } from '../lib/recurrence'
import { isTaskManager } from '../lib/permissions'

export interface TaskSchedulesState {
  tasks: Task[]
  areas: Area[]
  members: SpaceMember[]
  dependencies: TaskDependency[]
  templates: TaskTemplate[]
  instances: TaskInstance[]
  role: MembershipRole | null
  loading: boolean
  error: string | null
  warning: string | null
  busyIds: string[]
  canManage: boolean
  reload: () => Promise<void>
  createTask: (input: TaskInput) => Promise<Task | null>
  updateTask: (taskId: string, input: TaskInput) => Promise<Task | null>
  toggleActive: (task: Task, active: boolean) => Promise<void>
  deleteTask: (task: Task) => Promise<void>
  materializeSchedules: () => Promise<number | null>
  generateUpcoming: () => Promise<void>
  startFresh: () => Promise<number | null>
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function useTaskSchedules(): TaskSchedulesState {
  const { currentSpace, user } = useAuth()
  const { showSuccess, showError } = useToastHelpers()
  const [tasks, setTasks] = useState<Task[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [members, setMembers] = useState<SpaceMember[]>([])
  const [dependencies, setDependencies] = useState<TaskDependency[]>([])
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [instances, setInstances] = useState<TaskInstance[]>([])
  const [role, setRole] = useState<MembershipRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [busyIds, setBusyIds] = useState<string[]>([])

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((current) =>
      busy ? [...new Set([...current, id])] : current.filter((value) => value !== id)
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
      const from = addZonedDays(todayStart, -7, currentSpace.timezone)
      const to = addZonedDays(todayStart, 30, currentSpace.timezone)
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
            'Upcoming instances could not be generated. Schedules are still shown.'
          )
        }
      }

      const [
        nextTasks,
        nextAreas,
        nextMembers,
        nextDependencies,
        nextTemplates,
        nextInstances,
        nextOpenInstances,
      ] = await Promise.all([
        fetchTasks(currentSpace.id, true),
        fetchAreas(currentSpace.id, true),
        fetchSpaceMembers(currentSpace.id),
        fetchTaskDependencies(currentSpace.id),
        fetchSpaceTaskTemplates(currentSpace.id),
        fetchInstancesInWindow(currentSpace.id, from.toISOString(), to.toISOString(), 1000),
        fetchOpenInstances(currentSpace.id, to.toISOString()),
      ])

      setTasks(nextTasks)
      setAreas(nextAreas)
      setMembers(nextMembers)
      setDependencies(nextDependencies)
      setTemplates(nextTemplates)
      setInstances(mergeInstances(nextOpenInstances, nextInstances))
      setRole(nextRole)
      setWarning(generationWarning)
    } catch (loadError) {
      setError(messageOf(loadError, 'Could not load your task schedules.'))
    } finally {
      setLoading(false)
    }
  }, [currentSpace, user])

  useEffect(() => {
    void load()
  }, [load])

  const createTask = useCallback(
    async (input: TaskInput): Promise<Task | null> => {
      if (!currentSpace || !user) return null
      const parsed = taskInputSchema.safeParse(input)
      if (!parsed.success) {
        showError('Check the task details', firstTaskIssue(parsed.error))
        return null
      }

      setBusy('form', true)
      try {
        const created = await createTaskRecord(currentSpace.id, user.id, parsed.data)
        let generationFailed = false
        try {
          await ensureInstancesForSpace(
            currentSpace.id,
            new Date().toISOString(),
            addZonedDays(
              startOfZonedDay(new Date(), currentSpace.timezone),
              30,
              currentSpace.timezone
            ).toISOString(),
            currentSpace.timezone
          )
        } catch {
          generationFailed = true
        }

        setTasks((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))
        showSuccess(
          'Task created',
          generationFailed
            ? `${created.name} was created. Use Refresh schedule to fill upcoming dates.`
            : `${created.name} will start appearing on Today.`,
          {
            label: 'Undo',
            onClick: () => {
              void (async () => {
                try {
                  await setTaskDeleted(created.id, true)
                  setTasks((current) => current.filter((task) => task.id !== created.id))
                  showSuccess('Task removed', 'Its future instances were cleared.')
                } catch (undoError) {
                  showError('Could not undo', messageOf(undoError, 'Remove it from the task list.'))
                }
              })()
            },
          }
        )
        await load()
        return created
      } catch (createError) {
        showError(
          'Could not create the task',
          messageOf(
            createError,
            'Only owners, admins, and supervisors can create tasks.'
          )
        )
        return null
      } finally {
        setBusy('form', false)
      }
    },
    [currentSpace, load, setBusy, showError, showSuccess, user]
  )

  const updateTask = useCallback(
    async (taskId: string, input: TaskInput): Promise<Task | null> => {
      if (!currentSpace || !user) return null
      const parsed = taskInputSchema.safeParse(input)
      if (!parsed.success) {
        showError('Check the task details', firstTaskIssue(parsed.error))
        return null
      }

      const previous = tasks.find((task) => task.id === taskId)
      if (!previous) return null

      const optimistic: Task = {
        ...previous,
        area_id: parsed.data.areaId,
        name: parsed.data.name,
        description: parsed.data.description,
        estimated_minutes: parsed.data.estimatedMinutes,
        frequency: parsed.data.frequency,
        custom_frequency_days:
          parsed.data.frequency === 'custom' ? parsed.data.customFrequencyDays : null,
        due_time: parsed.data.dueTime,
        assignee_id: parsed.data.assigneeId,
      }

      setBusy(taskId, true)
      setTasks((current) => current.map((task) => (task.id === taskId ? optimistic : task)))

      try {
        const updated = await updateTaskRecord(currentSpace.id, taskId, user.id, parsed.data)
        setTasks((current) =>
          current.map((task) => (task.id === taskId ? updated : task))
        )
        showSuccess('Task updated', `${updated.name} keeps its completion history.`)
        await load()
        return updated
      } catch (updateError) {
        setTasks((current) => current.map((task) => (task.id === taskId ? previous : task)))
        showError('Could not update the task', messageOf(updateError, 'Try again in a moment.'))
        return null
      } finally {
        setBusy(taskId, false)
      }
    },
    [currentSpace, load, setBusy, showError, showSuccess, tasks, user]
  )

  const toggleActive = useCallback(
    async (task: Task, active: boolean) => {
      setBusy(task.id, true)
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? { ...item, is_active: active } : item))
      )
      try {
        await setTaskActive(task.id, active)
        showSuccess(
          active ? 'Task resumed' : 'Task paused',
          active
            ? `${task.name} will appear in upcoming schedules again.`
            : `${task.name} is hidden from Today. History is kept.`
        )
        await load()
      } catch (toggleError) {
        setTasks((current) =>
          current.map((item) => (item.id === task.id ? { ...item, is_active: !active } : item))
        )
        showError('Could not update the task', messageOf(toggleError, 'Try again in a moment.'))
      } finally {
        setBusy(task.id, false)
      }
    },
    [load, setBusy, showError, showSuccess]
  )

  const deleteTask = useCallback(
    async (task: Task) => {
      setBusy(task.id, true)
      setTasks((current) => current.filter((item) => item.id !== task.id))
      try {
        await setTaskDeleted(task.id, true)
        showSuccess('Task removed', `${task.name} and its open instances were cleared.`, {
          label: 'Undo',
          onClick: () => {
            void (async () => {
              try {
                await setTaskDeleted(task.id, false)
                await load()
                showSuccess('Task restored', `${task.name} is back.`)
              } catch (undoError) {
                showError('Could not undo', messageOf(undoError, 'Recreate the task instead.'))
              }
            })()
          },
        })
      } catch (deleteError) {
        setTasks((current) => [...current, task].sort((a, b) => a.name.localeCompare(b.name)))
        showError('Could not remove the task', messageOf(deleteError, 'Try again in a moment.'))
      } finally {
        setBusy(task.id, false)
      }
    },
    [load, setBusy, showError, showSuccess]
  )

  const materializeSchedules = useCallback(async (): Promise<number | null> => {
    if (!currentSpace || !user) return null
    setBusy('materialize', true)
    try {
      const created = await materializeTasksFromTemplates(currentSpace.id, user.id)
      await load()
      if (created === 0) {
        showSuccess('Schedules are already set up', 'Every template already has a task.')
      } else {
        showSuccess(
          'Schedules created',
          `${created} ${created === 1 ? 'routine is' : 'routines are'} ready to edit.`
        )
      }
      return created
    } catch (materializeError) {
      showError(
        'Could not create schedules',
        messageOf(materializeError, 'Only owners, admins, and supervisors can do this.')
      )
      return null
    } finally {
      setBusy('materialize', false)
    }
  }, [currentSpace, load, setBusy, showError, showSuccess, user])

  const generateUpcoming = useCallback(async () => {
    if (!currentSpace) return
    setBusy('generate', true)
    try {
      const now = new Date()
      const from = startOfZonedDay(now, currentSpace.timezone)
      const to = addZonedDays(from, 30, currentSpace.timezone)
      const count = await ensureInstancesForSpace(
        currentSpace.id,
        from.toISOString(),
        to.toISOString(),
        currentSpace.timezone
      )
      await load()
      showSuccess(
        'Upcoming schedule refreshed',
        count === 0 ? 'Everything was already generated.' : `${count} new instances added.`
      )
    } catch (generateError) {
      showError(
        'Could not generate instances',
        messageOf(generateError, 'Only owners, admins, and supervisors can do this.')
      )
    } finally {
      setBusy('generate', false)
    }
  }, [currentSpace, load, setBusy, showError, showSuccess])

  const startFresh = useCallback(async (): Promise<number | null> => {
    if (!currentSpace) return null
    setBusy('fresh', true)
    try {
      const removed = await freshStartSpace(currentSpace.id)
      await load()
      showSuccess(
        'Fresh start complete',
        `${removed} open ${removed === 1 ? 'instance was' : 'instances were'} cleared. Completed and skipped history is kept.`
      )
      return removed
    } catch (freshError) {
      showError(
        'Could not start fresh',
        messageOf(freshError, 'Only owners, admins, and supervisors can do this.')
      )
      return null
    } finally {
      setBusy('fresh', false)
    }
  }, [currentSpace, load, setBusy, showError, showSuccess])

  return {
    tasks,
    areas,
    members,
    dependencies,
    templates,
    instances,
    role,
    loading,
    error,
    warning,
    busyIds,
    canManage: isTaskManager(role),
    reload: load,
    createTask,
    updateTask,
    toggleActive,
    deleteTask,
    materializeSchedules,
    generateUpcoming,
    startFresh,
  }
}
