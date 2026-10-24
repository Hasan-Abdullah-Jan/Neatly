import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatInTimeZone } from 'date-fns-tz'
import { useAuth } from '@contexts/AuthContext'
import { useNow } from '@hooks/useNow'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { EmptyState } from '@components/ui/EmptyState'
import { ErrorState } from '@components/ui/ErrorState'
import { ConfirmModal } from '@components/ui/Modal'
import { Skeleton } from '@components/ui/Skeleton'
import {
  CalendarClock,
  ClipboardList,
  Link2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import type { Task, TaskInstance } from '@/types/database'
import { formatFrequency } from '@features/areas/lib/areaDisplay'
import { TaskForm } from '../components/TaskForm'
import { useTaskSchedules } from '../hooks/useTaskSchedules'
import { zonedDateKey } from '../lib/recurrence'
import type { TaskInput } from '../api/schema'

const OPEN_STATUSES: TaskInstance['status'][] = ['pending', 'in_progress', 'overdue']

function isOpen(instance: TaskInstance): boolean {
  return OPEN_STATUSES.includes(instance.status)
}

function minutesLabel(minutes: number | null): string {
  return minutes ? `${minutes} min` : 'No estimate'
}

export function TasksPage() {
  const { currentSpace } = useAuth()
  const navigate = useNavigate()
  const {
    tasks,
    areas,
    members,
    dependencies,
    templates,
    instances,
    loading,
    error,
    warning,
    busyIds,
    canManage,
    reload,
    createTask,
    updateTask,
    toggleActive,
    deleteTask,
    materializeSchedules,
    generateUpcoming,
    startFresh,
  } = useTaskSchedules()

  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [freshConfirmOpen, setFreshConfirmOpen] = useState(false)

  const now = useNow()
  const timezone = currentSpace?.timezone ?? 'UTC'

  const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas])
  const memberNameById = useMemo(
    () =>
      new Map(
        members.map((member) => [
          member.membership.user_id,
          member.profile?.full_name?.trim() || 'Member',
        ])
      ),
    [members]
  )
  const taskNameById = useMemo(() => new Map(tasks.map((task) => [task.id, task.name])), [tasks])
  const templatesMissingSchedules = useMemo(() => {
    const scheduledTemplateIds = new Set(
      tasks.map((task) => task.template_id).filter((value): value is string => Boolean(value))
    )
    return templates.filter((template) => !scheduledTemplateIds.has(template.id))
  }, [tasks, templates])

  const instancesByTask = useMemo(() => {
    const grouped = new Map<string, TaskInstance[]>()
    for (const instance of instances) {
      const list = grouped.get(instance.task_id) ?? []
      list.push(instance)
      grouped.set(instance.task_id, list)
    }
    return grouped
  }, [instances])

  const openCount = instances.filter(isOpen).length
  const dueTodayCount = instances.filter(
    (instance) =>
      isOpen(instance) && zonedDateKey(instance.due_at, timezone) === zonedDateKey(now, timezone)
  ).length
  const pausedCount = tasks.filter((task) => !task.is_active).length

  const groupedTasks = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; sortOrder: number; tasks: Task[] }
    >()
    for (const task of tasks) {
      const area = task.area_id ? areaById.get(task.area_id) : null
      const key = area?.id ?? 'no-area'
      const group = groups.get(key) ?? {
        key,
        label: area?.name ?? 'No area',
        sortOrder: area?.sort_order ?? Number.MAX_SAFE_INTEGER,
        tasks: [],
      }
      group.tasks.push(task)
      groups.set(key, group)
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        tasks: group.tasks
          .slice()
          .sort(
            (a, b) =>
              Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name)
          ),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
  }, [areaById, tasks])

  if (!currentSpace) return null

  const openForm = (task: Task | null) => {
    setEditingTask(task)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingTask(null)
  }

  const handleSubmit = async (input: TaskInput): Promise<boolean> => {
    if (editingTask) {
      const updated = await updateTask(editingTask.id, input)
      return updated !== null
    }
    const created = await createTask(input)
    return created !== null
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    await deleteTask(target)
  }

  const formSubmitting = busyIds.includes(editingTask?.id ?? 'form')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-display-sm font-semibold text-text">Tasks &amp; schedules</h1>
          <p className="mt-1 max-w-2xl text-text-muted">
            Recurring routines for each area. Edits never rewrite completed history, and a paused
            task stops creating new instances.
          </p>
          <p className="mt-1 text-sm text-text-muted" data-space-timezone={timezone}>
            Due times use {timezone.replace('_', ' ')}. Status comes from task records only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void generateUpcoming()}
              loading={busyIds.includes('generate')}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh schedule
            </Button>
          )}
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFreshConfirmOpen(true)}
              loading={busyIds.includes('fresh')}
              leftIcon={<RotateCcw className="h-4 w-4" />}
            >
              Start fresh
            </Button>
          )}
          {canManage && (
            <Button onClick={() => openForm(null)} leftIcon={<Plus className="h-4 w-4" />}>
              New task
            </Button>
          )}
        </div>
      </div>

      {!canManage && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-muted">
          You can view schedules and complete work. Only owners, admins, and supervisors can create,
          edit, pause, or remove tasks.
        </div>
      )}

      {warning && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
          role="status"
        >
          {warning}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Card padding="sm">
            <p className="text-xs text-text-muted">Active tasks</p>
            <p className="mt-1 text-2xl font-bold text-text">{tasks.length - pausedCount}</p>
          </Card>
          <Card padding="sm">
            <p className="text-xs text-text-muted">Open instances</p>
            <p className="mt-1 text-2xl font-bold text-text">{openCount}</p>
          </Card>
          <Card padding="sm">
            <p className="text-xs text-text-muted">Due today</p>
            <p className="mt-1 text-2xl font-bold text-text">{dueTodayCount}</p>
          </Card>
          <Card padding="sm">
            <p className="text-xs text-text-muted">Paused</p>
            <p className="mt-1 text-2xl font-bold text-text">{pausedCount}</p>
          </Card>
        </div>
      )}

      {templatesMissingSchedules.length > 0 && canManage && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary-200 bg-primary-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-primary-800 dark:bg-primary-900/20">
          <div className="flex items-start gap-3">
            <Sparkles
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600 dark:text-primary-300"
              aria-hidden="true"
            />
            <div>
              <p className="font-medium text-primary-900 dark:text-primary-100">
                {templatesMissingSchedules.length} setup{' '}
                {templatesMissingSchedules.length === 1 ? 'template is' : 'templates are'} not
                scheduled yet
              </p>
              <p className="mt-0.5 text-sm text-primary-800 dark:text-primary-200">
                Creating schedules turns each template into a recurring task and fills the next 30
                days.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void materializeSchedules()}
            loading={busyIds.includes('materialize')}
            className="flex-shrink-0"
          >
            Create schedules
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-label="Loading task schedules">
          {[0, 1, 2, 3].map((key) => (
            <Card key={key}>
              <Skeleton width="35%" />
              <div className="mt-3">
                <Skeleton width="55%" />
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load task schedules"
          message={error}
          onRetry={() => void reload()}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" aria-hidden="true" />}
          title="No scheduled tasks yet"
          description={
            templates.length > 0
              ? 'Your setup saved task templates. Create schedules to turn them into recurring work.'
              : 'Create a task to start a recurring routine. You choose the area, repeat pattern, and due time.'
          }
          action={
            canManage
              ? templates.length > 0
                ? {
                    label: 'Create schedules',
                    onClick: () => void materializeSchedules(),
                  }
                : { label: 'Create your first task', onClick: () => openForm(null) }
              : undefined
          }
          secondaryAction={{ label: 'Open areas', onClick: () => navigate('/areas') }}
        />
      ) : (
        <div className="space-y-6">
          {groupedTasks.map((group) => (
            <section key={group.key} aria-labelledby={`group-${group.key}`}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2
                  id={`group-${group.key}`}
                  className="text-heading-sm font-semibold text-text"
                >
                  {group.label}
                </h2>
                <Link
                  to="/areas"
                  className="text-xs font-medium text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  Area overview
                </Link>
              </div>
              <div className="space-y-2">
                {group.tasks.map((task) => {
                  const taskInstances = instancesByTask.get(task.id) ?? []
                  const open = taskInstances.filter(isOpen)
                  const nextDue = open[0]?.due_at ?? null
                  const prerequisites = dependencies
                    .filter((dependency) => dependency.task_id === task.id && !dependency.deleted_at)
                    .map((dependency) => taskNameById.get(dependency.depends_on_task_id))
                    .filter((name): name is string => Boolean(name))
                  const assignee = task.assignee_id
                    ? memberNameById.get(task.assignee_id) ?? 'Member'
                    : 'Anyone'
                  const area = task.area_id ? areaById.get(task.area_id) : null
                  const busy = busyIds.includes(task.id)

                  return (
                    <Card key={task.id} padding="md" className={!task.is_active ? 'opacity-70' : undefined}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium text-text">{task.name}</h3>
                            <Badge variant={task.is_active ? 'primary' : 'default'} size="sm">
                              {task.is_active ? 'Active' : 'Paused'}
                            </Badge>
                            <Badge variant="outline" size="sm">
                              {formatFrequency(
                                task.frequency,
                                task.custom_frequency_days,
                                task.is_one_off
                              )}
                            </Badge>
                            <Badge variant="outline" size="sm">
                              <CalendarClock className="h-3 w-3" aria-hidden="true" />
                              {task.due_time.slice(0, 5)}
                            </Badge>
                          </div>

                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                            <span>{area?.name ?? 'No area'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{assignee === 'Anyone' ? 'Anyone can pick this up' : assignee}</span>
                            <span aria-hidden="true">·</span>
                            <span>{minutesLabel(task.estimated_minutes)}</span>
                            {taskInstances.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {open.length} open{' '}
                                  {open.length === 1 ? 'instance' : 'instances'}
                                </span>
                              </>
                            )}
                          </p>

                          {task.description && (
                            <p className="mt-2 text-sm text-text-muted">{task.description}</p>
                          )}

                          {nextDue && (
                            <p className="mt-2 text-sm text-text-muted">
                              Next due {formatInTimeZone(new Date(nextDue), timezone, 'EEE, MMM d')}{' '}
                              at {formatInTimeZone(new Date(nextDue), timezone, 'h:mm a')}
                            </p>
                          )}

                          {prerequisites.length > 0 && (
                            <p className="mt-2 flex items-start gap-1.5 text-xs text-text-muted">
                              <Link2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                              <span>Waiting on {prerequisites.join(', ')}</span>
                            </p>
                          )}
                        </div>

                        {canManage && (
                          <div className="flex flex-shrink-0 flex-wrap items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openForm(task)}
                              disabled={busy}
                              aria-label={`Edit ${task.name}`}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void toggleActive(task, !task.is_active)}
                              disabled={busy}
                              loading={busy}
                              aria-label={
                                task.is_active ? `Pause ${task.name}` : `Resume ${task.name}`
                              }
                              leftIcon={
                                task.is_active ? (
                                  <Pause className="h-4 w-4" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )
                              }
                            >
                              {task.is_active ? 'Pause' : 'Resume'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(task)}
                              disabled={busy}
                              aria-label={`Remove ${task.name}`}
                              className="text-destructive-600 hover:text-destructive-700 dark:text-destructive-400"
                              leftIcon={<Trash2 className="h-4 w-4" />}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-text-muted">
        <p>
          Completing a task records one completion. Undo is available from Today and History.
        </p>
        <Link
          to="/history"
          className="font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-300"
        >
          View history
        </Link>
      </div>

      {formOpen && (
        <TaskForm
          key={editingTask?.id ?? 'new-task'}
          isOpen={formOpen}
          task={editingTask}
          areas={areas}
          members={members}
          tasks={tasks}
          dependencies={dependencies}
          submitting={formSubmitting}
          onClose={closeForm}
          onSubmit={handleSubmit}
        />
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title={deleteTarget ? `Remove ${deleteTarget.name}?` : 'Remove task?'}
        message="Open instances for this task are cleared. Completed and skipped history is kept, and you can undo the removal for a moment."
        confirmText="Remove task"
        variant="destructive"
        loading={deleteTarget ? busyIds.includes(deleteTarget.id) : false}
      />

      <ConfirmModal
        isOpen={freshConfirmOpen}
        onClose={() => setFreshConfirmOpen(false)}
        onConfirm={() => {
          setFreshConfirmOpen(false)
          void startFresh()
        }}
        title="Start fresh?"
        message="This clears only open scheduled work. Completed and skipped history stays, task settings are kept, and new instances begin from now."
        confirmText="Start fresh"
        variant="destructive"
        loading={busyIds.includes('fresh')}
      />
    </div>
  )
}
