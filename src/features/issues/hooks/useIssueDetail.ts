import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@contexts/AuthContext'
import { useToastHelpers } from '@components/ui/Toast'
import type { MembershipRole, Task } from '@/types/database'
import { fetchMembershipRole } from '@features/tasks/api/tasks'
import {
  addIssueComment,
  assignIssueRecord,
  attachIssuePhotos,
  convertIssueToTask,
  fetchIssueDetail,
  reopenIssueRecord,
  resolveIssueRecord,
  startIssueRecord,
  uploadIssuePhoto,
  verifyIssueRecord,
} from '../api/issues'
import type { IssueAssignInput } from '../api/schema'
import { isIssueManager } from '../lib/permissions'
import type { IssueDetailData } from '../types'

export interface UseIssueDetailState {
  detail: IssueDetailData | null
  role: MembershipRole | null
  teamIds: string[]
  loading: boolean
  error: string | null
  busy: boolean
  canManage: boolean
  reload: () => Promise<void>
  assignIssue: (input: IssueAssignInput) => Promise<boolean>
  startIssue: (note: string) => Promise<boolean>
  resolveIssue: (note: string) => Promise<boolean>
  verifyIssue: (note: string) => Promise<boolean>
  reopenIssue: (note: string) => Promise<boolean>
  commentOnIssue: (comment: string) => Promise<boolean>
  convertToTask: (dueAt: string | null) => Promise<Task | null>
  addPhotos: (files: File[]) => Promise<boolean>
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function useIssueDetail(issueId: string | undefined): UseIssueDetailState {
  const { currentSpace, user } = useAuth()
  const { showSuccess, showError } = useToastHelpers()
  const [detail, setDetail] = useState<IssueDetailData | null>(null)
  const [role, setRole] = useState<MembershipRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!issueId || !currentSpace || !user) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [nextDetail, nextRole] = await Promise.all([
        fetchIssueDetail(issueId),
        fetchMembershipRole(currentSpace.id, user.id),
      ])
      if (nextDetail && nextDetail.issue.space_id !== currentSpace.id) {
        setDetail(null)
      } else {
        setDetail(nextDetail)
      }
      setRole(nextRole)
    } catch (loadError) {
      setError(messageOf(loadError, 'Could not load this issue.'))
    } finally {
      setLoading(false)
    }
  }, [currentSpace, issueId, user])

  useEffect(() => {
    void load()
  }, [load])

  const teamIds = useMemo(() => {
    if (!detail || !user) return []
    return detail.teams
      .filter((entry) => entry.memberIds.includes(user.id))
      .map((entry) => entry.team.id)
  }, [detail, user])

  const runAction = useCallback(
    async (
      action: () => Promise<unknown>,
      successTitle: string,
      successMessage: string
    ): Promise<boolean> => {
      setBusy(true)
      try {
        await action()
        await load()
        showSuccess(successTitle, successMessage)
        return true
      } catch (actionError) {
        showError('Could not update the issue', messageOf(actionError, 'Try again in a moment.'))
        return false
      } finally {
        setBusy(false)
      }
    },
    [load, showError, showSuccess]
  )

  const assignIssue = useCallback(
    (input: IssueAssignInput) => {
      if (!currentSpace || !detail) return Promise.resolve(false)
      return runAction(
        () => assignIssueRecord(detail.issue.id, input, currentSpace.timezone),
        'Issue assigned',
        'The assignee, due date, and note are in the timeline.'
      )
    },
    [currentSpace, detail, runAction]
  )

  const startIssue = useCallback(
    (note: string) => {
      if (!detail) return Promise.resolve(false)
      return runAction(
        () => startIssueRecord(detail.issue.id, note),
        'Work started',
        'The issue is now in progress.'
      )
    },
    [detail, runAction]
  )

  const resolveIssue = useCallback(
    (note: string) => {
      if (!detail) return Promise.resolve(false)
      return runAction(
        () => resolveIssueRecord(detail.issue.id, note),
        'Issue resolved',
        'The reporter or a supervisor can verify and close it.'
      )
    },
    [detail, runAction]
  )

  const verifyIssue = useCallback(
    (note: string) => {
      if (!detail) return Promise.resolve(false)
      return runAction(
        () => verifyIssueRecord(detail.issue.id, note),
        'Issue verified and closed',
        'The resolution and verification are kept in the timeline.'
      )
    },
    [detail, runAction]
  )

  const reopenIssue = useCallback(
    (note: string) => {
      if (!detail) return Promise.resolve(false)
      return runAction(
        () => reopenIssueRecord(detail.issue.id, note),
        'Issue reopened',
        'The note explains what still needs attention.'
      )
    },
    [detail, runAction]
  )

  const commentOnIssue = useCallback(
    (comment: string) => {
      if (!detail) return Promise.resolve(false)
      return runAction(
        () => addIssueComment(detail.issue.id, comment),
        'Comment added',
        'It is part of the issue timeline.'
      )
    },
    [detail, runAction]
  )

  const convertToTask = useCallback(
    async (dueAt: string | null): Promise<Task | null> => {
      if (!detail || !currentSpace) return null
      setBusy(true)
      try {
        const task = await convertIssueToTask(detail.issue.id, dueAt)
        await load()
        showSuccess(
          'Follow-up task created',
          currentSpace.type === 'personal'
            ? 'The issue was converted into a one-off task for Today.'
            : 'The issue stays open until it is resolved and verified.'
        )
        return task
      } catch (convertError) {
        showError(
          'Could not create the follow-up task',
          messageOf(convertError, 'Try again in a moment.')
        )
        return null
      } finally {
        setBusy(false)
      }
    },
    [currentSpace, detail, load, showError, showSuccess]
  )

  const addPhotos = useCallback(
    async (files: File[]): Promise<boolean> => {
      if (!detail || !currentSpace) return false
      setBusy(true)
      try {
        const paths = [...detail.issue.photos]
        for (const file of files) {
          paths.push(await uploadIssuePhoto(currentSpace.id, detail.issue.id, file))
        }
        await attachIssuePhotos(detail.issue.id, paths)
        await load()
        showSuccess('Photos attached', 'Only space members can open these photos.')
        return true
      } catch (photoError) {
        showError('Could not attach the photos', messageOf(photoError, 'Try again in a moment.'))
        return false
      } finally {
        setBusy(false)
      }
    },
    [currentSpace, detail, load, showError, showSuccess]
  )

  return {
    detail,
    role,
    teamIds,
    loading,
    error,
    busy,
    canManage: isIssueManager(role),
    reload: load,
    assignIssue,
    startIssue,
    resolveIssue,
    verifyIssue,
    reopenIssue,
    commentOnIssue,
    convertToTask,
    addPhotos,
  }
}
