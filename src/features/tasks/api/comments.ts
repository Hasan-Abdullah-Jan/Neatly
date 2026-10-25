import { supabase } from '@lib/supabase'
import type { TaskComment } from '@/types/database'

export interface TaskCommentView extends TaskComment {
  authorName: string
}

export async function fetchTaskComments(instanceId: string): Promise<TaskCommentView[]> {
  const { data, error } = await supabase
    .from('task_comments')
    .select('*')
    .eq('task_instance_id', instanceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  const comments = (data ?? []) as TaskComment[]
  if (comments.length === 0) return []

  const userIds = [...new Set(comments.map((comment) => comment.user_id))]
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds)
  if (profileError) throw new Error(profileError.message)

  const names = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.full_name?.trim() || 'Member',
    ])
  )
  return comments.map((comment) => ({
    ...comment,
    authorName: names.get(comment.user_id) ?? 'Member',
  }))
}

export async function createTaskComment(instanceId: string, content: string): Promise<void> {
  const { data, error: authError } = await supabase.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!data.user) throw new Error('Sign in to add a comment.')

  const text = content.trim()
  if (!text || text.length > 2000) {
    throw new Error('Comments must contain 1 to 2,000 characters.')
  }

  const { error } = await supabase.from('task_comments').insert({
    task_instance_id: instanceId,
    user_id: data.user.id,
    content: text,
  })
  if (error) throw new Error(error.message)
}
