import { supabase } from '@lib/supabase'
import type { Json, Notification, NotificationPreference, NotificationType } from '@/types/database'

export async function listNotifications(spaceId: string, limit = 100): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

export async function getUnreadNotificationCount(spaceId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('space_id', spaceId)
    .is('read_at', null)

  if (error) throw error
  return count ?? 0
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)

  if (error) throw error
}

export async function markAllNotificationsRead(spaceId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('space_id', spaceId)
    .is('read_at', null)

  if (error) throw error
}

export async function getNotificationPreferences(
  spaceId: string,
  userId: string
): Promise<NotificationPreference | null> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('space_id', spaceId)
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

export async function upsertNotificationPreferences(
  spaceId: string,
  preferences: Partial<NotificationPreference>
): Promise<NotificationPreference> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert({
      ...preferences,
      space_id: spaceId,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createNotification(
    spaceId: string,
    type: NotificationType,
    title: string,
    body: string,
    userId: string | null = null,
    metadata: Record<string, Json> = {}
): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    if (userId && userId !== user.id) {
      throw new Error('Notifications for other people must be created by a trusted server workflow.')
    }

    const { error } = await supabase.from('notifications').insert({
      space_id: spaceId,
      user_id: user.id,
      type,
      title,
      body,
      metadata,
    })

    if (error) throw error
}

export async function shouldSendNotification(
  spaceId: string,
  userId: string,
  type: string
): Promise<boolean> {
  const prefs = await getNotificationPreferences(spaceId, userId)
  if (!prefs) return true // Default to enabled

  const typeMap: Record<string, keyof NotificationPreference> = {
    task_reminder: 'task_reminders',
    task_overdue: 'task_overdue',
    task_completed: 'task_completed',
    issue_reported: 'issue_reported',
    issue_assigned: 'issue_assigned',
    issue_resolved: 'issue_resolved',
    supply_low: 'supply_low',
    supply_requested: 'supply_requested',
    supply_fulfilled: 'supply_fulfilled',
    recommendation_new: 'recommendation_new',
    mention: 'mention',
    daily_summary: 'daily_summary',
    weekly_summary: 'weekly_summary',
  }

  const field = typeMap[type]
  if (!field) return true

  const value = prefs[field]
  return typeof value === 'boolean' ? value : true
}

function parseQuietHour(value: string | null | undefined): number | null {
  if (!value) return null

  const [startHourString, startMinuteString] = value.split(':')
  const startHour = Number(startHourString)
  const startMinute = Number(startMinuteString)

  if (!Number.isFinite(startHour) || !Number.isFinite(startMinute)) {
    return null
  }

  return startHour * 60 + startMinute
}

export async function isQuietHours(spaceId: string, userId: string): Promise<boolean> {
  const prefs = await getNotificationPreferences(spaceId, userId)
  if (!prefs || !prefs.quiet_hours_start || !prefs.quiet_hours_end) {
    return false
  }

  const now = new Date()
  const currentTime = now.getHours() * 60 + now.getMinutes()

  const startTime = parseQuietHour(prefs.quiet_hours_start)
  const endTime = parseQuietHour(prefs.quiet_hours_end)

  if (startTime === null || endTime === null) {
    return false
  }

  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime < endTime
  }

  // Overnight quiet hours (e.g., 22:00 to 07:00)
  return currentTime >= startTime || currentTime < endTime
}
