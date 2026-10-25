import { supabase } from '@lib/supabase'
import type { Json } from '@/types/database'

export interface SharedDeviceMember {
  member_id: string
  full_name: string
  role: 'owner' | 'admin' | 'supervisor' | 'member' | 'cleaner' | 'auditor'
  has_pin: boolean
}

export interface SharedDeviceSession {
  token: string
  user_id: string
  full_name: string
  role: 'owner' | 'admin' | 'supervisor' | 'member' | 'cleaner' | 'auditor'
  expires_at: string
}

export interface PinStatus {
  has_pin: boolean
  locked_until: string | null
}

const sharedDeviceRoles = ['owner', 'admin', 'supervisor', 'member', 'cleaner', 'auditor'] as const

function jsonRecord(value: Json): { [key: string]: Json } | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null
}

function isSharedDeviceRole(value: Json | undefined): value is SharedDeviceSession['role'] {
  return typeof value === 'string' && sharedDeviceRoles.some((role) => role === value)
}

function parseSharedDeviceSession(value: Json): SharedDeviceSession {
  const record = jsonRecord(value)
  if (
    !record
    || typeof record.token !== 'string'
    || typeof record.user_id !== 'string'
    || typeof record.full_name !== 'string'
    || !isSharedDeviceRole(record.role)
    || typeof record.expires_at !== 'string'
  ) {
    throw new Error('The shared-device session response was invalid.')
  }
  return {
    token: record.token,
    user_id: record.user_id,
    full_name: record.full_name,
    role: record.role,
    expires_at: record.expires_at,
  }
}

export async function getSharedDeviceMembers(spaceId: string): Promise<SharedDeviceMember[]> {
  const { data, error } = await supabase.rpc('list_shared_device_members', {
    p_space_id: spaceId,
  })

  if (error) throw error
  return data || []
}

export async function getPinStatus(spaceId: string): Promise<PinStatus> {
  const { data, error } = await supabase.rpc('shared_device_pin_status', {
    p_space_id: spaceId,
  })

  if (error) throw error
  return data
}

export async function setPin(spaceId: string, pin: string): Promise<void> {
  const { error } = await supabase.rpc('set_shared_device_pin', {
    p_space_id: spaceId,
    p_pin: pin,
  })

  if (error) throw error
}

export async function removePin(spaceId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_shared_device_pin', {
    p_space_id: spaceId,
  })

  if (error) throw error
}

export async function openSession(
  spaceId: string,
  userId: string,
  pin: string
): Promise<SharedDeviceSession> {
  const { data, error } = await supabase.rpc('open_shared_device_session', {
    p_space_id: spaceId,
    p_user_id: userId,
    p_pin: pin,
  })

  if (error) throw error
  const response = jsonRecord(data)
  if (!response) throw new Error('The shared-device authentication response was invalid.')
  if (typeof response.error_code === 'string') {
    const remaining = typeof response.attempts_remaining !== 'number'
      ? ''
      : ` ${response.attempts_remaining} attempts remaining.`
    const message = typeof response.message === 'string' ? response.message : 'The PIN could not be verified.'
    throw new Error(`${message}${remaining}`)
  }
  return parseSharedDeviceSession(data)
}

export async function getSession(spaceId: string, token: string): Promise<SharedDeviceSession | null> {
  const { data, error } = await supabase.rpc('get_shared_device_session', {
    p_space_id: spaceId,
    p_token: token,
  })

  if (error) throw error
  return data === null ? null : parseSharedDeviceSession(data)
}

export async function closeSession(token: string): Promise<void> {
  const { error } = await supabase.rpc('close_shared_device_session', {
    p_token: token,
  })

  if (error) throw error
}
