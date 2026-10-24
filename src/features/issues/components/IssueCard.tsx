import { Link } from 'react-router-dom'
import { formatInTimeZone } from 'date-fns-tz'
import { Badge } from '@components/ui/Badge'
import {
  AlertTriangle,
  CalendarClock,
  Link2,
  MapPin,
  RefreshCw,
  RotateCcw,
  User,
  Users,
} from 'lucide-react'
import { issueCategoryLabel } from '../api/schema'
import type { IssueListItem } from '../types'
import { IssuePriorityBadge } from './IssuePriorityBadge'
import { IssueStatusBadge } from './IssueStatusBadge'

export function IssueCard({
  item,
  timezone,
}: {
  item: IssueListItem
  timezone: string
}) {
  const { issue } = item
  const category = issueCategoryLabel(issue.category, issue.custom_category)
  const assigneeIcon =
    issue.assigned_team_id !== null ? (
      <Users className="h-3.5 w-3.5" aria-hidden="true" />
    ) : issue.external_service ? (
      <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
    ) : (
      <User className="h-3.5 w-3.5" aria-hidden="true" />
    )

  return (
    <Link
      to={`/issues/${issue.id}`}
      className="group block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:border-primary-700"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <IssueStatusBadge status={issue.status} />
            <IssuePriorityBadge priority={issue.priority} />
            {issue.reopen_count > 0 && (
              <Badge variant="outline" size="sm">
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Reopened {issue.reopen_count === 1 ? 'once' : `${issue.reopen_count} times`}
              </Badge>
            )}
            {item.pattern?.is_recurring && (
              <Badge variant="amber" size="sm">
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                Recurring pattern
              </Badge>
            )}
          </div>
          <h3 className="mt-2 font-medium text-text group-hover:text-primary-700 dark:group-hover:text-primary-300">
            {issue.title}
          </h3>
          {issue.description && (
            <p className="mt-1 line-clamp-2 text-sm text-text-muted">{issue.description}</p>
          )}
        </div>
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {item.areaName ?? 'No area'}
        </span>
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          {category}
        </span>
        <span className="inline-flex items-center gap-1">
          {assigneeIcon}
          {item.assigneeLabel}
        </span>
        {issue.due_at && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            Due {formatInTimeZone(new Date(issue.due_at), timezone, 'MMM d, yyyy')}
          </span>
        )}
        {item.followUpTaskName && (
          <span className="inline-flex items-center gap-1 text-primary-700 dark:text-primary-300">
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            {item.followUpTaskName}
          </span>
        )}
        <span>
          Reported by {item.reporterName} ·{' '}
          {formatInTimeZone(new Date(issue.created_at), timezone, 'MMM d, yyyy')}
        </span>
      </div>
    </Link>
  )
}
