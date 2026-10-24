import { Link, useNavigate } from 'react-router-dom'
import { formatInTimeZone } from 'date-fns-tz'
import { useAuth } from '@contexts/AuthContext'
import { useNow } from '@hooks/useNow'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'
import { EmptyState } from '@components/ui/EmptyState'
import { ErrorState } from '@components/ui/ErrorState'
import { Skeleton } from '@components/ui/Skeleton'
import {
  CheckCircle,
  Clock,
  History,
  LayoutGrid,
  Settings,
  Sparkles,
} from 'lucide-react'
import { TaskInstanceCard } from '../components/TaskInstanceCard'
import { useTodayTasks } from '../hooks/useTodayTasks'
import {
  canCompleteInstance,
  countCompletedToday,
  dependencyBlockers,
  isCompletedOnLocalDay,
  selectTodayFocus,
  selectTodayRemaining,
  selectUpcoming,
} from '../lib/taskViews'

export function TodayPage() {
  const { currentSpace, user } = useAuth()
  const navigate = useNavigate()
  const {
    views,
    dependencies,
    role,
    taskCount,
    templateCount,
    loading,
    error,
    warning,
    busyIds,
    canManage,
    reload,
    materializeSchedules,
    complete,
    skip,
    undoCompletion,
  } = useTodayTasks()

  const now = useNow()

  if (!currentSpace) return null

  const timezone = currentSpace.timezone
  const dateLabel = formatInTimeZone(now, timezone, 'EEEE, MMMM d')

  const focus = selectTodayFocus(views, now, timezone)
  const remaining = selectTodayRemaining(views, now, timezone, focus)
  const upcoming = selectUpcoming(views, now, timezone, 7).slice(0, 5)
  const completedToday = countCompletedToday(views, now, timezone)
  const completedTodayViews = views
    .filter((view) => isCompletedOnLocalDay(view.instance, now, timezone))
    .slice(0, 5)

  const hasAnyScheduledWork = views.length > 0
  const hasActionableToday = focus.length > 0 || remaining.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-display-sm font-semibold text-text">Today</h1>
          <p className="mt-1 text-text-muted">
            {dateLabel} · {currentSpace.name}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            A little progress counts. There are no streaks to protect and no penalties here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {timezone.replace('_', ' ')}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => navigate('/tasks')}>
            All schedules
          </Button>
        </div>
      </div>

      {warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200" role="status">
          {warning}
        </div>
      )}

      {loading ? (
        <div className="space-y-4" aria-label="Loading today">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      ) : error ? (
        <ErrorState title="Could not load today" message={error} onRetry={() => void reload()} />
      ) : taskCount === 0 && templateCount > 0 ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8" aria-hidden="true" />}
          title="Your routines are ready to schedule"
          description={
            canManage
              ? `Setup saved ${templateCount} task ${
                  templateCount === 1 ? 'template' : 'templates'
                }. Creating schedules turns them into recurring work you can complete.`
              : `Setup saved ${templateCount} task ${
                  templateCount === 1 ? 'template' : 'templates'
                }. Ask an owner, admin, or supervisor to create schedules.`
          }
          action={
            canManage
              ? {
                  label: 'Create schedules',
                  onClick: () => void materializeSchedules(),
                }
              : undefined
          }
          secondaryAction={{ label: 'Review areas', onClick: () => navigate('/areas') }}
        />
      ) : taskCount === 0 ? (
        <EmptyState
          icon={<LayoutGrid className="h-8 w-8" aria-hidden="true" />}
          title="Start with an area"
          description="Areas group the routines for each place. Add an area, then create a task for it."
          action={{ label: 'Open areas', onClick: () => navigate('/areas') }}
          secondaryAction={{ label: 'Space settings', onClick: () => navigate('/space-settings') }}
        />
      ) : !hasActionableToday && upcoming.length === 0 ? (
        <>
          <EmptyState
            icon={<CheckCircle className="h-8 w-8" aria-hidden="true" />}
            title="Nothing is due today"
            description={
              completedToday > 0
                ? `You completed ${completedToday} ${
                    completedToday === 1 ? 'task' : 'tasks'
                  } today. The rest can wait until it is due.`
                : 'Your next scheduled work will appear here. Completed and skipped records stay in History.'
            }
            action={{ label: 'View schedules', onClick: () => navigate('/tasks') }}
            secondaryAction={{ label: 'Open history', onClick: () => navigate('/history') }}
          />
          {completedTodayViews.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Done today</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {completedTodayViews.map((view) => (
                  <TaskInstanceCard
                    key={view.instance.id}
                    view={view}
                    now={now}
                    timezone={timezone}
                    blockers={[]}
                    canComplete={false}
                    busy={busyIds.includes(view.instance.id)}
                    onComplete={() => undefined}
                    onSkip={() => undefined}
                    onUndoCompletion={(id) => void undoCompletion(id)}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-200">
            {completedToday > 0
              ? `You have completed ${completedToday} ${
                  completedToday === 1 ? 'task' : 'tasks'
                } today. Keep going only if it fits.`
              : 'Pick what fits today. Skipping is allowed and never counted against you.'}
          </div>

          {focus.length > 0 && (
            <section className="space-y-3" aria-labelledby="up-first-heading">
              <div className="flex items-center justify-between gap-3">
                <h2 id="up-first-heading" className="text-heading-md font-semibold text-text">
                  Up first
                </h2>
                <span className="text-sm text-text-muted">At most three, on purpose</span>
              </div>
              <div className="space-y-3">
                {focus.map((view) => (
                  <TaskInstanceCard
                    key={view.instance.id}
                    view={view}
                    now={now}
                    timezone={timezone}
                    prominent
                    blockers={dependencyBlockers(view, views, dependencies)}
                    canComplete={canCompleteInstance(role, user?.id ?? null, view.instance)}
                    busy={busyIds.includes(view.instance.id)}
                    onComplete={(item) => void complete(item)}
                    onSkip={(item) => void skip(item)}
                  />
                ))}
              </div>
            </section>
          )}

          {remaining.length > 0 && (
            <section className="space-y-2" aria-labelledby="also-today-heading">
              <h2 id="also-today-heading" className="text-heading-sm font-semibold text-text">
                Also due today
              </h2>
              <div className="space-y-2">
                {remaining.map((view) => (
                  <TaskInstanceCard
                    key={view.instance.id}
                    view={view}
                    now={now}
                    timezone={timezone}
                    blockers={dependencyBlockers(view, views, dependencies)}
                    canComplete={canCompleteInstance(role, user?.id ?? null, view.instance)}
                    busy={busyIds.includes(view.instance.id)}
                    onComplete={(item) => void complete(item)}
                    onSkip={(item) => void skip(item)}
                  />
                ))}
              </div>
            </section>
          )}

          {focus.length === 0 && remaining.length === 0 && (
            <div className="rounded-xl border border-border bg-surface px-4 py-6 text-center">
              <p className="font-medium text-text">Nothing is due right now</p>
              <p className="mt-1 text-sm text-text-muted">
                The next scheduled work is listed below. You can also open History to see what is
                already recorded.
              </p>
            </div>
          )}

          {upcoming.length > 0 && (
            <section className="space-y-2" aria-labelledby="coming-up-heading">
              <div className="flex items-center justify-between gap-3">
                <h2 id="coming-up-heading" className="text-heading-sm font-semibold text-text">
                  Coming up
                </h2>
                <Link
                  to="/tasks"
                  className="text-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-300"
                >
                  All schedules
                </Link>
              </div>
              <div className="space-y-2">
                {upcoming.map((view) => (
                  <TaskInstanceCard
                    key={view.instance.id}
                    view={view}
                    now={now}
                    timezone={timezone}
                    blockers={dependencyBlockers(view, views, dependencies)}
                    canComplete={canCompleteInstance(role, user?.id ?? null, view.instance)}
                    busy={busyIds.includes(view.instance.id)}
                    onComplete={(item) => void complete(item)}
                    onSkip={(item) => void skip(item)}
                  />
                ))}
              </div>
            </section>
          )}

          {completedTodayViews.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Done today</CardTitle>
                <Link
                  to="/history"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-300"
                >
                  <History className="h-4 w-4" aria-hidden="true" />
                  History
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {completedTodayViews.map((view) => (
                  <TaskInstanceCard
                    key={view.instance.id}
                    view={view}
                    now={now}
                    timezone={timezone}
                    blockers={[]}
                    canComplete={false}
                    busy={busyIds.includes(view.instance.id)}
                    onComplete={() => undefined}
                    onSkip={() => undefined}
                    onUndoCompletion={(id) => void undoCompletion(id)}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {hasAnyScheduledWork && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-text-muted">
          <p>
            Due dates use {timezone}. Completion is recorded only when you mark a task done.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/history"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <History className="h-4 w-4" aria-hidden="true" />
              History
            </Link>
            <Link
              to="/space-settings"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              Space settings
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
