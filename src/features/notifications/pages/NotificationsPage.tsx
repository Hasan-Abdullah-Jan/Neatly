import { useCallback, useEffect, useState } from 'react'
import { Check, CheckCheck, Bell } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { useAuth } from '@contexts/AuthContext'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications'
import type { Notification } from '@/types/database'

const typeLabels: Record<Notification['type'], string> = {
  task_reminder: 'Task reminder',
  task_overdue: 'Task due',
  task_completed: 'Task update',
  issue_reported: 'Issue reported',
  issue_assigned: 'Issue assigned',
  issue_resolved: 'Issue update',
  supply_low: 'Supply low',
  supply_requested: 'Supply request',
  supply_fulfilled: 'Supply update',
  recommendation_new: 'Suggestion',
  mention: 'Mention',
  daily_summary: 'Daily summary',
  weekly_summary: 'Weekly recap',
}

export function NotificationsPage() {
  const { currentSpace } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadNotifications = useCallback(async () => {
    if (!currentSpace) {
      setNotifications([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      setNotifications(await listNotifications(currentSpace.id))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Notifications could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [currentSpace])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  const handleMarkRead = async (notification: Notification) => {
    if (notification.read_at) return
    setError(null)
    try {
      await markNotificationRead(notification.id)
      setNotifications((items) => items.map((item) => (
        item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
      )))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'The notification could not be marked read.')
    }
  }

  const handleMarkAllRead = async () => {
    if (!currentSpace) return
    setSaving(true)
    setError(null)
    try {
      await markAllNotificationsRead(currentSpace.id)
      const readAt = new Date().toISOString()
      setNotifications((items) => items.map((item) => (
        item.read_at ? item : { ...item, read_at: readAt }
      )))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Notifications could not be marked read.')
    } finally {
      setSaving(false)
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.read_at).length

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-heading-xl font-semibold text-text">Notifications</h1>
          <p className="mt-1 text-sm text-text-muted" aria-live="polite">
            {unreadCount === 0 ? 'You are all caught up.' : `${unreadCount} unread`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<CheckCheck className="h-4 w-4" />}
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0 || saving}
        >
          Mark all read
        </Button>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive-200 bg-destructive-50 p-3 text-sm text-destructive-text">
          {error}
        </p>
      )}

      {loading ? (
        <ul aria-label="Loading notifications" className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index} className="h-24 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </ul>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-text-muted" aria-hidden="true" />
          <h2 className="font-semibold text-text">No notifications yet</h2>
          <p className="mt-1 text-sm text-text-muted">Updates for this space will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Your notifications">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <article className={`flex items-start gap-3 rounded-xl border p-4 ${notification.read_at ? 'border-border bg-surface' : 'border-primary-200 bg-primary-50/70 dark:border-primary-800 dark:bg-primary-950/30'}`}>
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary-active" aria-hidden={notification.read_at ? 'true' : undefined}>
                  {!notification.read_at && <span className="sr-only">Unread: </span>}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-semibold text-text">{notification.title}</p>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                      {typeLabels[notification.type]}
                    </span>
                  </div>
                  {notification.body && <p className="mt-1 text-sm text-text-muted">{notification.body}</p>}
                  <time className="mt-2 block text-xs text-text-muted" dateTime={notification.created_at}>
                    {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.created_at))}
                  </time>
                </div>
                {!notification.read_at && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Mark ${notification.title} as read`}
                    onClick={() => void handleMarkRead(notification)}
                  >
                    <Check className="h-5 w-5" aria-hidden="true" />
                  </Button>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
