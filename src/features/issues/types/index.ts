import type {
  Area,
  Issue,
  IssueEvent,
  IssuePattern,
  Task,
} from '@/types/database'
import type { SpaceMember } from '@features/spaces/api/spaces'
import type { SpaceTeam } from '@features/spaces/api/teams'

export interface IssueListItem {
  issue: Issue
  areaName: string | null
  reporterName: string
  assigneeName: string | null
  teamName: string | null
  assigneeLabel: string
  followUpTaskName: string | null
  pattern: IssuePattern | null
}

export interface IssueTimelineEntry {
  event: IssueEvent
  actorName: string
}

export interface IssuePhoto {
  path: string
  url: string | null
}

export interface IssueDetailData {
  issue: Issue
  area: Area | null
  reporterName: string
  assigneeName: string | null
  teamName: string | null
  followUpTask: Pick<Task, 'id' | 'name' | 'is_active' | 'is_one_off'> | null
  events: IssueTimelineEntry[]
  photos: IssuePhoto[]
  pattern: IssuePattern | null
  members: SpaceMember[]
  teams: SpaceTeam[]
}

export interface IssueFilters {
  status: 'all' | 'open' | Issue['status']
  areaId: 'all' | 'none' | string
  category: 'all' | Issue['category']
  priority: 'all' | Issue['priority']
  assignee: 'all' | 'unassigned' | 'external' | string
}

export const emptyIssueFilters: IssueFilters = {
  status: 'all',
  areaId: 'all',
  category: 'all',
  priority: 'all',
  assignee: 'all',
}
