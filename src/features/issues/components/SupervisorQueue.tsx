import { Link } from 'react-router-dom'
import { formatInTimeZone } from 'date-fns-tz'
import { Badge } from '@components/ui/Badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@components/ui/Card'
import { AlertTriangle, ArrowRight, CalendarClock, UserX } from 'lucide-react'
import type { IssueListItem } from '../types'
import { isIssueInQueue, isIssueUnassigned } from '../lib/permissions'
import { IssueStatusBadge } from './IssueStatusBadge'

function queueReason(item: IssueListItem, now: Date, timezone: string): string {
  if (item.issue.status === 'reopened') return 'Reopened after verification'
  if (isIssueUnassigned(item.issue)) return 'Waiting for an assignee'
  if (item.issue.due_at && new Date(item.issue.due_at).getTime() < now.getTime()) {
    return `Past due ${formatInTimeZone(new Date(item.issue.due_at), timezone, 'MMM d')}`
  }
  return 'Needs a supervisor'
}

export function SupervisorQueue({
  items,
  now,
  timezone,
}: {
  items: IssueListItem[]
  now: Date
  timezone: string
}) {
  const queue = items.filter((item) => isIssueInQueue(item.issue, now))
  const unassigned = queue.filter((item) => isIssueUnassigned(item.issue)).length
  const reopened = queue.filter((item) => item.issue.status === 'reopened').length
  const pastDue = queue.filter(
    (item) =>
      item.issue.due_at !== null &&
      new Date(item.issue.due_at).getTime() < now.getTime() &&
      item.issue.status !== 'reopened'
  ).length

  return (
    <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-900/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" aria-hidden="true" />
          <CardTitle>Supervisor queue</CardTitle>
        </div>
        <CardDescription>
          A working view of issues that need an owner, a due-date check, or another look. It is
          not a performance score.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Badge variant={unassigned > 0 ? 'amber' : 'outline'}>
            <UserX className="h-3.5 w-3.5" aria-hidden="true" />
            {unassigned} unassigned
          </Badge>
          <Badge variant={pastDue > 0 ? 'destructive' : 'outline'}>
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            {pastDue} past due
          </Badge>
          <Badge variant={reopened > 0 ? 'amber' : 'outline'}>
            {reopened} reopened
          </Badge>
        </div>

        {queue.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">
            Nothing needs a supervisor right now. New reports and reopened issues will appear
            here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-amber-200/70 dark:divide-amber-900/50" role="list">
            {queue.slice(0, 5).map((item) => (
              <li
                key={item.issue.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Link
                    to={`/issues/${item.issue.id}`}
                    className="font-medium text-text hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:text-primary-300"
                  >
                    {item.issue.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {item.areaName ?? 'No area'} · {queueReason(item, now, timezone)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <IssueStatusBadge status={item.issue.status} />
                  <Link
                    to={`/issues/${item.issue.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-300"
                  >
                    Open
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
