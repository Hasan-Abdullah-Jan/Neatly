import { supabase } from '@lib/supabase'
import type {
  AwayType,
  Invitation,
  MemberAway,
  MembershipRole,
  SwapStatus,
  TaskAssignment,
  TaskAssignmentInsert,
  TaskInstance,
  TaskSwap,
  Team,
  TeamMember,
} from '@/types/database'

function requireData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message)
  if (data === null) throw new Error('The operation returned no record.')
  return data
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Not authenticated')
  return data.user.id
}

export async function getTeams(spaceId: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createTeam(
  spaceId: string,
  name: string,
  description: string | null,
  color: string | null
): Promise<Team> {
  const { data, error } = await supabase.rpc('create_team', {
    p_space_id: spaceId,
    p_name: name,
    p_description: description,
    p_color: color,
  })
  return requireData(data, error)
}

export async function updateTeam(
  id: string,
  updates: { name: string; description: string | null; color: string | null }
): Promise<Team> {
  const { data, error } = await supabase.rpc('update_team', {
    p_team_id: id,
    p_name: updates.name,
    p_description: updates.description,
    p_color: updates.color,
  })
  return requireData(data, error)
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase
    .from('teams')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
    .is('deleted_at', null)
    .order('joined_at')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function addTeamMember(
  teamId: string,
  userId: string,
  role: 'lead' | 'member' = 'member'
): Promise<TeamMember> {
  const { data, error } = await supabase.rpc('add_team_member', {
    p_team_id: teamId,
    p_user_id: userId,
    p_role: role,
  })
  return requireData(data, error)
}

export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .update({ deleted_at: new Date().toISOString() })
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}

export async function getTaskAssignments(spaceId: string): Promise<TaskAssignment[]> {
  const { data, error } = await supabase
    .from('task_assignments')
    .select('*')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('assigned_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createTaskAssignment(
  assignment: Omit<TaskAssignmentInsert, 'assigned_by' | 'assigned_at' | 'space_id'>
): Promise<TaskAssignment> {
  const assignedBy = await currentUserId()
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('space_id')
    .eq('id', assignment.task_id)
    .single()
  if (taskError) throw new Error(taskError.message)

  const { data, error } = await supabase
    .from('task_assignments')
    .insert({ ...assignment, space_id: task.space_id, assigned_by: assignedBy })
    .select('*')
    .single()
  return requireData(data, error)
}

export async function getTaskRotationMemberIds(taskId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('task_assignments')
    .select('user_id')
    .eq('task_id', taskId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('rotation_index', { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.user_id)
}

export async function replaceTaskRotationMembers(
  taskId: string,
  userIds: string[]
): Promise<void> {
  const { error } = await supabase.rpc('replace_task_rotation_members', {
    p_task_id: taskId,
    p_user_ids: [...new Set(userIds)],
  })
  if (error) throw new Error(error.message)
}

export interface TaskSwapWithInstance {
  swap: TaskSwap
  instance: TaskInstance
}

export async function getTaskSwaps(spaceId: string): Promise<TaskSwapWithInstance[]> {
  const { data: instances, error: instanceError } = await supabase
    .from('task_instances')
    .select('id')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
  if (instanceError) throw new Error(instanceError.message)
  const instanceIds = (instances ?? []).map((instance) => instance.id)
  if (instanceIds.length === 0) return []

  const { data: swaps, error } = await supabase
    .from('task_swaps')
    .select('*')
    .in('task_instance_id', instanceIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  const rows = swaps ?? []
  if (rows.length === 0) return []
  const { data: taskInstances, error: taskInstanceError } = await supabase
    .from('task_instances')
    .select('*')
    .in('id', rows.map((swap) => swap.task_instance_id))
  if (taskInstanceError) throw new Error(taskInstanceError.message)
  const instanceById = new Map(
    ((taskInstances ?? []) as TaskInstance[]).map((instance) => [instance.id, instance])
  )
  return rows.flatMap((swap) => {
    const instance = instanceById.get(swap.task_instance_id)
    return instance ? [{ swap, instance }] : []
  })
}

export async function createTaskSwap(
  instanceId: string,
  requestedTo: string | null,
  reason: string | null
): Promise<TaskSwap> {
  const { data, error } = await supabase.rpc('request_swap', {
    p_task_instance_id: instanceId,
    p_requested_to: requestedTo,
    p_reason: reason,
  })
  return requireData(data, error)
}

export async function respondToSwap(
  swapId: string,
  response: Extract<SwapStatus, 'accepted' | 'declined'>
): Promise<TaskSwap> {
  const { data, error } = await supabase.rpc('respond_swap', {
    p_swap_id: swapId,
    p_response: response,
  })
  return requireData(data, error)
}

export async function cancelSwap(swapId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_swap', { p_swap_id: swapId })
  if (error) throw new Error(error.message)
}

export async function getAwayPeriods(spaceId: string): Promise<MemberAway[]> {
  const { data, error } = await supabase
    .from('member_away')
    .select('*')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('starts_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createAwayPeriod(
  spaceId: string,
  away: { type: AwayType; starts_at: string; ends_at: string | null; reason: string | null }
): Promise<MemberAway> {
  const { data, error } = await supabase.rpc('set_away', {
    p_space_id: spaceId,
    p_type: away.type,
    p_starts_at: away.starts_at,
    p_ends_at: away.ends_at,
    p_reason: away.reason,
  })
  return requireData(data, error)
}

export async function endAwayPeriod(id: string): Promise<void> {
  const { error } = await supabase
    .from('member_away')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getInvitations(spaceId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createInvitation(invitation: {
  spaceId: string
  email: string | null
  role: MembershipRole
  expiresAt: string
}): Promise<Invitation> {
  const { data, error } = await supabase.rpc('create_invitation', {
    p_space_id: invitation.spaceId,
    p_email: invitation.email,
    p_role: invitation.role,
    p_expires_at: invitation.expiresAt,
  })
  return requireData(data, error)
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_invitation', { p_invitation_id: id })
  if (error) throw new Error(error.message)
}

export async function acceptInvitation(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token })
  const membership = requireData(data, error)
  return membership.space_id
}
