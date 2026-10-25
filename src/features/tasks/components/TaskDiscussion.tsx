import { useState } from 'react'
import { Button } from '@components/ui/Button'
import { Textarea } from '@components/ui/Input'
import { createTaskComment, fetchTaskComments, type TaskCommentView } from '../api/comments'

export function TaskDiscussion({ instanceId }: { instanceId: string }) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<TaskCommentView[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = async () => {
    const nextOpen = !open
    setOpen(nextOpen)
    if (!nextOpen || comments.length > 0) return
    setLoading(true)
    setError(null)
    try {
      setComments(await fetchTaskComments(instanceId))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load comments.')
    } finally {
      setLoading(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createTaskComment(instanceId, content)
      setContent('')
      setComments(await fetchTaskComments(instanceId))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not add your comment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <Button type="button" variant="ghost" size="sm" onClick={() => void toggle()}>
        {open ? 'Hide comments' : `Comments${comments.length ? ` (${comments.length})` : ''}`}
      </Button>
      {open && (
        <div className="mt-2 space-y-3">
          {loading ? (
            <p className="text-sm text-text-muted" role="status">Loading comments…</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
                  <p className="font-medium text-text">{comment.authorName}</p>
                  <p className="mt-1 whitespace-pre-wrap text-text-muted">{comment.content}</p>
                  <time className="mt-1 block text-xs text-text-muted" dateTime={comment.created_at}>
                    {new Date(comment.created_at).toLocaleString()}
                  </time>
                </li>
              ))}
              {comments.length === 0 && (
                <li className="text-sm text-text-muted">No comments yet.</li>
              )}
            </ul>
          )}
          <form onSubmit={submit} className="space-y-2">
            <Textarea
              label="Add a comment"
              value={content}
              onChange={setContent}
              rows={2}
              maxLength={2000}
            />
            <Button type="submit" size="sm" loading={saving} disabled={!content.trim()}>
              Add comment
            </Button>
          </form>
          {error && <p className="text-sm text-destructive-600" role="alert">{error}</p>}
        </div>
      )}
    </div>
  )
}
