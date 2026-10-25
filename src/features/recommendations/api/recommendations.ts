import { supabase } from '@lib/supabase'
import { fetchAreas } from '@features/areas/api/areas'
import { getSupplyItems } from '@features/supplies/api/supplies'
import { fetchMembershipRole, fetchTasks, fetchInstancesInWindow } from '@features/tasks/api/tasks'
import { isTaskManager } from '@features/tasks/lib/permissions'
import type { Recommendation, RecommendationUpdate } from '@/types/database'
import {
  evaluateRecommendations,
  limitRecommendationCards,
  type RecommendationCandidate,
} from '../lib/rules'

const LOOKBACK_DAYS = 30
const FORECAST_DAYS = 7
const RECOMMENDATION_HISTORY_LIMIT = 500

function shiftDays(date: Date, days: number): Date {
  const shifted = new Date(date)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted
}

function recommendationKey(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('rule_id' in data) || !('entity_id' in data)) {
    return null
  }
  const record = data as { rule_id: unknown; entity_id: unknown }
  return typeof record.rule_id === 'string' && typeof record.entity_id === 'string'
    ? `${record.rule_id}:${record.entity_id}`
    : null
}

async function requireManager(spaceId: string, userId: string): Promise<void> {
  const role = await fetchMembershipRole(spaceId, userId)
  if (!isTaskManager(role)) {
    throw new Error('Recommendations are available to space managers only.')
  }
}

export async function listRecommendations(spaceId: string): Promise<Recommendation[]> {
  const { data, error } = await supabase
    .from('recommendations')
    .select('*')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function generateRecommendations(
  spaceId: string,
  userId: string,
  timezone: string,
  now = new Date(),
): Promise<Recommendation[]> {
  await requireManager(spaceId, userId)
  const from = shiftDays(now, -LOOKBACK_DAYS)
  const to = shiftDays(now, FORECAST_DAYS)
  const [tasks, instances, areas, supplies, issuesResult, existingResult] = await Promise.all([
    fetchTasks(spaceId),
    fetchInstancesInWindow(spaceId, from.toISOString(), to.toISOString(), 5000),
    fetchAreas(spaceId),
    getSupplyItems(spaceId),
    supabase
      .from('issues')
      .select('area_id, category, created_at, deleted_at')
      .eq('space_id', spaceId)
      .gte('created_at', from.toISOString())
      .is('deleted_at', null)
      .limit(2000),
    supabase
      .from('recommendations')
      .select('*')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false })
      .limit(RECOMMENDATION_HISTORY_LIMIT),
  ])

  if (issuesResult.error) throw new Error(issuesResult.error.message)
  if (existingResult.error) throw new Error(existingResult.error.message)

  const existing = existingResult.data ?? []
  const recentKeys = new Set(
    existing
      .filter((item) => item.status !== 'dismissed')
      .map((item) => recommendationKey(item.data))
      .filter((key): key is string => key !== null),
  )
  const candidates = evaluateRecommendations({
    now,
    timezone,
    tasks,
    instances,
    issues: issuesResult.data ?? [],
    supplies,
    areas,
  }).filter((candidate) => !recentKeys.has(`${candidate.ruleId}:${candidate.entityId}`))
  const limited = limitRecommendationCards(
    candidates,
    existing.map((item) => ({ created_at: item.created_at, status: item.status, data: item.data })),
    now,
  )
  if (limited.length === 0) return []

  const rows = limited.map((item: RecommendationCandidate) => ({
    space_id: spaceId,
    type: item.type,
    title: item.title,
    reason: item.reason,
    data: { ...item.data, actions: item.actions },
    action: 'accept' as const,
    status: 'pending' as const,
    created_by: userId,
  }))
  const { data, error } = await supabase
    .from('recommendations')
    .insert(rows)
    .select('*')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function updateRecommendation(
  spaceId: string,
  userId: string,
  recommendationId: string,
  updates: RecommendationUpdate,
): Promise<Recommendation> {
  await requireManager(spaceId, userId)
  const { data, error } = await supabase
    .from('recommendations')
    .update(updates)
    .eq('id', recommendationId)
    .eq('space_id', spaceId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}
