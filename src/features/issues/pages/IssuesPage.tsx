import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'
import { useNow } from '@hooks/useNow'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { EmptyState } from '@components/ui/EmptyState'
import { ErrorState } from '@components/ui/ErrorState'
import { Skeleton } from '@components/ui/Skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/Tabs'
import { AlertTriangle, Plus, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react'
import type { IssueListItem, IssueFilters as IssueFiltersValue } from '../types'
import { emptyIssueFilters } from '../types'
import { isOpenIssueStatus, type IssueReportInput } from '../api/schema'
import { useIssues } from '../hooks/useIssues'
import { isIssueInQueue, isIssueUnassigned } from '../lib/permissions'
import { AssignIssueModal } from '../components/AssignIssueModal'
import { IssueActionModal, type IssueActionMode } from '../components/IssueActionModal'
import { IssueCard } from '../components/IssueCard'
import { IssueFilters } from '../components/IssueFilters'
import { ReportIssueModal } from '../components/ReportIssueModal'
import { SupervisorQueue } from '../components/SupervisorQueue'

type IssueTab = 'all' | 'queue'

function matchesFilters(item: IssueListItem, filters: IssueFiltersValue): boolean {
  const { issue } = item

  if (filters.status === 'open') {
    if (!isOpenIssueStatus(issue.status)) return false
  } else if (filters.status !== 'all' && issue.status !== filters.status) {
    return false
  }

  if (filters.areaId === 'none') {
    if (issue.area_id !== null) return false
  } else if (filters.areaId !== 'all' && issue.area_id !== filters.areaId) {
    return false
  }

  if (filters.category !== 'all' && issue.category !== filters.category) return false
  if (filters.priority !== 'all' && issue.priority !== filters.priority) return false

  if (filters.assignee === 'unassigned') {
    return isIssueUnassigned(issue)
  }
  if (filters.assignee === 'external') {
    return Boolean(issue.external_service)
  }
  if (filters.assignee.startsWith('person:')) {
    return issue.assigned_to === filters.assignee.slice('person:'.length)
  }
  if (filters.assignee.startsWith('team:')) {
    return issue.assigned_team_id === filters.assignee.slice('team:'.length)
  }

  return true
}

export function IssuesPage() {
  const { currentSpace, user } = useAuth()
  const now = useNow()
  const [searchParams, setSearchParams] = useSearchParams()
  const areaParam = searchParams.get('areaId')
  const {
    items,
    areas,
    members,
    teams,
    patterns,
    loading,
    error,
    busyIds,
    canManage,
    reload,
    reportIssue,
    assignIssue,
    startIssue,
    resolveIssue,
    verifyIssue,
    reopenIssue,
    convertToTask,
  } = useIssues()

  const [tab, setTab] = useState<IssueTab>('all')
  const [filters, setFilters] = useState<IssueFiltersValue>(() => ({
    ...emptyIssueFilters,
    areaId: areaParam ?? 'all',
  }))
  const [reportRequested, setReportRequested] = useState(false)
  const [assigning, setAssigning] = useState<IssueListItem | null>(null)
  const [action, setAction] = useState<{ item: IssueListItem; mode: IssueActionMode } | null>(null)
  const reportOpen = reportRequested || searchParams.get('report') === '1'

  // Area links can change the query string without unmounting this route.
  // Keep the visible area filter in step with the URL in that case.
  useEffect(() => {
    const nextAreaId = areaParam ?? 'all'
    setFilters((current) =>
      current.areaId === nextAreaId ? current : { ...current, areaId: nextAreaId }
    )
  }, [areaParam])

  const closeReport = useCallback(() => {
    setReportRequested(false)
    if (searchParams.has('report')) {
      const next = new URLSearchParams(searchParams)
      next.delete('report')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const openReport = useCallback(() => {
    setReportRequested(true)
  }, [])

  const timezone = currentSpace?.timezone ?? 'UTC'
  const photosEnabled = currentSpace?.settings?.photosEnabled === true

  const filtered = useMemo(
    () => items.filter((item) => matchesFilters(item, filters)),
    [filters, items]
  )

  const sorted = useMemo(
    () =>
      filtered
        .slice()
        .sort((a, b) => {
          const openDelta =
            Number(isOpenIssueStatus(b.issue.status)) - Number(isOpenIssueStatus(a.issue.status))
          if (openDelta !== 0) return openDelta
          return new Date(b.issue.created_at).getTime() - new Date(a.issue.created_at).getTime()
        }),
    [filtered]
  )

  const openCount = items.filter((item) => isOpenIssueStatus(item.issue.status)).length
  const awaitingVerification = items.filter((item) => item.issue.status === 'resolved').length
  const reopenedCount = items.filter((item) => item.issue.status === 'reopened').length
  const unassignedCount = items.filter(
    (item) => isOpenIssueStatus(item.issue.status) && isIssueUnassigned(item.issue)
  ).length
  const queueCount = items.filter((item) => isIssueInQueue(item.issue, now)).length
  const recurringPatterns = patterns.filter((pattern) => pattern.is_recurring)
  const areaNameById = useMemo(
    () => new Map(areas.map((area) => [area.id, area.name])),
    [areas]
  )
  const isFiltered =
    filters.status !== 'all' ||
    filters.areaId !== 'all' ||
    filters.category !== 'all' ||
    filters.priority !== 'all' ||
    filters.assignee !== 'all'

  const handleReport = async (
    input: IssueReportInput,
    photo: File | null
  ): Promise<boolean> => {
    const created = await reportIssue(input, photo)
    return created !== null
  }

  const handleActionNote = async (note: string): Promise<boolean> => {
    if (!action) return false
    switch (action.mode) {
      case 'start':
        return startIssue(action.item.issue.id, note)
      case 'resolve':
        return resolveIssue(action.item.issue.id, note)
      case 'verify':
        return verifyIssue(action.item.issue.id, note)
      case 'reopen':
        return reopenIssue(action.item.issue.id, note)
    }
  }

  if (!currentSpace) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-display-sm font-semibold text-text">Issues</h1>
          <p className="mt-1 max-w-2xl text-text-muted">
            Report what needs attention and keep one clear record of who is handling it. Status
            comes from issue records, not from photos or guesses.
          </p>
        </div>
        <Button onClick={openReport} leftIcon={<Plus className="h-4 w-4" />}>
          Report issue
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card padding="md">
          <p className="text-sm text-text-muted">Open issues</p>
          <p className="mt-1 text-2xl font-bold text-text">{openCount}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-text-muted">Unassigned</p>
          <p className="mt-1 text-2xl font-bold text-text">{unassignedCount}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-text-muted">Awaiting verification</p>
          <p className="mt-1 text-2xl font-bold text-text">{awaitingVerification}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-text-muted">Reopened</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-text">
            {reopenedCount}
            {reopenedCount > 0 && (
              <RotateCcw className="h-4 w-4 text-amber-600 dark:text-amber-300" aria-hidden="true" />
            )}
          </p>
        </Card>
      </div>

      {recurringPatterns.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-900/10">
          <div className="flex flex-wrap items-start gap-3">
            <RefreshCw
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-300"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-text">Repeated patterns in the last 30 days</h2>
              <p className="mt-1 text-sm text-text-muted">
                These are counts from issue records, not a judgement about the area. A pattern is
                marked recurring after three reports in the same area and category.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2" role="list">
                {recurringPatterns.slice(0, 8).map((pattern) => (
                  <li key={pattern.id}>
                    <Badge variant="amber" size="sm">
                      {areaNameById.get(pattern.area_id) ?? 'Area'} ·{' '}
                      {pattern.category === 'custom'
                        ? pattern.custom_category ?? 'Custom'
                        : pattern.category}{' '}
                      · {pattern.issue_count}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <IssueFilters
        filters={filters}
        onChange={setFilters}
        areas={areas}
        members={members}
        teams={teams}
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as IssueTab)}>
        <TabsList className="inline-flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
          <TabsTrigger value="all">All issues</TabsTrigger>
          {canManage && (
            <TabsTrigger value="queue">
              Supervisor queue
              {queueCount > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-200 px-1.5 text-xs text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
                  {queueCount}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {loading ? (
            <div className="space-y-3" aria-label="Loading issues">
              {[0, 1, 2].map((key) => (
                <Card key={key}>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Skeleton width={72} height={20} />
                      <Skeleton width={96} height={20} />
                    </div>
                    <Skeleton width="55%" />
                    <Skeleton width="80%" />
                    <Skeleton width="40%" />
                  </div>
                </Card>
              ))}
            </div>
          ) : error ? (
            <ErrorState
              title="Could not load issues"
              message={error}
              onRetry={() => void reload()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-8 w-8" aria-hidden="true" />}
              title="No issues reported yet"
              description="When something needs attention, report it here. You can add a photo only if your space has photos turned on."
              action={{ label: 'Report an issue', onClick: openReport }}
            />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-8 w-8" aria-hidden="true" />}
              title="No issues match these filters"
              description="Try a different status, area, category, priority, or assignee."
              action={{
                label: 'Clear filters',
                onClick: () => setFilters({ ...emptyIssueFilters, areaId: areaParam ?? 'all' }),
              }}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">
                {sorted.length} {sorted.length === 1 ? 'issue' : 'issues'}
                {isFiltered ? ' match the current filters' : ''}
              </p>
              <ul className="space-y-3" role="list" aria-label="Issues">
                {sorted.map((item) => (
                  <li key={item.issue.id}>
                    <IssueCard item={item} timezone={timezone} />
                    {currentSpace.type === 'personal' &&
                      item.issue.follow_up_task_id === null &&
                      isOpenIssueStatus(item.issue.status) && (
                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void convertToTask(item.issue.id)}
                            loading={busyIds.includes(item.issue.id)}
                            leftIcon={<RefreshCw className="h-4 w-4" />}
                          >
                            Convert to one-off task
                          </Button>
                        </div>
                      )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        {canManage && (
          <TabsContent value="queue" className="mt-4 space-y-4">
            <SupervisorQueue items={filtered} now={now} timezone={timezone} />
            {filtered.filter((item) => isIssueInQueue(item.issue, now)).length > 0 && (
              <ul className="space-y-3" role="list" aria-label="Issues in the supervisor queue">
                {filtered
                  .filter((item) => isIssueInQueue(item.issue, now))
                  .map((item) => (
                    <li key={item.issue.id}>
                      <IssueCard item={item} timezone={timezone} />
                    </li>
                  ))}
              </ul>
            )}
          </TabsContent>
        )}
      </Tabs>

      <ReportIssueModal
        isOpen={reportOpen}
        areas={areas}
        defaultAreaId={areaParam}
        photosEnabled={photosEnabled}
        submitting={busyIds.includes('report')}
        onClose={closeReport}
        onSubmit={handleReport}
      />

      {assigning && (
        <AssignIssueModal
          isOpen
          issue={assigning.issue}
          members={members}
          teams={teams}
          timezone={timezone}
          busy={busyIds.includes(assigning.issue.id)}
          onClose={() => setAssigning(null)}
          onSubmit={(input) => assignIssue(assigning.issue.id, input)}
        />
      )}

      <IssueActionModal
        isOpen={action !== null}
        mode={action?.mode ?? 'start'}
        busy={action ? busyIds.includes(action.item.issue.id) : false}
        onClose={() => setAction(null)}
        onSubmit={handleActionNote}
      />

      {canManage && user && (
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          You can assign, verify, and reopen issues. The reporter can also verify and reopen their
          own issue.
        </p>
      )}

      {user && items.some((item) => item.issue.reported_by === user.id) && (
        <p className="text-xs text-text-muted">
          Issues you reported appear with your name and timestamp. You can add comments at any
          time.
        </p>
      )}
    </div>
  )
}
