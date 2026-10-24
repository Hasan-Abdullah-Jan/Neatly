import type { MembershipRole } from '@/types/database'

export const TASK_MANAGER_ROLES: MembershipRole[] = ['owner', 'admin', 'supervisor']

export function isTaskManager(role: MembershipRole | null): boolean {
  return role !== null && TASK_MANAGER_ROLES.includes(role)
}
