import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'
import { useNow } from '@hooks/useNow'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Badge } from '@components/ui/Badge'
import { Card, CardContent } from '@components/ui/Card'
import { EmptyState } from '@components/ui/EmptyState'
import { ErrorState } from '@components/ui/ErrorState'
import { Skeleton } from '@components/ui/Skeleton'
import { useToastHelpers } from '@components/ui/Toast'
import {
  ArrowRight,
  Archive,
  FolderOpen,
  LayoutGrid,
  Plus,
  Settings,
} from 'lucide-react'
import type { Area, Task, TaskInstance, TaskTemplate } from '@/types/database'
import { fetchTasks, fetchStatusInstances } from '@features/tasks/api/tasks'
import {
  fetchAreaIssueSummaries,
  type AreaIssueSummary,
} from '@features/issues/api/issues'
import {
  createAreaRecord,
  deleteAreaRecord,
  fetchAreas,
  fetchSpaceTaskTemplates,
} from '../api/areas'
import { deriveAreaStatus, instancesForArea } from '../lib/areaStatus'
import { areaCategoryLabel } from '../lib/areaDisplay'

const categoryOptions = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'living', label: 'Living area' },
  { value: 'dining', label: 'Dining' },
  { value: 'office', label: 'Office' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'entry', label: 'Entryway' },
  { value: 'hallway', label: 'Hallway' },
  { value: 'storage', label: 'Storage' },
  { value: 'garden', label: 'Garden / yard' },
  { value: 'reception', label: 'Reception' },
  { value: 'meeting', label: 'Meeting room' },
  { value: 'waiting', label: 'Waiting room' },
  { value: 'exam', label: 'Exam room' },
  { value: 'classroom', label: 'Classroom' },
  { value: 'common', label: 'Common area' },
  { value: 'custom', label: 'Custom' },
]

/** Setup-level grouping only. Operational status is derived from task records. */
function sortAreas(areas: Area[]): Area[] {
  return areas
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

export function AreasPage() {
  const { currentSpace } = useAuth()
  const { showSuccess, showError } = useToastHelpers()
  const [areas, setAreas] = useState<Area[]>([])
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [instances, setInstances] = useState<TaskInstance[]>([])
  const [issueSummaries, setIssueSummaries] = useState<AreaIssueSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('custom')
  const [newParentId, setNewParentId] = useState('')
  const [newNameError, setNewNameError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const spaceId = currentSpace?.id
  const timezone = currentSpace?.timezone ?? 'UTC'
  const now = useNow()

  const load = useCallback(async () => {
    if (!spaceId) return
    setLoading(true)
    setError(null)
    try {
      const [nextAreas, nextTemplates, nextTasks, nextInstances, nextIssueSummaries] =
        await Promise.all([
          fetchAreas(spaceId, true),
          fetchSpaceTaskTemplates(spaceId),
          fetchTasks(spaceId, true),
          fetchStatusInstances(spaceId, timezone),
          fetchAreaIssueSummaries(spaceId).catch(() => [] as AreaIssueSummary[]),
        ])
      setAreas(nextAreas)
      setTemplates(nextTemplates)
      setTasks(nextTasks)
      setInstances(nextInstances)
      setIssueSummaries(nextIssueSummaries)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load areas.')
    } finally {
      setLoading(false)
    }
  }, [spaceId, timezone])

  useEffect(() => {
    void load()
  }, [load])

  const activeAreas = useMemo(() => sortAreas(areas.filter((area) => area.active)), [areas])
  const archivedAreas = useMemo(
    () => sortAreas(areas.filter((area) => !area.active)),
    [areas]
  )

  const taskCountByArea = useMemo(() => {
    const counts = new Map<string, number>()
    for (const task of tasks) {
      if (!task.area_id) continue
      counts.set(task.area_id, (counts.get(task.area_id) ?? 0) + 1)
    }
    return counts
  }, [tasks])

  const templateCountByArea = useMemo(() => {
    const counts = new Map<string, number>()
    for (const template of templates) {
      if (!template.area_id) continue
      counts.set(template.area_id, (counts.get(template.area_id) ?? 0) + 1)
    }
    return counts
  }, [templates])

  const issueSummaryByArea = useMemo(
    () => new Map(issueSummaries.map((summary) => [summary.areaId, summary])),
    [issueSummaries]
  )

  if (!currentSpace) {
    return <Navigate to="/onboarding" replace />
  }

  const resetForm = () => {
    setNewName('')
    setNewCategory('custom')
    setNewParentId('')
    setNewNameError(null)
    setShowAddForm(false)
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newName.trim()) {
      setNewNameError('Give the area a name.')
      return
    }

    setNewNameError(null)
    setCreating(true)
    try {
      const sortOrder = activeAreas.reduce((max, area) => Math.max(max, area.sort_order), 0) + 1
      const created = await createAreaRecord({
        spaceId: currentSpace.id,
        name: newName,
        category: newCategory,
        parentAreaId: newParentId || null,
        sortOrder,
      })
      setAreas((current) => [...current, created])
      resetForm()
      showSuccess('Area added', 'You can add tasks to it once scheduling is on.', {
        label: 'Undo',
        onClick: async () => {
          try {
            await deleteAreaRecord(created.id)
            setAreas((current) => current.filter((area) => area.id !== created.id))
            showSuccess('Area removed')
          } catch (undoError) {
            showError(
              'Could not undo',
              undoError instanceof Error ? undoError.message : 'Remove the area from Space Settings.'
            )
          }
        },
      })
    } catch (createError) {
      setNewNameError(
        createError instanceof Error
          ? createError.message
          : 'Could not create the area. Only owners, admins, and supervisors can add areas.'
      )
    } finally {
      setCreating(false)
    }
  }

  const parentName = (area: Area): string | null => {
    if (!area.parent_area_id) return null
    return areas.find((candidate) => candidate.id === area.parent_area_id)?.name ?? null
  }

  const renderArea = (area: Area, depth = 0) => {
    const children = activeAreas.filter((candidate) => candidate.parent_area_id === area.id)
    const parent = parentName(area)
    const scheduledCount = taskCountByArea.get(area.id) ?? 0
    const templateCount = templateCountByArea.get(area.id) ?? 0
    const issueSummary = issueSummaryByArea.get(area.id)
    const status = deriveAreaStatus(
      {
        active: area.active,
        timezone,
        instances: instancesForArea(area.id, tasks, instances),
        openIssueCount: issueSummary?.openCount ?? 0,
        recurringIssueCount: issueSummary?.recurringCount ?? 0,
      },
      now
    )
    return (
      <li key={area.id} className={depth > 0 ? 'ml-4 border-l-2 border-border pl-3 sm:ml-6' : undefined}>
        <Link
          to={`/areas/${area.id}`}
          className="group block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:border-primary-700"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
              <FolderOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-text">{area.name}</p>
                <Badge variant="outline" size="sm">
                  {areaCategoryLabel(area.category)}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-text-muted">
                {scheduledCount} scheduled {scheduledCount === 1 ? 'task' : 'tasks'}
                {templateCount > 0
                  ? ` · ${templateCount} setup ${templateCount === 1 ? 'template' : 'templates'}`
                  : ''}
                {issueSummary && issueSummary.openCount > 0
                  ? ` · ${issueSummary.openCount} open ${
                      issueSummary.openCount === 1 ? 'issue' : 'issues'
                    }`
                  : ''}
                {parent ? ` · nested under ${parent}` : ''}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">{status.reason}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={status.tone} size="sm" dot title={status.reason}>
                {status.label}
              </Badge>
              <ArrowRight
                className="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </div>
          </div>
        </Link>
        {children.length > 0 && (
          <ul className="mt-2 space-y-2" role="list">
            {children.map((child) => renderArea(child, depth + 1))}
          </ul>
        )}
      </li>
    )
  }

  const rootAreas = activeAreas.filter(
    (area) => !area.parent_area_id || !activeAreas.some((candidate) => candidate.id === area.parent_area_id)
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display-sm font-semibold text-text">
            {currentSpace.type === 'personal' ? 'Rooms & areas' : 'Areas'}
          </h1>
          <p className="mt-1 text-text-muted">
            The places your routines belong to. Status is derived from task and issue records in
            the space timezone, never from photos or guesses.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/space-settings"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-800"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Space settings
          </Link>
          <Button onClick={() => setShowAddForm((value) => !value)} leftIcon={<Plus className="h-4 w-4" />}>
            Add area
          </Button>
        </div>
      </div>

      {showAddForm && (
        <Card variant="outlined">
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Area name"
                  placeholder="e.g. Home gym"
                  value={newName}
                  onChange={(event) => {
                    setNewName(event.target.value)
                    setNewNameError(null)
                  }}
                  error={newNameError ?? undefined}
                  maxLength={60}
                  autoFocus
                />
                <Select
                  label="Category"
                  options={categoryOptions}
                  value={newCategory}
                  onChange={setNewCategory}
                />
                <Select
                  label="Nest under (optional)"
                  options={[
                    { value: '', label: 'Top level' },
                    ...activeAreas.map((area) => ({ value: area.id, label: area.name })),
                  ]}
                  value={newParentId}
                  onChange={setNewParentId}
                />
              </div>
              <p className="text-xs text-text-muted">
                Owners, admins, and supervisors can add areas. Everyone in the space can view them.
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={resetForm} disabled={creating}>
                  Cancel
                </Button>
                <Button type="submit" loading={creating} disabled={!newName.trim()}>
                  Add area
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3" aria-label="Loading areas">
          {[0, 1, 2].map((key) => (
            <Card key={key}>
              <div className="flex items-center gap-3">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="flex-1 space-y-2">
                  <Skeleton width="40%" />
                  <Skeleton width="25%" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load areas"
          message={error}
          onRetry={() => void load()}
        />
      ) : activeAreas.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid className="h-8 w-8" aria-hidden="true" />}
          title="No areas yet"
          description="Areas group the tasks for each place. Add one to get started, or archive no longer used areas."
          action={{ label: 'Add your first area', onClick: () => setShowAddForm(true) }}
        />
      ) : (
        <ul className="space-y-3" role="list" aria-label="Areas in this space">
          {rootAreas.map((area) => renderArea(area))}
        </ul>
      )}

      {!loading && !error && archivedAreas.length > 0 && (
        <div className="border-t border-border pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowArchived((value) => !value)}
            aria-expanded={showArchived}
            leftIcon={<Archive className="h-4 w-4" />}
          >
            {showArchived ? 'Hide' : 'Show'} archived ({archivedAreas.length})
          </Button>
          {showArchived && (
            <ul className="mt-3 space-y-2" role="list" aria-label="Archived areas">
              {archivedAreas.map((area) => (
                <li key={area.id}>
                  <Link
                    to={`/areas/${area.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 hover:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <div>
                      <p className="text-sm text-text-muted line-through">{area.name}</p>
                      <p className="text-xs text-text-muted">Archived · history is kept</p>
                    </div>
                    <Badge variant="outline" size="sm">
                      View
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
