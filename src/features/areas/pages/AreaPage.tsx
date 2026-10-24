import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { formatInTimeZone } from 'date-fns-tz'
import { useAuth } from '@contexts/AuthContext'
import { useNow } from '@hooks/useNow'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Badge } from '@components/ui/Badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@components/ui/Card'
import { EmptyState } from '@components/ui/EmptyState'
import { ErrorState } from '@components/ui/ErrorState'
import { Skeleton } from '@components/ui/Skeleton'
import { ConfirmModal } from '@components/ui/Modal'
import { useToastHelpers } from '@components/ui/Toast'
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarClock,
  Clock,
  FolderOpen,
  History,
  ListChecks,
  QrCode,
  RotateCcw,
} from 'lucide-react'
import type { Area, Issue, Task, TaskInstance, TaskTemplate } from '@/types/database'
import { fetchAreaTaskInstances, fetchTasksForArea } from '@features/tasks/api/tasks'
import { useTaskHistory } from '@features/tasks/hooks/useTaskHistory'
import {
  fetchAreaIssueSummaries,
  fetchOpenIssuesForArea,
  type AreaIssueSummary,
} from '@features/issues/api/issues'
import { issueCategoryLabel } from '@features/issues/api/schema'
import { IssuePriorityBadge } from '@features/issues/components/IssuePriorityBadge'
import { IssueStatusBadge } from '@features/issues/components/IssueStatusBadge'
import {
  fetchArea,
  fetchAreaTaskTemplates,
  fetchAreas,
  setAreaArchived,
  updateAreaRecord,
} from '../api/areas'
import { deriveAreaStatus } from '../lib/areaStatus'
import { areaCategoryLabel, formatFrequency } from '../lib/areaDisplay'

const OPEN_STATUSES: TaskInstance['status'][] = ['pending', 'in_progress', 'overdue']

function isOpen(instance: TaskInstance): boolean {
  return OPEN_STATUSES.includes(instance.status)
}

export function AreaPage() {
  const { areaId } = useParams<{ areaId: string }>()
  const navigate = useNavigate()
  const { currentSpace } = useAuth()
  const { showSuccess, showError } = useToastHelpers()
  const {
    entries: historyEntries,
    loading: historyLoading,
    error: historyError,
    busyIds: historyBusyIds,
    reload: reloadHistory,
    canUndo,
    canReopen,
    undoCompletion,
    reopenEntry,
  } = useTaskHistory(areaId)

  const [area, setArea] = useState<Area | null>(null)
  const [parentArea, setParentArea] = useState<Area | null>(null)
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [instances, setInstances] = useState<TaskInstance[]>([])
  const [openIssues, setOpenIssues] = useState<Issue[]>([])
  const [issueSummary, setIssueSummary] = useState<AreaIssueSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const spaceId = currentSpace?.id
  const timezone = currentSpace?.timezone ?? 'UTC'
  const now = useNow()

  const load = useCallback(async () => {
    if (!areaId || !spaceId) return
    setLoading(true)
    setError(null)
    try {
      const [
        nextArea,
        nextTemplates,
        spaceAreas,
        nextTasks,
        nextInstances,
        nextOpenIssues,
        nextIssueSummaries,
      ] = await Promise.all([
        fetchArea(areaId),
        fetchAreaTaskTemplates(areaId),
        fetchAreas(spaceId, true),
        fetchTasksForArea(areaId),
        fetchAreaTaskInstances(areaId),
        fetchOpenIssuesForArea(areaId).catch(() => [] as Issue[]),
        fetchAreaIssueSummaries(spaceId).catch(() => [] as AreaIssueSummary[]),
      ])
      if (nextArea && nextArea.space_id !== spaceId) {
        setArea(null)
        setParentArea(null)
        setTemplates([])
        setTasks([])
        setInstances([])
        setOpenIssues([])
        setIssueSummary(null)
        return
      }
      setArea(nextArea)
      setName(nextArea?.name ?? '')
      setTemplates(nextTemplates)
      setTasks(nextTasks)
      setInstances(nextInstances)
      setOpenIssues(nextOpenIssues)
      setIssueSummary(
        nextIssueSummaries.find((summary) => summary.areaId === areaId) ?? null
      )
      setParentArea(
        nextArea?.parent_area_id
          ? spaceAreas.find((candidate) => candidate.id === nextArea.parent_area_id) ?? null
          : null
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this area.')
    } finally {
      setLoading(false)
    }
  }, [areaId, spaceId])

  useEffect(() => {
    void load()
  }, [load])

  if (!currentSpace) {
    return <Navigate to="/onboarding" replace />
  }

  const handleRename = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!area) return
    const nextName = name.trim()
    if (!nextName) {
      setNameError('The area needs a name.')
      return
    }
    if (nextName === area.name) {
      setNameError(null)
      return
    }

    setNameError(null)
    setSavingName(true)
    try {
      await updateAreaRecord(area.id, { name: nextName })
      setArea({ ...area, name: nextName })
      showSuccess('Area renamed', 'The new name appears everywhere it is used.')
    } catch (renameError) {
      setNameError(
        renameError instanceof Error
          ? renameError.message
          : 'Could not rename the area. Only owners, admins, and supervisors can edit areas.'
      )
    } finally {
      setSavingName(false)
    }
  }

  const handleArchive = async () => {
    if (!area) return
    const wasActive = area.active
    setArchiving(true)
    setArea({ ...area, active: !wasActive })
    setArchiveConfirmOpen(false)
    try {
      await setAreaArchived(area.id, wasActive)
      showSuccess(
        wasActive ? 'Area archived' : 'Area restored',
        wasActive
          ? 'It is hidden from everyday lists. History is kept.'
          : 'It is visible in the space again.',
        {
          label: 'Undo',
          onClick: async () => {
            try {
              await setAreaArchived(area.id, !wasActive)
              setArea((current) => (current ? { ...current, active: wasActive } : current))
              showSuccess(wasActive ? 'Area restored' : 'Area archived')
            } catch (undoError) {
              showError(
                'Could not undo',
                undoError instanceof Error ? undoError.message : 'Try again in a moment.'
              )
            }
          },
        }
      )
    } catch (archiveError) {
      setArea((current) => (current ? { ...current, active: wasActive } : current))
      showError(
        'Could not update the area',
        archiveError instanceof Error ? archiveError.message : 'Try again in a moment.'
      )
    } finally {
      setArchiving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6" aria-label="Loading area">
        <Skeleton width="30%" />
        <Skeleton width="55%" />
        <Card>
          <Skeleton lines={3} />
        </Card>
        <Card>
          <Skeleton lines={4} />
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load this area"
        message={error}
        onRetry={() => void load()}
      />
    )
  }

  if (!area) {
    return (
      <EmptyState
        icon={<FolderOpen className="h-8 w-8" aria-hidden="true" />}
        title="Area not found"
        description="It may have been archived or belong to a different space."
        action={{ label: 'Back to areas', onClick: () => navigate('/areas') }}
        secondaryAction={{ label: 'Go to today', onClick: () => navigate('/today') }}
      />
    )
  }

  const openIssueCount = issueSummary?.openCount ?? openIssues.length
  const status = deriveAreaStatus(
    {
      active: area.active,
      timezone,
      instances,
      openIssueCount,
      recurringIssueCount: issueSummary?.recurringCount ?? 0,
    },
    now
  )
  const openInstances = instances.filter(isOpen)
  const totalMinutes = tasks.reduce((sum, task) => sum + (task.estimated_minutes ?? 0), 0)
  const openCountByTask = new Map<string, number>()
  const nextDueByTask = new Map<string, string>()
  for (const instance of openInstances) {
    openCountByTask.set(instance.task_id, (openCountByTask.get(instance.task_id) ?? 0) + 1)
    const current = nextDueByTask.get(instance.task_id)
    if (!current || new Date(instance.due_at).getTime() < new Date(current).getTime()) {
      nextDueByTask.set(instance.task_id, instance.due_at)
    }
  }
  const recentHistory = historyEntries.slice(0, 5)
  const scheduledTemplateIds = new Set(
    tasks.map((task) => task.template_id).filter((value): value is string => Boolean(value))
  )
  const unscheduledTemplates = templates.filter(
    (template) => !scheduledTemplateIds.has(template.id)
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/areas"
          className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to areas
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/tasks"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-800"
          >
            Tasks &amp; schedules
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setArchiveConfirmOpen(true)}
            loading={archiving}
            leftIcon={
              area.active ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />
            }
          >
            {area.active ? 'Archive area' : 'Restore area'}
          </Button>
          <Link
            to="/space-settings"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-800"
          >
            Space settings
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-display-sm font-semibold text-text">{area.name}</h1>
            <Badge variant={status.tone} dot title={status.reason}>
              {status.label}
            </Badge>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-text-muted">
            <Badge variant="outline">{areaCategoryLabel(area.category)}</Badge>
            {parentArea && <span>Nested under {parentArea.name}</span>}
            {currentSpace.settings?.building && <span>· {currentSpace.settings.building}</span>}
            {currentSpace.settings?.floor && <span>· {currentSpace.settings.floor}</span>}
            {currentSpace.settings?.zone && <span>· {currentSpace.settings.zone}</span>}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.tone} dot>
            {status.label}
          </Badge>
          <p className="text-sm text-text">{status.reason}</p>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Derived only from task instance records in {timezone.replace('_', ' ')}. Photos are
          optional and are never used to decide status.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card padding="md">
          <p className="text-sm text-text-muted">Scheduled tasks</p>
          <p className="mt-1 text-2xl font-bold text-text">{tasks.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-text-muted">Open now</p>
          <p className="mt-1 text-2xl font-bold text-text">{openInstances.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-text-muted">Recent completions</p>
          <p className="mt-1 text-2xl font-bold text-text">{status.recentCompletionCount}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-text-muted">Open issues</p>
          <p className="mt-1 text-2xl font-bold text-text">{openIssueCount}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-text-muted">Estimated effort</p>
          <p className="mt-1 text-2xl font-bold text-text">
            {totalMinutes > 0 ? `${totalMinutes} min` : '—'}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" aria-hidden="true" />
            <CardTitle>Open issues</CardTitle>
          </div>
          <CardDescription>
            Reports linked to this area. Each one keeps who reported it, what changed, and who is
            handling it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {openIssues.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-6 text-center">
              <p className="font-medium text-text">No open issues in this area</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
                If something needs attention, report it and the area status will show it.
              </p>
              <Link
                to={`/issues?areaId=${area.id}&report=1`}
                className="mt-3 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-800"
              >
                Report an issue
              </Link>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border" role="list">
                {openIssues.slice(0, 5).map((issue) => (
                  <li key={issue.id} className="py-3 first:pt-0 last:pb-0">
                    <Link
                      to={`/issues/${issue.id}`}
                      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <IssueStatusBadge status={issue.status} />
                        <IssuePriorityBadge priority={issue.priority} />
                        <span className="font-medium text-text group-hover:text-primary-700 dark:group-hover:text-primary-300">
                          {issue.title}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-text-muted">
                        {issueCategoryLabel(issue.category, issue.custom_category)} · Reported{' '}
                        {formatInTimeZone(new Date(issue.created_at), timezone, 'MMM d, yyyy')}
                        {issue.due_at
                          ? ` · Due ${formatInTimeZone(new Date(issue.due_at), timezone, 'MMM d, yyyy')}`
                          : ''}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={`/issues?areaId=${area.id}`}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-800"
                >
                  View all issues in this area
                </Link>
                <Link
                  to={`/issues?areaId=${area.id}&report=1`}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-800"
                >
                  Report an issue
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-text-muted" aria-hidden="true" />
                <CardTitle>Scheduled tasks</CardTitle>
              </div>
              <CardDescription>
                Recurring work in this area. Edit, pause, or add tasks in Tasks &amp; schedules.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-8 text-center">
                  <p className="font-medium text-text">Nothing scheduled here yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
                    Create schedules from your setup templates, or add a task for this area.
                  </p>
                  <Link
                    to="/tasks"
                    className="mt-3 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-800"
                  >
                    Open Tasks &amp; schedules
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-border" role="list">
                  {tasks.map((task) => {
                    const nextDue = nextDueByTask.get(task.id)
                    const openCount = openCountByTask.get(task.id) ?? 0
                    return (
                      <li
                        key={task.id}
                        className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-text">{task.name}</p>
                          {task.description && (
                            <p className="mt-0.5 text-sm text-text-muted">{task.description}</p>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                            <Badge variant="outline" size="sm">
                              {formatFrequency(
                                task.frequency,
                                task.custom_frequency_days,
                                task.is_one_off
                              )}
                            </Badge>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {task.due_time.slice(0, 5)}
                            </span>
                            {nextDue && (
                              <span className="flex items-center gap-1">
                                <CalendarClock className="h-3 w-3" aria-hidden="true" />
                                Next {formatInTimeZone(new Date(nextDue), timezone, 'MMM d, h:mm a')}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant={openCount > 0 ? 'info' : 'default'} size="sm">
                          {openCount} open
                        </Badge>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {unscheduledTemplates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Setup templates</CardTitle>
                <CardDescription>
                  {unscheduledTemplates.length} saved{' '}
                  {unscheduledTemplates.length === 1 ? 'template is' : 'templates are'} not
                  scheduled yet. Creating schedules turns them into recurring work.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border" role="list">
                  {unscheduledTemplates.map((template) => (
                    <li
                      key={template.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                    >
                      <p className="text-sm text-text">{template.name}</p>
                      <Badge variant="outline" size="sm">
                        {formatFrequency(template.frequency, template.custom_frequency_days)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-text-muted" aria-hidden="true" />
                <CardTitle>History</CardTitle>
              </div>
              <CardDescription>
                Recent completions and skips in this area. Undo is available when it is yours to
                change.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-3" aria-label="Loading area history">
                  <Skeleton width="70%" />
                  <Skeleton width="55%" />
                  <Skeleton width="65%" />
                </div>
              ) : historyError ? (
                <div className="rounded-lg border border-destructive-200 bg-destructive-50 p-3 text-sm text-destructive-800 dark:border-destructive-800 dark:bg-destructive-900/20 dark:text-destructive-200">
                  <p>{historyError}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => void reloadHistory()}
                  >
                    Try again
                  </Button>
                </div>
              ) : recentHistory.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-8 text-center">
                  <p className="font-medium text-text">No history yet</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
                    Complete or skip a scheduled task and the record will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border" role="list">
                  {recentHistory.map((entry) => {
                    const completed = entry.instance.status === 'completed'
                    const timestamp =
                      entry.completion?.completed_at ??
                      entry.instance.skipped_at ??
                      entry.instance.due_at
                    const busy = historyBusyIds.includes(entry.instance.id)
                    return (
                      <li
                        key={entry.instance.id}
                        className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text">{entry.task.name}</p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            {completed ? 'Completed' : 'Skipped'}{' '}
                            {formatInTimeZone(new Date(timestamp), timezone, 'MMM d, h:mm a')}
                            {entry.completedByName ? ` · ${entry.completedByName}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {completed && canUndo(entry) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void undoCompletion(entry)}
                              loading={busy}
                              leftIcon={<RotateCcw className="h-4 w-4" />}
                              aria-label={`Undo completion of ${entry.task.name}`}
                            >
                              Undo
                            </Button>
                          )}
                          {!completed && canReopen(entry) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void reopenEntry(entry)}
                              loading={busy}
                              leftIcon={<RotateCcw className="h-4 w-4" />}
                              aria-label={`Reopen ${entry.task.name}`}
                            >
                              Reopen
                            </Button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              <Link
                to="/history"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-300"
              >
                All history
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-text-muted" aria-hidden="true" />
                <CardTitle>QR code</CardTitle>
              </div>
              <CardDescription>Scanning a code could open this area one day.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed border-border py-8 text-center">
                <QrCode className="mx-auto h-10 w-10 text-text-muted" aria-hidden="true" />
                <p className="mt-3 font-medium text-text">QR codes are not generated yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
                  This is a placeholder. No QR check-in is claimed or available in this build.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Area details</CardTitle>
          <CardDescription>
            Renaming is immediate. Archiving keeps history and hides the area from everyday lists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRename} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
            <div className="flex-1">
              <Input
                label="Area name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setNameError(null)
                }}
                error={nameError ?? undefined}
                maxLength={60}
              />
            </div>
            <Button type="submit" loading={savingName} disabled={!name.trim() || name.trim() === area.name}>
              Save name
            </Button>
          </form>
          <p className="mt-3 text-xs text-text-muted">
            Only owners, admins, and supervisors can rename or archive areas. The database enforces
            this too.
          </p>
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={archiveConfirmOpen}
        onClose={() => setArchiveConfirmOpen(false)}
        onConfirm={() => void handleArchive()}
        title={area.active ? 'Archive this area?' : 'Restore this area?'}
        message={
          area.active
            ? 'It will be hidden from everyday lists. Its task templates and history stay in the record.'
            : 'It will be visible in this space again. Nothing else changes.'
        }
        confirmText={area.active ? 'Archive area' : 'Restore area'}
        variant={area.active ? 'destructive' : 'primary'}
        loading={archiving}
      />
    </div>
  )
}
