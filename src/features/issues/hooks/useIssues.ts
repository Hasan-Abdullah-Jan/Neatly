import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@contexts/AuthContext'
import { useToastHelpers } from '@components/ui/Toast'
import type {
  Area,
  Issue,
  IssuePattern,
  MembershipRole,
  Task,
} from '@/types/database'
import { fetchMembershipRole } from '@features/tasks/api/tasks'
import type { SpaceMember } from '@features/spaces/api/spaces'
import type { SpaceTeam } from '@features/spaces/api/teams'
import {
  addIssueComment,
  assignIssueRecord,
  attachIssuePhotos,
  convertIssueToTask,
  createIssueRecord,
  fetchIssueWorkspace,
  reopenIssueRecord,
  resolveIssueRecord,
  startIssueRecord,
  uploadIssuePhoto,
  verifyIssueRecord,
} from '../api/issues'
import {
  firstIssueMessage,
  issueReportSchema,
  type IssueAssignInput,
  type IssueReportInput,
} from '../api/schema'
import { isIssueManager } from '../lib/permissions'
import type { IssueListItem } from '../types'

export interface UseIssuesState {
  items: IssueListItem[]
  areas: Area[]
  members: SpaceMember[]
  teams: SpaceTeam[]
  patterns: IssuePattern[]
  role: MembershipRole | null
  teamIds: string[]
  loading: boolean
  error: string | null
  warning: string | null
  busyIds: string[]
  canManage: boolean
  reload: () => Promise<void>
  reportIssue: (input: IssueReportInput, photo: File | null) => Promise<Issue | null>
  assignIssue: (issueId: string, input: IssueAssignInput) => Promise<boolean>
  startIssue: (issueId: string, note: string) => Promise<boolean>
  resolveIssue: (issueId: string, note: string) => Promise<boolean>
  verifyIssue: (issueId: string, note: string) => Promise<boolean>
  reopenIssue: (issueId: string, note: string) => Promise<boolean>
  commentOnIssue: (issueId: string, comment: string) => Promise<boolean>
  convertToTask: (issueId: string) => Promise<Task | null>
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function useIssues(): UseIssuesState {
  const { currentSpace, user } = useAuth()
  const { showSuccess, showError } = useToastHelpers()
  const [items, setItems] = useState<IssueListItem[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [members, setMembers] = useState<SpaceMember[]>([])
  const [teams, setTeams] = useState<SpaceTeam[]>([])
  const [patterns, setPatterns] = useState<IssuePattern[]>([])
  const [role, setRole] = useState<MembershipRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [busyIds, setBusyIds] = useState<string[]>([])

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((current) =>
      busy ? [...new Set([...current, id])] : current.filter((value) => value !== id)
    )
  }, [])

  const load = useCallback(async () => {
    if (!currentSpace || !user) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      const [workspace, nextRole] = await Promise.all([
        fetchIssueWorkspace(currentSpace.id),
        fetchMembershipRole(currentSpace.id, user.id),
      ])
      setItems(workspace.items)
      setAreas(workspace.areas)
      setMembers(workspace.members)
      setTeams(workspace.teams)
      setPatterns(workspace.patterns)
      setRole(nextRole)
    } catch (loadError) {
      setError(messageOf(loadError, 'Could not load issues.'))
    } finally {
      setLoading(false)
    }
  }, [currentSpace, user])

  useEffect(() => {
    void load()
  }, [load])

  const teamIds = useMemo(() => {
    if (!user) return []
    return teams
      .filter((entry) => entry.memberIds.includes(user.id))
      .map((entry) => entry.team.id)
  }, [teams, user])

  const replaceIssue = useCallback((updated: Issue) => {
    setItems((current) =>
      current.map((item) =>
        item.issue.id === updated.id ? { ...item, issue: updated } : item
      )
    )
  }, [])

  const reportIssue = useCallback(
    async (input: IssueReportInput, photo: File | null): Promise<Issue | null> => {
      if (!currentSpace || !user) return null
      const parsed = issueReportSchema.safeParse(input)
      if (!parsed.success) {
        showError('Check the issue details', firstIssueMessage(parsed.error))
        return null
      }

      setBusy('report', true)
      try {
        const areaName = parsed.data.areaId
          ? areas.find((area) => area.id === parsed.data.areaId)?.name ?? null
          : null
        let created = await createIssueRecord(currentSpace.id, parsed.data, areaName)

        if (photo) {
          try {
            const path = await uploadIssuePhoto(currentSpace.id, created.id, photo)
            created = await attachIssuePhotos(created.id, [path])
          } catch (photoError) {
            showError(
              'Issue reported without the photo',
              messageOf(photoError, 'The photo could not be uploaded.')
            )
          }
        }

        const reporterName =
          members.find((member) => member.membership.user_id === user.id)?.profile?.full_name?.trim() ||
          'You'

        setItems((current) => [
          {
            issue: created,
            areaName,
            reporterName,
            assigneeName: null,
            teamName: null,
            assigneeLabel: 'Unassigned',
            followUpTaskName: null,
            pattern: null,
          },
          ...current,
        ])
        setWarning(null)
        showSuccess(
          'Issue reported',
          'It is in the issues list with a timestamp and a record of who reported it.'
        )
        return created
      } catch (createError) {
        showError('Could not report the issue', messageOf(createError, 'Try again in a moment.'))
        return null
      } finally {
        setBusy('report', false)
      }
    },
    [areas, currentSpace, members, setBusy, showError, showSuccess, user]
  )

  const assignIssue = useCallback(
    async (issueId: string, input: IssueAssignInput): Promise<boolean> => {
      if (!currentSpace) return false
      setBusy(issueId, true)
      try {
        await assignIssueRecord(issueId, input, currentSpace.timezone)
        await load()
        showSuccess('Issue assigned', 'The assignee, due date, and note are in the timeline.')
        return true
      } catch (assignError) {
        showError('Could not assign the issue', messageOf(assignError, 'Try again in a moment.'))
        return false
      } finally {
        setBusy(issueId, false)
      }
    },
    [currentSpace, load, setBusy, showError, showSuccess]
  )

  const runStatusAction = useCallback(
    async (
      issueId: string,
      optimisticStatus: Issue['status'],
      action: () => Promise<Issue>,
      successTitle: string,
      successMessage: string
    ): Promise<boolean> => {
      const previous = items.find((item) => item.issue.id === issueId)?.issue
      if (!previous) return false

      setBusy(issueId, true)
      replaceIssue({ ...previous, status: optimisticStatus })
      try {
        const updated = await action()
        replaceIssue(updated)
        showSuccess(successTitle, successMessage)
        return true
      } catch (actionError) {
        replaceIssue(previous)
        showError('Could not update the issue', messageOf(actionError, 'Try again in a moment.'))
        return false
      } finally {
        setBusy(issueId, false)
      }
    },
    [items, replaceIssue, setBusy, showError, showSuccess]
  )

  const startIssue = useCallback(
    (issueId: string, note: string) =>
      runStatusAction(
        issueId,
        'in_progress',
        () => startIssueRecord(issueId, note),
        'Work started',
        'The issue is now in progress.'
      ),
    [runStatusAction]
  )

  const resolveIssue = useCallback(
    (issueId: string, note: string) =>
      runStatusAction(
        issueId,
        'resolved',
        () => resolveIssueRecord(issueId, note),
        'Issue resolved',
        'The reporter or a supervisor can verify and close it.'
      ),
    [runStatusAction]
  )

  const verifyIssue = useCallback(
    (issueId: string, note: string) =>
      runStatusAction(
        issueId,
        'closed',
        () => verifyIssueRecord(issueId, note),
        'Issue verified and closed',
        'The resolution and verification are kept in the timeline.'
      ),
    [runStatusAction]
  )

  const reopenIssue = useCallback(
    (issueId: string, note: string) =>
      runStatusAction(
        issueId,
        'reopened',
        () => reopenIssueRecord(issueId, note),
        'Issue reopened',
        'The note explains what still needs attention.'
      ),
    [runStatusAction]
  )

  const commentOnIssue = useCallback(
    async (issueId: string, comment: string): Promise<boolean> => {
      setBusy(issueId, true)
      try {
        await addIssueComment(issueId, comment)
        showSuccess('Comment added', 'It is part of the issue timeline.')
        return true
      } catch (commentError) {
        showError('Could not add the comment', messageOf(commentError, 'Try again in a moment.'))
        return false
      } finally {
        setBusy(issueId, false)
      }
    },
    [setBusy, showError, showSuccess]
  )

  const convertToTask = useCallback(
    async (issueId: string): Promise<Task | null> => {
      setBusy(issueId, true)
      try {
        const task = await convertIssueToTask(issueId, null)
        showSuccess(
          'Follow-up task created',
          currentSpace?.type === 'personal'
            ? 'The issue was converted into a one-off task for Today.'
            : 'The issue stays open until it is resolved and verified.'
        )
        await load()
        return task
      } catch (convertError) {
        showError(
          'Could not create the follow-up task',
          messageOf(convertError, 'Try again in a moment.')
        )
        return null
      } finally {
        setBusy(issueId, false)
      }
    },
    [currentSpace, load, setBusy, showError, showSuccess]
  )

  return {
    items,
    areas,
    members,
    teams,
    patterns,
    role,
    teamIds,
    loading,
    error,
    warning,
    busyIds,
    canManage: isIssueManager(role),
    reload: load,
    reportIssue,
    assignIssue,
    startIssue,
    resolveIssue,
    verifyIssue,
    reopenIssue,
    commentOnIssue,
    convertToTask,
  }
}
