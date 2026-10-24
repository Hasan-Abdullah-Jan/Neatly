import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatInTimeZone } from 'date-fns-tz'
import { useAuth } from '@contexts/AuthContext'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@components/ui/Card'
import { EmptyState } from '@components/ui/EmptyState'
import { ErrorState } from '@components/ui/ErrorState'
import { Textarea } from '@components/ui/Input'
import { Skeleton } from '@components/ui/Skeleton'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle,
  ImagePlus,
  Link2,
  MapPin,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react'
import type { IssuePhoto } from '../types'
import {
  ISSUE_PHOTO_GUIDANCE,
  ISSUE_PHOTO_MAX_BYTES,
  ISSUE_PHOTO_TYPES,
  MAX_ISSUE_PHOTOS,
  issueCategoryLabel,
  issueCommentSchema,
} from '../api/schema'
import { useIssueDetail } from '../hooks/useIssueDetail'
import { canAttachIssuePhotos } from '../lib/permissions'
import { AssignIssueModal } from '../components/AssignIssueModal'
import { IssueActionModal, type IssueActionMode } from '../components/IssueActionModal'
import { IssueActions } from '../components/IssueActions'
import { IssuePriorityBadge } from '../components/IssuePriorityBadge'
import { IssueStatusBadge } from '../components/IssueStatusBadge'
import { IssueTimeline } from '../components/IssueTimeline'

function photoValidationError(file: File): string | null {
  if (!ISSUE_PHOTO_TYPES.includes(file.type)) {
    return 'Choose a JPEG, PNG, or WebP photo.'
  }
  if (file.size > ISSUE_PHOTO_MAX_BYTES) {
    return 'Choose a photo smaller than 5 MB.'
  }
  return null
}

function PhotoGallery({ photos }: { photos: IssuePhoto[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((photo, index) => (
        <div
          key={photo.path}
          className="overflow-hidden rounded-lg border border-border bg-background"
        >
          {photo.url ? (
            <a
              href={photo.url}
              target="_blank"
              rel="noreferrer"
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <img
                src={photo.url}
                alt={`Issue photo ${index + 1}`}
                className="h-36 w-full object-cover"
                loading="lazy"
              />
            </a>
          ) : (
            <div className="flex h-36 items-center justify-center p-3 text-center text-xs text-text-muted">
              This photo is not available right now.
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function IssueDetailPage() {
  const { issueId } = useParams<{ issueId: string }>()
  const navigate = useNavigate()
  const { currentSpace, user } = useAuth()
  const {
    detail,
    role,
    teamIds,
    loading,
    error,
    busy,
    reload,
    assignIssue,
    startIssue,
    resolveIssue,
    verifyIssue,
    reopenIssue,
    commentOnIssue,
    convertToTask,
    addPhotos,
  } = useIssueDetail(issueId)

  const [assignOpen, setAssignOpen] = useState(false)
  const [action, setAction] = useState<IssueActionMode | null>(null)
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const timezone = currentSpace?.timezone ?? 'UTC'
  const photosEnabled = currentSpace?.settings?.photosEnabled === true

  const handleActionNote = useCallback(
    async (note: string): Promise<boolean> => {
      if (!action) return false
      switch (action) {
        case 'start':
          return startIssue(note)
        case 'resolve':
          return resolveIssue(note)
        case 'verify':
          return verifyIssue(note)
        case 'reopen':
          return reopenIssue(note)
      }
    },
    [action, reopenIssue, resolveIssue, startIssue, verifyIssue]
  )

  const handleComment = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = issueCommentSchema.safeParse(comment)
    if (!parsed.success) {
      setCommentError(parsed.error.issues[0]?.message ?? 'Write a comment first.')
      return
    }

    setCommentError(null)
    const saved = await commentOnIssue(parsed.data)
    if (saved) setComment('')
  }

  const handlePhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0 || !detail) return

    const remaining = MAX_ISSUE_PHOTOS - detail.issue.photos.length
    if (remaining <= 0) {
      setPhotoError(`You can attach up to ${MAX_ISSUE_PHOTOS} photos.`)
      return
    }
    if (files.length > remaining) {
      setPhotoError(`Choose up to ${remaining} more ${remaining === 1 ? 'photo' : 'photos'}.`)
      return
    }

    for (const file of files) {
      const validationError = photoValidationError(file)
      if (validationError) {
        setPhotoError(validationError)
        return
      }
    }

    setPhotoError(null)
    await addPhotos(files)
  }

  if (!currentSpace) return null

  if (loading) {
    return (
      <div className="space-y-6" aria-label="Loading issue">
        <Skeleton width="25%" />
        <Skeleton width="55%" />
        <Card>
          <Skeleton lines={4} />
        </Card>
        <Card>
          <Skeleton lines={5} />
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load this issue"
        message={error}
        onRetry={() => void reload()}
      />
    )
  }

  if (!detail) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-8 w-8" aria-hidden="true" />}
        title="Issue not found"
        description="It may have been removed or belong to a different space."
        action={{ label: 'Back to issues', onClick: () => navigate('/issues') }}
        secondaryAction={{ label: 'Go to today', onClick: () => navigate('/today') }}
      />
    )
  }

  const { issue } = detail
  const category = issueCategoryLabel(issue.category, issue.custom_category)
  const resolutionEvent = detail.events
    .slice()
    .reverse()
    .find((entry) => entry.event.action === 'resolved')
  const verificationEvent = detail.events
    .slice()
    .reverse()
    .find((entry) => entry.event.action === 'verified')
  const assigneeIcon =
    issue.assigned_team_id !== null ? (
      <Users className="h-3.5 w-3.5" aria-hidden="true" />
    ) : issue.external_service ? (
      <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
    ) : (
      <User className="h-3.5 w-3.5" aria-hidden="true" />
    )
  const canAttachPhotos =
    photosEnabled &&
    canAttachIssuePhotos({ issue, userId: user?.id ?? null, role, teamIds }) &&
    issue.photos.length < MAX_ISSUE_PHOTOS
  const hasResolution = Boolean(issue.resolution_note || issue.verification_note)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={issue.area_id ? `/issues?areaId=${issue.area_id}` : '/issues'}
          className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to issues
        </Link>
        {issue.area_id && detail.area && (
          <Link
            to={`/areas/${issue.area_id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {detail.area.name}
          </Link>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <IssueStatusBadge status={issue.status} />
          <IssuePriorityBadge priority={issue.priority} />
          {issue.reopen_count > 0 && (
            <Badge variant="outline" size="sm">
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Reopened {issue.reopen_count === 1 ? 'once' : `${issue.reopen_count} times`}
            </Badge>
          )}
          {detail.pattern?.is_recurring && (
            <Badge variant="amber" size="sm">
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Repeated pattern in this area
            </Badge>
          )}
        </div>
        <h1 className="mt-2 text-display-sm font-semibold text-text">{issue.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {detail.area?.name ?? 'No specific area'}
          </span>
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {category}
          </span>
          <span className="inline-flex items-center gap-1">
            {assigneeIcon}
            {issue.assigned_to
              ? detail.assigneeName ?? 'Member'
              : issue.assigned_team_id
                ? detail.teamName ?? 'Team'
                : issue.external_service ?? 'Unassigned'}
          </span>
          <span>
            Reported by {detail.reporterName} on{' '}
            {formatInTimeZone(new Date(issue.created_at), timezone, 'MMM d, yyyy · HH:mm')}
          </span>
        </div>
        {issue.due_at && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-muted">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            Due {formatInTimeZone(new Date(issue.due_at), timezone, 'MMM d, yyyy')}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              {issue.description ? (
                <p className="whitespace-pre-wrap text-sm text-text">{issue.description}</p>
              ) : (
                <p className="text-sm text-text-muted">
                  No extra description was added. The title is the report.
                </p>
              )}
            </CardContent>
          </Card>

          {hasResolution && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-success-600 dark:text-success-400" aria-hidden="true" />
                  <CardTitle>Resolution and verification</CardTitle>
                </div>
                <CardDescription>
                  These notes are part of the record. Reopening keeps them in the timeline.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {issue.resolution_note && (
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                      Resolution
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-text">
                      {issue.resolution_note}
                    </p>
                    {issue.resolved_at && (
                      <p className="mt-2 text-xs text-text-muted">
                        {resolutionEvent?.actorName ?? 'A space member'} ·{' '}
                        {formatInTimeZone(new Date(issue.resolved_at), timezone, 'MMM d, yyyy · HH:mm')}
                      </p>
                    )}
                  </div>
                )}
                {issue.verification_note && (
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                      Verification
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-text">
                      {issue.verification_note}
                    </p>
                    {issue.verified_at && (
                      <p className="mt-2 text-xs text-text-muted">
                        {verificationEvent?.actorName ?? 'A space member'} ·{' '}
                        {formatInTimeZone(new Date(issue.verified_at), timezone, 'MMM d, yyyy · HH:mm')}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {detail.photos.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-5 w-5 text-text-muted" aria-hidden="true" />
                  <CardTitle>Photos</CardTitle>
                </div>
                <CardDescription>
                  Photos are optional. Only members of this space can open them.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PhotoGallery photos={detail.photos} />
              </CardContent>
            </Card>
          )}

          {canAttachPhotos && (
            <Card>
              <CardHeader>
                <CardTitle>Add photos</CardTitle>
                <CardDescription>{ISSUE_PHOTO_GUIDANCE}</CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ISSUE_PHOTO_TYPES.join(',')}
                  multiple
                  className="sr-only"
                  onChange={handlePhotos}
                  aria-label="Choose issue photos"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    leftIcon={<ImagePlus className="h-4 w-4" />}
                  >
                    Choose photos
                  </Button>
                  <span className="text-xs text-text-muted">
                    {issue.photos.length} of {MAX_ISSUE_PHOTOS} attached. JPEG, PNG, or WebP up
                    to 5 MB each.
                  </span>
                </div>
                {photoError && (
                  <p className="mt-2 text-sm text-destructive-600 dark:text-destructive-400" role="alert">
                    {photoError}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-text-muted" aria-hidden="true" />
                <CardTitle>Timeline</CardTitle>
              </div>
              <CardDescription>
                Every status change keeps who made it, when, and the note they added. Comments
                live in the same timeline.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IssueTimeline entries={detail.events} timezone={timezone} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent>
              <IssueActions
                issue={issue}
                role={role}
                userId={user?.id ?? null}
                teamIds={teamIds}
                spaceType={currentSpace.type}
                busy={busy}
                onAssign={() => setAssignOpen(true)}
                onAction={setAction}
                onConvert={() => void convertToTask(null)}
              />
            </CardContent>
          </Card>

          {detail.followUpTask && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-text-muted" aria-hidden="true" />
                  <CardTitle>Follow-up task</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-text">{detail.followUpTask.name}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {detail.followUpTask.is_one_off
                    ? 'One-off task created from this issue.'
                    : 'Task linked to this issue.'}
                  {detail.followUpTask.is_active ? ' It is active.' : ' It is paused.'}
                </p>
                <Link
                  to="/tasks"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-300"
                >
                  Open tasks
                  <ArrowLeft className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Add a comment</CardTitle>
              <CardDescription>
                Comments are visible to everyone in the space and stay in the timeline.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleComment} className="space-y-3" noValidate>
                <Textarea
                  label="Comment"
                  value={comment}
                  onChange={(value) => {
                    setComment(value)
                    setCommentError(null)
                  }}
                  error={commentError ?? undefined}
                  rows={3}
                  maxLength={2000}
                  placeholder="Share an update or ask a question."
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" loading={busy} disabled={!comment.trim()}>
                    Add comment
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-text-muted" aria-hidden="true" />
                <CardTitle>Record</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-text-muted">Reported</dt>
                  <dd className="text-right text-text">
                    {formatInTimeZone(new Date(issue.created_at), timezone, 'MMM d, yyyy · HH:mm')}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-text-muted">Last updated</dt>
                  <dd className="text-right text-text">
                    {formatInTimeZone(new Date(issue.updated_at), timezone, 'MMM d, yyyy · HH:mm')}
                  </dd>
                </div>
                {issue.closed_at && (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-text-muted">Closed</dt>
                    <dd className="text-right text-text">
                      {formatInTimeZone(new Date(issue.closed_at), timezone, 'MMM d, yyyy · HH:mm')}
                    </dd>
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-text-muted">Reopen count</dt>
                  <dd className="text-right text-text">{issue.reopen_count}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-text-muted">Pattern window</dt>
                  <dd className="text-right text-text">
                    {detail.pattern
                      ? `${detail.pattern.issue_count} in the last ${detail.pattern.window_days} days`
                      : 'No pattern recorded'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <p className="text-xs text-text-muted">
            Local time: {timezone.replace('_', ' ')}. Status and counts come from stored issue
            records, never from photos or assumptions.
          </p>
        </div>
      </div>

      {assignOpen && (
        <AssignIssueModal
          isOpen
          issue={issue}
          members={detail.members}
          teams={detail.teams}
          timezone={timezone}
          busy={busy}
          onClose={() => setAssignOpen(false)}
          onSubmit={assignIssue}
        />
      )}

      <IssueActionModal
        isOpen={action !== null}
        mode={action ?? 'start'}
        busy={busy}
        onClose={() => setAction(null)}
        onSubmit={handleActionNote}
      />
    </div>
  )
}
