import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { cn } from '@lib/utils'
import {
  Check,
  Clock,
  RotateCcw,
  SkipForward,
  User,
  Link2,
} from 'lucide-react'
import {
  describeDue,
  formatDueTime,
  isOverdueInstance,
  type DependencyBlocker,
  type TaskInstanceView,
} from '../lib/taskViews'
import { TaskDiscussion } from './TaskDiscussion'
import { TaskSwapControl } from './TaskSwapControl'

export interface TaskInstanceCardProps {
  view: TaskInstanceView
  now: Date
  timezone: string
  blockers: DependencyBlocker[]
  canComplete: boolean
  busy: boolean
  prominent?: boolean
  onComplete: (view: TaskInstanceView) => void
  onSkip: (view: TaskInstanceView) => void
  onUndoCompletion?: (instanceId: string) => void
  onReopen?: (instanceId: string) => void
}

export function TaskInstanceCard({
  view,
  now,
  timezone,
  blockers,
  canComplete,
  busy,
  prominent = false,
  onComplete,
  onSkip,
  onUndoCompletion,
  onReopen,
}: TaskInstanceCardProps) {
  const { instance, task, areaName, assigneeName } = view
  const completed = instance.status === 'completed'
  const skipped = instance.status === 'skipped'
  const overdue = isOverdueInstance(instance, now)
  const blocked = blockers.length > 0
  const blockedNames = [...new Set(blockers.map((blocker) => blocker.taskName))].join(', ')

  if (prominent) {
    return (
      <Card
        padding="lg"
        className={cn(
          'relative overflow-hidden border-l-4',
          overdue ? 'border-l-amber-500' : 'border-l-primary-500'
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {areaName && (
                <Badge variant="outline" size="sm">
                  {areaName}
                </Badge>
              )}
              {overdue && !completed && !skipped && (
                <Badge variant="amber" size="sm" dot>
                  Overdue
                </Badge>
              )}
              {instance.status === 'in_progress' && (
                <Badge variant="info" size="sm" dot>
                  In progress
                </Badge>
              )}
            </div>
            <h3 className="mt-2 text-heading-md font-semibold text-text">{task.name}</h3>
            <p className="mt-1 text-sm font-medium text-text-muted">{describeDue(view, now, timezone)}</p>
            {task.description && (
              <p className="mt-2 text-sm text-text-muted">{task.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {task.estimated_minutes ? `${task.estimated_minutes} min` : 'No estimate'}
              </span>
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" aria-hidden="true" />
                {assigneeName ? `Assigned to ${assigneeName}` : 'Anyone can pick this up'}
              </span>
              <span>{formatDueTime(instance.due_at, timezone)}</span>
            </div>

            {blocked && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                <Link2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>
                  Waiting on {blockedNames}. Complete or skip the latest prerequisite first.
                </span>
              </p>
            )}
            <TaskDiscussion instanceId={instance.id} />
            {!completed && !skipped && (
              <TaskSwapControl instanceId={instance.id} assigneeId={instance.assignee_id} />
            )}
            {!canComplete && !blocked && !completed && !skipped && (
              <p className="mt-3 text-sm text-text-muted">
                {assigneeName
                  ? `Only ${assigneeName} or a supervisor can complete this one.`
                  : 'Your role can view this task, but not complete it.'}
              </p>
            )}
          </div>

          <div className="flex flex-shrink-0 flex-col gap-2 sm:w-36">
            {completed ? (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium text-success-700 dark:text-success-300">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Completed
                </p>
                {onUndoCompletion && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUndoCompletion(instance.id)}
                    disabled={busy}
                    leftIcon={<RotateCcw className="h-4 w-4" />}
                  >
                    Undo
                  </Button>
                )}
              </div>
            ) : skipped ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-text-muted">Skipped</p>
                {onReopen && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReopen(instance.id)}
                    disabled={busy}
                    leftIcon={<RotateCcw className="h-4 w-4" />}
                  >
                    Reopen
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Button
                  onClick={() => onComplete(view)}
                  disabled={!canComplete || blocked || busy}
                  loading={busy}
                  leftIcon={<Check className="h-4 w-4" />}
                  aria-label={`Complete ${task.name}`}
                >
                  Complete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSkip(view)}
                  disabled={busy}
                  leftIcon={<SkipForward className="h-4 w-4" />}
                  aria-label={`Skip ${task.name}`}
                >
                  Skip for now
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="pt-0.5">
        {completed ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300">
            <Check className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : skipped ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-text-muted dark:bg-neutral-800">
            <SkipForward className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : (
          <Button
            variant="outline"
            size="icon"
            onClick={() => onComplete(view)}
            disabled={!canComplete || blocked || busy}
            loading={busy}
            aria-label={`Complete ${task.name}`}
            className="h-8 w-8 rounded-full"
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn('font-medium text-text', (completed || skipped) && 'text-text-muted')}>
            {task.name}
          </p>
          {overdue && !completed && !skipped && (
            <Badge variant="amber" size="sm">
              Overdue
            </Badge>
          )}
          {completed && (
            <Badge variant="success" size="sm">
              Done
            </Badge>
          )}
          {skipped && (
            <Badge variant="default" size="sm">
              Skipped
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-text-muted">
          {[areaName, describeDue(view, now, timezone), assigneeName ? `Assigned to ${assigneeName}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {blocked && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            Waiting on {blockedNames}
          </p>
        )}
        <TaskDiscussion instanceId={instance.id} />
        {!completed && !skipped && (
          <TaskSwapControl instanceId={instance.id} assigneeId={instance.assignee_id} />
        )}
        {!canComplete && !blocked && !completed && !skipped && (
          <p className="mt-1 text-xs text-text-muted">Assigned to someone else</p>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        {completed && onUndoCompletion && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUndoCompletion(instance.id)}
            disabled={busy}
            aria-label={`Undo completion of ${task.name}`}
          >
            Undo
          </Button>
        )}
        {skipped && onReopen && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReopen(instance.id)}
            disabled={busy}
            aria-label={`Reopen ${task.name}`}
          >
            Reopen
          </Button>
        )}
        {!completed && !skipped && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSkip(view)}
            disabled={busy}
            aria-label={`Skip ${task.name}`}
          >
            Skip
          </Button>
        )}
      </div>
    </div>
  )
}
