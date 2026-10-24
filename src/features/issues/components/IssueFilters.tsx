import { useMemo } from 'react'
import { Button } from '@components/ui/Button'
import { Select } from '@components/ui/Select'
import { X } from 'lucide-react'
import type { Area } from '@/types/database'
import type { SpaceMember } from '@features/spaces/api/spaces'
import type { SpaceTeam } from '@features/spaces/api/teams'
import {
  issueCategoryLabels,
  issueCategoryValues,
  issuePriorityLabels,
  issuePriorityValues,
  issueStatusLabels,
} from '../api/schema'
import { emptyIssueFilters, type IssueFilters as IssueFiltersValue } from '../types'

export function IssueFilters({
  filters,
  onChange,
  areas,
  members,
  teams,
}: {
  filters: IssueFiltersValue
  onChange: (next: IssueFiltersValue) => void
  areas: Area[]
  members: SpaceMember[]
  teams: SpaceTeam[]
}) {
  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'All statuses' },
      { value: 'open', label: 'Open issues' },
      ...Object.entries(issueStatusLabels).map(([value, label]) => ({ value, label })),
    ],
    []
  )

  const areaOptions = useMemo(
    () => [
      { value: 'all', label: 'All areas' },
      { value: 'none', label: 'No area' },
      ...areas.map((area) => ({
        value: area.id,
        label: area.active ? area.name : `${area.name} (archived)`,
      })),
    ],
    [areas]
  )

  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'All categories' },
      ...issueCategoryValues.map((value) => ({
        value,
        label: issueCategoryLabels[value],
      })),
    ],
    []
  )

  const priorityOptions = useMemo(
    () => [
      { value: 'all', label: 'All priorities' },
      ...issuePriorityValues.map((value) => ({
        value,
        label: issuePriorityLabels[value],
      })),
    ],
    []
  )

  const assigneeOptions = useMemo(
    () => [
      { value: 'all', label: 'Anyone' },
      { value: 'unassigned', label: 'Unassigned' },
      { value: 'external', label: 'External service' },
      ...teams.map((entry) => ({
        value: `team:${entry.team.id}`,
        label: `Team: ${entry.team.name}`,
      })),
      ...members.map((member) => ({
        value: `person:${member.membership.user_id}`,
        label: member.profile?.full_name?.trim() || 'Member',
      })),
    ],
    [members, teams]
  )

  const isFiltered =
    filters.status !== 'all' ||
    filters.areaId !== 'all' ||
    filters.category !== 'all' ||
    filters.priority !== 'all' ||
    filters.assignee !== 'all'

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          label="Status"
          options={statusOptions}
          value={filters.status}
          onChange={(value) =>
            onChange({ ...filters, status: value as IssueFiltersValue['status'] })
          }
        />
        <Select
          label="Area"
          options={areaOptions}
          value={filters.areaId}
          onChange={(value) => onChange({ ...filters, areaId: value })}
        />
        <Select
          label="Category"
          options={categoryOptions}
          value={filters.category}
          onChange={(value) =>
            onChange({ ...filters, category: value as IssueFiltersValue['category'] })
          }
        />
        <Select
          label="Priority"
          options={priorityOptions}
          value={filters.priority}
          onChange={(value) =>
            onChange({ ...filters, priority: value as IssueFiltersValue['priority'] })
          }
        />
        <Select
          label="Assignee"
          options={assigneeOptions}
          value={filters.assignee}
          onChange={(value) => onChange({ ...filters, assignee: value })}
        />
      </div>
      {isFiltered && (
        <div className="mt-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(emptyIssueFilters)}
            leftIcon={<X className="h-4 w-4" />}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  )
}
