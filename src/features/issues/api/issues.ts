import { fromZonedTime } from 'date-fns-tz'
import { supabase } from '@lib/supabase'
import type {
  Area,
  Issue,
  IssueCategory,
  IssueEvent,
  IssuePattern,
  IssuePriority,
  IssueStatus,
  Task,
} from '@/types/database'
import { fetchAreas } from '@features/areas/api/areas'
import { fetchSpaceMembers } from '@features/spaces/api/spaces'
import { fetchSpaceTeams, type SpaceTeam } from '@features/spaces/api/teams'
import type { IssueAssignInput, IssueReportInput } from './schema'
import {
  ISSUE_PHOTO_MAX_BYTES,
  ISSUE_PHOTO_TYPES,
  MAX_ISSUE_PHOTOS,
  deriveIssueTitle,
  isOpenIssueStatus,
  issueCategoryLabel,
} from './schema'
import type {
  IssueDetailData,
  IssueListItem,
  IssuePhoto,
  IssueTimelineEntry,
} from '../types'

const ISSUE_LIMIT = 500
const PATTERN_WINDOW_DAYS = 30

export function issuePatternKey(
  category: IssueCategory,
  customCategory: string | null
): string {
  return `${category}:${customCategory?.trim() ?? ''}`
}

function memberName(
  userId: string | null,
  names: Map<string, string>
): string | null {
  if (!userId) return null
  return names.get(userId) ?? 'Member'
}

function assigneeLabel(
  issue: Issue,
  names: Map<string, string>,
  teams: SpaceTeam[]
): string {
  if (issue.assigned_to) {
    return memberName(issue.assigned_to, names) ?? 'Member'
  }
  if (issue.assigned_team_id) {
    return teams.find((entry) => entry.team.id === issue.assigned_team_id)?.team.name ?? 'Team'
  }
  if (issue.external_service) return issue.external_service
  return 'Unassigned'
}

function buildNameMap(members: Awaited<ReturnType<typeof fetchSpaceMembers>>): Map<string, string> {
  return new Map(
    members.map((member) => [
      member.membership.user_id,
      member.profile?.full_name?.trim() || 'Member',
    ])
  )
}

function patternForIssue(
  issue: Issue,
  patterns: IssuePattern[]
): IssuePattern | null {
  if (!issue.area_id) return null
  const key = issuePatternKey(issue.category, issue.custom_category)
  return (
    patterns.find(
      (pattern) =>
        pattern.area_id === issue.area_id &&
        pattern.pattern_key === key &&
        pattern.window_days === PATTERN_WINDOW_DAYS
    ) ?? null
  )
}

export async function fetchIssuePatterns(
  spaceId: string,
  windowDays = PATTERN_WINDOW_DAYS
): Promise<IssuePattern[]> {
  await supabase.rpc('refresh_space_issue_patterns', {
    p_space_id: spaceId,
    p_window_days: windowDays,
  })

  const { data, error } = await supabase
    .from('issue_patterns')
    .select('*')
    .eq('space_id', spaceId)
    .eq('window_days', windowDays)
    .order('issue_count', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as IssuePattern[]
}

export interface IssueWorkspace {
  items: IssueListItem[]
  areas: Area[]
  members: Awaited<ReturnType<typeof fetchSpaceMembers>>
  teams: SpaceTeam[]
  patterns: IssuePattern[]
}

export async function fetchIssueWorkspace(spaceId: string): Promise<IssueWorkspace> {
  const [issueResult, areas, members, teams, patterns] = await Promise.all([
    supabase
      .from('issues')
      .select('*')
      .eq('space_id', spaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(ISSUE_LIMIT),
    fetchAreas(spaceId, true),
    fetchSpaceMembers(spaceId),
    fetchSpaceTeams(spaceId),
    fetchIssuePatterns(spaceId).catch(() => [] as IssuePattern[]),
  ])

  if (issueResult.error) throw new Error(issueResult.error.message)

  const issues = (issueResult.data ?? []) as Issue[]
  const names = buildNameMap(members)
  const areaById = new Map<string, Area>(areas.map((area) => [area.id, area]))
  const taskIds = issues
    .map((issue) => issue.follow_up_task_id)
    .filter((value): value is string => Boolean(value))

  let tasks: Array<Pick<Task, 'id' | 'name'>> = []
  if (taskIds.length > 0) {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, name')
      .in('id', taskIds)
      .is('deleted_at', null)
    if (error) throw new Error(error.message)
    tasks = (data ?? []) as Array<Pick<Task, 'id' | 'name'>>
  }
  const taskNameById = new Map(tasks.map((task) => [task.id, task.name]))

  return {
    items: issues.map((issue) => ({
      issue,
      areaName: issue.area_id ? areaById.get(issue.area_id)?.name ?? null : null,
      reporterName: memberName(issue.reported_by, names) ?? 'Member',
      assigneeName: issue.assigned_to ? memberName(issue.assigned_to, names) : null,
      teamName: issue.assigned_team_id
        ? teams.find((entry) => entry.team.id === issue.assigned_team_id)?.team.name ?? 'Team'
        : null,
      assigneeLabel: assigneeLabel(issue, names, teams),
      followUpTaskName: issue.follow_up_task_id
        ? taskNameById.get(issue.follow_up_task_id) ?? null
        : null,
      pattern: patternForIssue(issue, patterns),
    })),
    areas,
    members,
    teams,
    patterns,
  }
}

export async function fetchIssues(spaceId: string): Promise<IssueListItem[]> {
  const workspace = await fetchIssueWorkspace(spaceId)
  return workspace.items
}

async function signedIssuePhotos(paths: string[]): Promise<IssuePhoto[]> {
  if (paths.length === 0) return []

  try {
    const { data, error } = await supabase.storage
      .from('issue-photos')
      .createSignedUrls(paths, 60 * 60)

    if (error) {
      return paths.map((path) => ({ path, url: null }))
    }

    const urlByPath = new Map(
      (data ?? []).map((entry) => [entry.path, entry.signedUrl] as const)
    )
    return paths.map((path) => ({ path, url: urlByPath.get(path) ?? null }))
  } catch {
    return paths.map((path) => ({ path, url: null }))
  }
}

export async function fetchIssueDetail(issueId: string): Promise<IssueDetailData | null> {
  const { data: issueData, error } = await supabase
    .from('issues')
    .select('*')
    .eq('id', issueId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!issueData) return null

  const issue = issueData as Issue

  const [eventsResult, areaResult, members, teams, taskResult, patterns] = await Promise.all([
    supabase
      .from('issue_events')
      .select('*')
      .eq('issue_id', issue.id)
      .order('created_at', { ascending: true }),
    issue.area_id
      ? supabase.from('areas').select('*').eq('id', issue.area_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    fetchSpaceMembers(issue.space_id),
    fetchSpaceTeams(issue.space_id),
    issue.follow_up_task_id
      ? supabase
          .from('tasks')
          .select('id, name, is_active, is_one_off')
          .eq('id', issue.follow_up_task_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    fetchIssuePatterns(issue.space_id).catch(() => [] as IssuePattern[]),
  ])

  if (eventsResult.error) throw new Error(eventsResult.error.message)
  if (areaResult.error) throw new Error(areaResult.error.message)
  if (taskResult.error) throw new Error(taskResult.error.message)

  const names = buildNameMap(members)
  const events: IssueTimelineEntry[] = ((eventsResult.data ?? []) as IssueEvent[]).map(
    (event) => ({
      event,
      actorName: memberName(event.user_id, names) ?? 'Former member',
    })
  )

  return {
    issue,
    area: (areaResult.data as Area | null) ?? null,
    reporterName: memberName(issue.reported_by, names) ?? 'Member',
    assigneeName: issue.assigned_to ? memberName(issue.assigned_to, names) : null,
    teamName: issue.assigned_team_id
      ? teams.find((entry) => entry.team.id === issue.assigned_team_id)?.team.name ?? 'Team'
      : null,
    followUpTask: (taskResult.data as IssueDetailData['followUpTask']) ?? null,
    events,
    photos: await signedIssuePhotos(issue.photos),
    pattern: patternForIssue(issue, patterns),
    members,
    teams,
  }
}

export async function createIssueRecord(
  spaceId: string,
  input: IssueReportInput,
  areaName: string | null
): Promise<Issue> {
  const { data, error } = await supabase.rpc('create_issue', {
    p_space_id: spaceId,
    p_area_id: input.areaId,
    p_category: input.category,
    p_custom_category: input.category === 'custom' ? input.customCategory : null,
    p_title: deriveIssueTitle(input, areaName),
    p_description: input.description,
    p_priority: input.priority,
    p_photos: [],
    p_due_at: input.dueAt,
  })

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not report the issue.')
  }
  return data as Issue
}

export async function uploadIssuePhoto(
  spaceId: string,
  issueId: string,
  file: File
): Promise<string> {
  if (!ISSUE_PHOTO_TYPES.includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP photo.')
  }
  if (file.size > ISSUE_PHOTO_MAX_BYTES) {
    throw new Error('Choose a photo smaller than 5 MB.')
  }

  const extension =
    file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const path = `${spaceId}/${issueId}/${randomPart}.${extension}`

  const { error } = await supabase.storage.from('issue-photos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })

  if (error) throw new Error(error.message)
  return path
}

export async function attachIssuePhotos(issueId: string, paths: string[]): Promise<Issue> {
  const { data, error } = await supabase.rpc('attach_issue_photos', {
    p_issue_id: issueId,
    p_photos: paths.slice(0, MAX_ISSUE_PHOTOS),
  })

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not attach the photos.')
  }
  return data as Issue
}

export async function assignIssueRecord(
  issueId: string,
  input: IssueAssignInput,
  timezone: string
): Promise<Issue> {
  const dueAt = input.dueDate
    ? fromZonedTime(`${input.dueDate}T23:59:00`, timezone).toISOString()
    : null

  const { data, error } = await supabase.rpc('assign_issue', {
    p_issue_id: issueId,
    p_assignee_id: input.type === 'person' ? input.personId : null,
    p_team_id: input.type === 'team' ? input.teamId : null,
    p_external_service: input.type === 'external' ? input.externalService : null,
    p_due_at: dueAt,
    p_note: input.note || null,
    p_clear_due_date: dueAt === null,
  })

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not assign the issue.')
  }
  return data as Issue
}

export async function startIssueRecord(issueId: string, note: string): Promise<Issue> {
  const { data, error } = await supabase.rpc('start_issue', {
    p_issue_id: issueId,
    p_note: note || null,
  })
  if (error || !data) throw new Error(error?.message ?? 'Could not start the issue.')
  return data as Issue
}

export async function resolveIssueRecord(issueId: string, note: string): Promise<Issue> {
  const { data, error } = await supabase.rpc('resolve_issue', {
    p_issue_id: issueId,
    p_resolution_note: note,
  })
  if (error || !data) throw new Error(error?.message ?? 'Could not resolve the issue.')
  return data as Issue
}

export async function verifyIssueRecord(issueId: string, note: string): Promise<Issue> {
  const { data, error } = await supabase.rpc('verify_issue', {
    p_issue_id: issueId,
    p_note: note || null,
  })
  if (error || !data) throw new Error(error?.message ?? 'Could not verify the issue.')
  return data as Issue
}

export async function reopenIssueRecord(issueId: string, note: string): Promise<Issue> {
  const { data, error } = await supabase.rpc('reopen_issue', {
    p_issue_id: issueId,
    p_note: note,
  })
  if (error || !data) throw new Error(error?.message ?? 'Could not reopen the issue.')
  return data as Issue
}

export async function addIssueComment(
  issueId: string,
  comment: string
): Promise<IssueEvent> {
  const { data, error } = await supabase.rpc('add_issue_comment', {
    p_issue_id: issueId,
    p_comment: comment,
  })
  if (error || !data) throw new Error(error?.message ?? 'Could not add the comment.')
  return data as IssueEvent
}

export async function convertIssueToTask(
  issueId: string,
  dueAt: string | null
): Promise<Task> {
  const { data, error } = await supabase.rpc('convert_issue_to_task', {
    p_issue_id: issueId,
    p_due_at: dueAt,
  })
  if (error || !data) throw new Error(error?.message ?? 'Could not create the follow-up task.')
  return data as Task
}

export interface AreaIssueSummary {
  areaId: string
  openCount: number
  recurringCount: number
}

export async function fetchAreaIssueSummaries(
  spaceId: string
): Promise<AreaIssueSummary[]> {
  const { data, error } = await supabase
    .from('issues')
    .select('area_id, category, custom_category, status')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .in('status', ['reported', 'acknowledged', 'in_progress', 'reopened'])

  if (error) throw new Error(error.message)

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as Array<{
    area_id: string | null
    category: IssueCategory
    custom_category: string | null
    status: IssueStatus
  }>) {
    if (!row.area_id) continue
    counts.set(row.area_id, (counts.get(row.area_id) ?? 0) + 1)
  }

  const patterns = await fetchIssuePatterns(spaceId).catch(() => [] as IssuePattern[])
  const recurring = new Map<string, number>()
  for (const pattern of patterns) {
    if (!pattern.is_recurring) continue
    recurring.set(pattern.area_id, (recurring.get(pattern.area_id) ?? 0) + 1)
  }

  return [...new Set([...counts.keys(), ...recurring.keys()])].map((areaId) => ({
    areaId,
    openCount: counts.get(areaId) ?? 0,
    recurringCount: recurring.get(areaId) ?? 0,
  }))
}

export async function fetchOpenIssuesForArea(areaId: string): Promise<Issue[]> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('area_id', areaId)
    .is('deleted_at', null)
    .in('status', ['reported', 'acknowledged', 'in_progress', 'reopened'])
    .order('created_at', { ascending: false })
    .limit(25)

  if (error) throw new Error(error.message)
  return (data ?? []) as Issue[]
}

export function issueStatusIsOpen(status: IssueStatus): boolean {
  return isOpenIssueStatus(status)
}

export function issueCategoryName(issue: Issue): string {
  return issueCategoryLabel(issue.category, issue.custom_category)
}

export function issuePriorityName(priority: IssuePriority): string {
  return priority
}
