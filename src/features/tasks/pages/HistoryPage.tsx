import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatInTimeZone } from 'date-fns-tz'
import { useAuth } from '@contexts/AuthContext'
import { useNow } from '@hooks/useNow'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { EmptyState } from '@components/ui/EmptyState'
import { ErrorState } from '@components/ui/ErrorState'
import { Skeleton } from '@components/ui/Skeleton'
import { CheckCircle, History, RotateCcw, SkipForward } from 'lucide-react'
import type { TaskHistoryEntry } from '../api/tasks'
import { useTaskHistory } from '../hooks/useTaskHistory'
import { zonedDateKey } from '../lib/recurrence'

function entryTimestamp(entry: TaskHistoryEntry): string {
  return entry.completion?.completed_at ?? entry.instance.skipped_at ?? entry.instance.due_at
}

export function HistoryPage() {
  const { currentSpace } = useAuth()
  const navigate = useNavigate()
  const { entries, loading, error, busyIds, reload, canUndo, canReopen, undoCompletion, reopenEntry } =
    useTaskHistory()

  const now = useNow()
  const timezone = currentSpace?.timezone ?? 'UTC'
  const todayKey = zonedDateKey(now, timezone)
  const yesterdayKey = zonedDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000), timezone)

  const completedCount = entries.filter((entry) => entry.instance.status === 'completed').length
  const skippedCount = entries.filter((entry) => entry.instance.status === 'skipped').length

  const grouped = useMemo(() => {
    const groups = new Map<string, TaskHistoryEntry[]>()
    for (const entry of entries) {
      const key = zonedDateKey(entryTimestamp(entry), timezone)
      const list = groups.get(key) ?? []
      list.push(entry)
      groups.set(key, list)
    }
    return [...groups.entries()].sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
  }, [entries, timezone])

  if (!currentSpace) return null

  const groupLabel = (key: string, firstEntry: TaskHistoryEntry): string => {
    if (key === todayKey) return 'Today'
    if (key === yesterdayKey) return 'Yesterday'
    return formatInTimeZone(new Date(entryTimestamp(firstEntry)), timezone, 'EEEE, MMM d, yyyy')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-display-sm font-semibold text-text">History</h1>
          <p className="mt-1 max-w-2xl text-text-muted">
            A record of completed and skipped work. Nothing here is a streak, score, or penalty.
            You can undo a completion or reopen a skipped task when it is yours to change.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/today"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-800"
          >
            Today
          </Link>
          <Link
            to="/tasks"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-800"
          >
            Tasks &amp; schedules
          </Link>
        </div>
      </div>

      {!loading && !error && entries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="success" dot>
            {completedCount} completed
          </Badge>
          <Badge variant="default" dot>
            {skippedCount} skipped
          </Badge>
          <Badge variant="outline">{timezone.replace('_', ' ')}</Badge>
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-label="Loading task history">
          {[0, 1, 2, 3].map((key) => (
            <Card key={key}>
              <Skeleton width="40%" />
              <div className="mt-3">
                <Skeleton width="60%" />
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Could not load history" message={error} onRetry={() => void reload()} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<History className="h-8 w-8" aria-hidden="true" />}
          title="No history yet"
          description="Complete or skip a scheduled task and it will appear here. Records are kept even if a task is later paused or removed."
          action={{ label: 'Go to today', onClick: () => navigate('/today') }}
          secondaryAction={{ label: 'View schedules', onClick: () => navigate('/tasks') }}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([key, dayEntries]) => {
            const firstEntry = dayEntries[0]
            if (!firstEntry) return null
            return (
              <section key={key} aria-labelledby={`history-${key}`}>
                <h2
                  id={`history-${key}`}
                  className="mb-2 text-heading-sm font-semibold text-text"
                >
                  {groupLabel(key, firstEntry)}
                </h2>
                <div className="space-y-2">
                  {dayEntries.map((entry) => {
                    const { instance, task, areaName, completion, completedByName } = entry
                    const completed = instance.status === 'completed'
                    const skipped = instance.status === 'skipped'
                    const busy = busyIds.includes(instance.id)
                    const timestamp = entryTimestamp(entry)
                    const note = completion?.notes ?? instance.skip_reason

                    return (
                      <Card key={instance.id} padding="md">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium text-text">{task.name}</h3>
                              {completed ? (
                                <Badge variant="success" size="sm" dot>
                                  Completed
                                </Badge>
                              ) : (
                                <Badge variant="default" size="sm" dot>
                                  Skipped
                                </Badge>
                              )}
                              {areaName && (
                                <Badge variant="outline" size="sm">
                                  {areaName}
                                </Badge>
                              )}
                            </div>

                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                              <span>
                                {completed ? 'Completed' : 'Skipped'}{' '}
                                {formatInTimeZone(new Date(timestamp), timezone, 'MMM d, h:mm a')}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>
                                Due{' '}
                                {formatInTimeZone(
                                  new Date(instance.due_at),
                                  timezone,
                                  'MMM d, h:mm a'
                                )}
                              </span>
                              {completedByName && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>by {completedByName}</span>
                                </>
                              )}
                            </p>

                            {note && <p className="mt-2 text-sm text-text-muted">{note}</p>}
                          </div>

                          <div className="flex flex-shrink-0 flex-wrap items-center gap-1">
                            {completed && canUndo(entry) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void undoCompletion(entry)}
                                loading={busy}
                                leftIcon={<RotateCcw className="h-4 w-4" />}
                                aria-label={`Undo completion of ${task.name}`}
                              >
                                Undo
                              </Button>
                            )}
                            {skipped && canReopen(entry) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void reopenEntry(entry)}
                                loading={busy}
                                leftIcon={<RotateCcw className="h-4 w-4" />}
                                aria-label={`Reopen ${task.name}`}
                              >
                                Reopen
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-border pt-4 text-sm text-text-muted">
        {completedCount > 0 ? (
          <CheckCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        ) : (
          <SkipForward className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        )}
        <p>
          History reflects the most recent 100 completed or skipped instances. Older records remain
          stored and are not deleted by Fresh Start.
        </p>
      </div>
    </div>
  )
}
