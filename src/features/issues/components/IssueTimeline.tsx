import { formatInTimeZone } from 'date-fns-tz'
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle,
  Image,
  ListPlus,
  MessageSquare,
  Play,
  RotateCcw,
  UserPlus,
} from 'lucide-react'
import type { Json } from '@/types/database'
import type { IssueTimelineEntry } from '../types'

function jsonString(value: Json | null, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const field = value[key]
  return typeof field === 'string' ? field : null
}

function actionLabel(entry: IssueTimelineEntry): string {
  const { event } = entry
  switch (event.action) {
    case 'reported':
      return 'Reported the issue'
    case 'assigned': {
      const label = jsonString(event.new_value, 'assignee_label')
      if (!label) return 'Changed the assignment'
      return `Assigned to ${label}`
    }
    case 'started':
      return 'Started work'
    case 'resolved':
      return 'Marked the issue resolved'
    case 'verified':
      return 'Verified and closed the issue'
    case 'reopened':
      return 'Reopened the issue'
    case 'commented':
      return 'Commented'
    case 'photos_attached':
      return 'Attached photos'
    case 'converted_to_task': {
      const taskName = jsonString(event.new_value, 'task_name')
      return taskName ? `Created follow-up task: ${taskName}` : 'Created a follow-up task'
    }
    default:
      return event.action.replaceAll('_', ' ')
  }
}

function actionIcon(action: string) {
  const className = 'h-4 w-4'
  switch (action) {
    case 'reported':
      return <AlertCircle className={className} aria-hidden="true" />
    case 'assigned':
      return <UserPlus className={className} aria-hidden="true" />
    case 'started':
      return <Play className={className} aria-hidden="true" />
    case 'resolved':
      return <CheckCircle className={className} aria-hidden="true" />
    case 'verified':
      return <BadgeCheck className={className} aria-hidden="true" />
    case 'reopened':
      return <RotateCcw className={className} aria-hidden="true" />
    case 'commented':
      return <MessageSquare className={className} aria-hidden="true" />
    case 'photos_attached':
      return <Image className={className} aria-hidden="true" />
    case 'converted_to_task':
      return <ListPlus className={className} aria-hidden="true" />
    default:
      return <AlertCircle className={className} aria-hidden="true" />
  }
}

function iconTone(action: string): string {
  switch (action) {
    case 'resolved':
    case 'verified':
      return 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
    case 'reopened':
      return 'bg-destructive-100 text-destructive-700 dark:bg-destructive-900/30 dark:text-destructive-300'
    case 'commented':
      return 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-300'
    default:
      return 'bg-neutral-100 text-text-muted dark:bg-neutral-800'
  }
}

function extraDetail(entry: IssueTimelineEntry, timezone: string): string | null {
  if (entry.event.action !== 'assigned') return null
  const dueAt = jsonString(entry.event.new_value, 'due_at')
  if (!dueAt) return null
  return `Due ${formatInTimeZone(new Date(dueAt), timezone, 'MMM d, yyyy')}`
}

export function IssueTimeline({
  entries,
  timezone,
}: {
  entries: IssueTimelineEntry[]
  timezone: string
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-text-muted">
        No activity has been recorded yet.
      </p>
    )
  }

  return (
    <ol className="relative space-y-4" aria-label="Issue timeline">
      {entries.map((entry, index) => {
        const { event, actorName } = entry
        const isComment = event.action === 'commented'
        const label = actionLabel(entry)
        const detail = extraDetail(entry, timezone)
        return (
          <li key={event.id} className="relative flex gap-3">
            {index < entries.length - 1 && (
              <span
                className="absolute start-[15px] top-8 h-[calc(100%+0.5rem)] w-px bg-border"
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${iconTone(
                event.action
              )}`}
            >
              {actionIcon(event.action)}
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm text-text">
                  <span className="font-medium">{actorName}</span>{' '}
                  {isComment ? 'commented' : label.charAt(0).toLowerCase() + label.slice(1)}
                </p>
                <time
                  className="text-xs text-text-muted"
                  dateTime={event.created_at}
                  title={event.created_at}
                >
                  {formatInTimeZone(new Date(event.created_at), timezone, 'MMM d, yyyy · HH:mm')}
                </time>
              </div>
              {detail && <p className="mt-0.5 text-xs text-text-muted">{detail}</p>}
              {event.comment && (
                <p
                  className={
                    isComment
                      ? 'mt-1 rounded-lg bg-background px-3 py-2 text-sm text-text'
                      : 'mt-1 text-sm text-text-muted'
                  }
                >
                  {event.comment}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
