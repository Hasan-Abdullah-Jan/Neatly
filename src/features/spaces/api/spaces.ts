import { supabase } from '@lib/supabase'
import type {
  Invitation,
  InvitationStatus,
  Membership,
  MembershipRole,
  Space,
  SpaceUpdate,
} from '@/types/database'

export interface MemberProfileSummary {
  id: string
  full_name: string | null
}

export interface SpaceMember {
  membership: Membership
  profile: MemberProfileSummary | null
}

export interface SpaceInvitation {
  invitation: Invitation
}

export async function fetchSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
  const { data: memberships, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('joined_at', { ascending: true })

  if (error) throw new Error(error.message)

  const rows = (memberships ?? []) as Membership[]
  if (rows.length === 0) return []

  const userIds = rows.map((membership) => membership.user_id)
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds)

  if (profileError) throw new Error(profileError.message)

  const profileRows = (profiles ?? []) as MemberProfileSummary[]

  return rows.map((membership) => ({
    membership,
    profile: profileRows.find((profile) => profile.id === membership.user_id) ?? null,
  }))
}

export async function countSpaceOwners(spaceId: string): Promise<number> {
  const { count, error } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('space_id', spaceId)
    .eq('role', 'owner')
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function updateMemberRole(
  spaceId: string,
  membership: Membership,
  nextRole: MembershipRole
): Promise<void> {
  if (membership.role === 'owner' && nextRole !== 'owner') {
    const owners = await countSpaceOwners(spaceId)
    if (owners <= 1) {
      throw new Error('A space needs at least one owner. Make someone else an owner first.')
    }
  }

  const { error } = await supabase
    .from('memberships')
    .update({ role: nextRole, updated_at: new Date().toISOString() })
    .eq('id', membership.id)
    .eq('space_id', spaceId)

  if (error) throw new Error(error.message)
}

export async function removeMember(spaceId: string, membership: Membership): Promise<void> {
  if (membership.role === 'owner') {
    const owners = await countSpaceOwners(spaceId)
    if (owners <= 1) {
      throw new Error('You cannot remove the last owner of a space.')
    }
  }

  const { error } = await supabase
    .from('memberships')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', membership.id)
    .eq('space_id', spaceId)

  if (error) throw new Error(error.message)
}

export async function fetchSpaceInvitations(spaceId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('space_id', spaceId)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Invitation[]
}

export async function createSpaceInvitation(options: {
  spaceId: string
  email: string
  role: MembershipRole
  invitedBy: string
}): Promise<Invitation> {
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      space_id: options.spaceId,
      email: options.email.trim(),
      role: options.role,
      invited_by: options.invitedBy,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not create the invitation.')
  }
  return data as Invitation
}

export async function updateInvitationStatus(
  invitationId: string,
  status: InvitationStatus
): Promise<void> {
  const { error } = await supabase
    .from('invitations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', invitationId)

  if (error) throw new Error(error.message)
}

export async function updateSpaceDetails(spaceId: string, updates: SpaceUpdate): Promise<Space> {
  const { data, error } = await supabase
    .from('spaces')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', spaceId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not update the space.')
  }
  return data as Space
}
