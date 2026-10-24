import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@contexts/AuthContext'
import { useToastHelpers } from '@components/ui/Toast'
import type { MembershipRole } from '@/types/database'
import {
  completeTaskInstance,
  fetchAreaHistory,
  fetchMembershipRole,
  fetchTaskHistory,
  reopenTaskInstance,
  undoTaskCompletion,
  type TaskHistoryEntry,
} from '../api/tasks'
import { isTaskManager } from '../lib/permissions'
import { canCompleteInstance } from '../lib/taskViews'

export interface TaskHistoryState {
  entries: TaskHistoryEntry[]
  role: MembershipRole | null
  loading: boolean
  error: string | null
  busyIds: string[]
  reload: () => Promise<void>
  canUndo: (entry: TaskHistoryEntry) => boolean
  canReopen: (entry: TaskHistoryEntry) => boolean
  undoCompletion: (entry: TaskHistoryEntry) => Promise<void>
  reopenEntry: (entry: TaskHistoryEntry) => Promise<void>
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function useTaskHistory(areaId?: string): TaskHistoryState {
  const { currentSpace, user } = useAuth()
  const { showSuccess, showError } = useToastHelpers()
  const [entries, setEntries] = useState<TaskHistoryEntry[]>([])
  const [role, setRole] = useState<MembershipRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyIds, setBusyIds] = useState<string[]>([])

  const load = useCallback(async () => {
    if (!currentSpace || !user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const nextRole = await fetchMembershipRole(currentSpace.id, user.id)
      const nextEntries = areaId
        ? await fetchAreaHistory(currentSpace.id, areaId, 100)
        : await fetchTaskHistory(currentSpace.id, { limit: 100 })
      setRole(nextRole)
      setEntries(nextEntries)
    } catch (loadError) {
      setError(messageOf(loadError, 'Could not load task history.'))
    } finally {
      setLoading(false)
    }
  }, [areaId, currentSpace, user])

  useEffect(() => {
    void load()
  }, [load])

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((current) =>
      busy ? [...new Set([...current, id])] : current.filter((value) => value !== id)
    )
  }, [])

  const canUndo = useCallback(
    (entry: TaskHistoryEntry): boolean => {
      if (entry.instance.status !== 'completed' || !entry.completion) return false
      if (isTaskManager(role)) return true
      return Boolean(user && entry.completion.user_id === user.id)
    },
    [role, user]
  )

  const canReopen = useCallback(
    (entry: TaskHistoryEntry): boolean =>
      entry.instance.status === 'skipped' && canCompleteInstance(role, user?.id ?? null, entry.instance),
    [role, user]
  )

  const undoCompletion = useCallback(
    async (entry: TaskHistoryEntry) => {
      const instanceId = entry.instance.id
      setBusy(instanceId, true)
      try {
        await undoTaskCompletion(instanceId)
        setEntries((current) => current.filter((item) => item.instance.id !== instanceId))
        showSuccess('Completion undone', `${entry.task.name} is open again.`, {
          label: 'Complete again',
          onClick: () => {
            void (async () => {
              try {
                await completeTaskInstance(instanceId)
                await load()
                showSuccess('Task completed again')
              } catch (completeError) {
                showError(
                  'Could not complete the task',
                  messageOf(completeError, 'Open Today and complete it there.')
                )
              }
            })()
          },
        })
      } catch (undoError) {
        showError('Could not undo the completion', messageOf(undoError, 'Try again in a moment.'))
      } finally {
        setBusy(instanceId, false)
      }
    },
    [load, setBusy, showError, showSuccess]
  )

  const reopenEntry = useCallback(
    async (entry: TaskHistoryEntry) => {
      const instanceId = entry.instance.id
      setBusy(instanceId, true)
      try {
        await reopenTaskInstance(instanceId)
        setEntries((current) => current.filter((item) => item.instance.id !== instanceId))
        showSuccess('Task reopened', `${entry.task.name} is back in open work.`)
      } catch (reopenError) {
        showError('Could not reopen the task', messageOf(reopenError, 'Try again in a moment.'))
      } finally {
        setBusy(instanceId, false)
      }
    },
    [setBusy, showError, showSuccess]
  )

  return {
    entries,
    role,
    loading,
    error,
    busyIds,
    reload: load,
    canUndo,
    canReopen,
    undoCompletion,
    reopenEntry,
  }
}
