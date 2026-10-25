export type RecommendationAction =
  | 'reduce_scope'
  | 'split_task'
  | 'change_time'
  | 'reassign'
  | 'review_frequency'
  | 'review_bin_capacity'
  | 'review_access'
  | 'review_supplies'
  | 'review_ownership'
  | 'add_to_replenishment'
  | 'create_supply_request'
  | 'create_organization_task'
  | 'spread_non_urgent_tasks'
  | 'suggest_area_check'
  | 'check_plant'
  | 'review_clutter_zone'

export type RecommendationRuleId =
  | 'repeated_task_overdue'
  | 'repeated_area_issue'
  | 'supply_below_minimum'
  | 'repeated_clutter'
  | 'plant_check_overdue'
  | 'task_day_congestion'
  | 'area_no_recent_record'

export interface RecommendationRule {
  id: RecommendationRuleId
  signal: string
  threshold: number
  reasonTemplate: string
  actions: RecommendationAction[]
}

export const RECOMMENDATION_RULES: RecommendationRule[] = [
  {
    id: 'repeated_task_overdue',
    signal: 'overdue or postponed task occurrences within 14 days',
    threshold: 3,
    reasonTemplate: 'This task was postponed or overdue {count} times in 14 days.',
    actions: ['reduce_scope', 'split_task'],
  },
  {
    id: 'repeated_area_issue',
    signal: 'reports with the same area and category within 30 days',
    threshold: 3,
    reasonTemplate: '{count} reports in this area share the same category in 30 days.',
    actions: ['review_frequency', 'review_supplies'],
  },
  {
    id: 'supply_below_minimum',
    signal: 'supply quantity at or below its minimum',
    threshold: 1,
    reasonTemplate: '{item} is at {quantity} {unit}; its minimum is {minimum}.',
    actions: ['add_to_replenishment', 'create_supply_request'],
  },
  {
    id: 'repeated_clutter',
    signal: 'clutter reports for the same zone within 28 days',
    threshold: 3,
    reasonTemplate: 'This zone was reported cluttered {count} times in 28 days.',
    actions: ['create_organization_task', 'review_clutter_zone'],
  },
  {
    id: 'plant_check_overdue',
    signal: 'plant check due date has passed',
    threshold: 1,
    reasonTemplate: 'A check for {plant} is due. Review the plant condition and its care notes.',
    actions: ['check_plant', 'change_time'],
  },
  {
    id: 'task_day_congestion',
    signal: 'open tasks due on one local calendar day',
    threshold: 5,
    reasonTemplate: '{count} tasks are due on {date}.',
    actions: ['spread_non_urgent_tasks'],
  },
  {
    id: 'area_no_recent_record',
    signal: 'days since an area task or issue record',
    threshold: 30,
    reasonTemplate: 'There has been no recent record for {area} in {days} days.',
    actions: ['suggest_area_check'],
  },
]

export interface RecommendationTask {
  id: string
  name: string
  area_id: string | null
  estimated_minutes?: number | null
}

export interface RecommendationInstance {
  task_id: string
  due_at: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'overdue'
  deleted_at?: string | null
}

export interface RecommendationIssue {
  area_id: string | null
  category: string
  created_at: string
  deleted_at?: string | null
}

export interface RecommendationSupply {
  id: string
  name: string
  quantity: number
  min_quantity: number
  unit: string
  deleted_at?: string | null
}

export interface RecommendationArea {
  id: string
  name: string
  active: boolean
}

export interface ClutterSignal {
  area_id: string
  occurred_at: string
}

export interface PlantCheck {
  id: string
  name: string
  due_at: string
}

export interface RecommendationCandidate {
  ruleId: RecommendationRuleId
  entityId: string
  title: string
  reason: string
  actions: RecommendationAction[]
  type: 'rebalance' | 'schedule' | 'supply' | 'maintenance' | 'other'
  data: Record<string, string | number | string[]>
}

export interface RecommendationInput {
  now: Date
  timezone: string
  tasks: RecommendationTask[]
  instances: RecommendationInstance[]
  issues: RecommendationIssue[]
  supplies: RecommendationSupply[]
  areas: RecommendationArea[]
  clutterSignals?: ClutterSignal[]
  plantChecks?: PlantCheck[]
}

const DAY_MS = 24 * 60 * 60 * 1000

function localDateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function withinWindow(date: string, now: Date, days: number): boolean {
  const timestamp = Date.parse(date)
  return Number.isFinite(timestamp) && timestamp <= now.getTime() && timestamp >= now.getTime() - days * DAY_MS
}

function candidate(
  ruleId: RecommendationRuleId,
  entityId: string,
  title: string,
  reason: string,
  data: RecommendationCandidate['data'],
): RecommendationCandidate {
  const rule = getRule(ruleId)
  return {
    ruleId,
    entityId,
    title,
    reason,
    actions: rule.actions.slice(0, 2),
    type: ruleId === 'supply_below_minimum'
      ? 'supply'
      : ruleId === 'repeated_task_overdue' || ruleId === 'task_day_congestion' || ruleId === 'area_no_recent_record'
        ? 'schedule'
        : ruleId === 'repeated_clutter' || ruleId === 'plant_check_overdue'
          ? 'maintenance'
          : 'other',
    data: { rule_id: ruleId, entity_id: entityId, ...data },
  }
}

function getRule(id: RecommendationRuleId): RecommendationRule {
  const rule = RECOMMENDATION_RULES.find((entry) => entry.id === id)
  if (!rule) throw new Error(`Missing recommendation rule: ${id}`)
  return rule
}

export function evaluateRecommendations(input: RecommendationInput): RecommendationCandidate[] {
  const { now, timezone } = input
  const taskById = new Map(input.tasks.map((task) => [task.id, task]))
  const suggestions: RecommendationCandidate[] = []

  const repeatedTaskCounts = new Map<string, number>()
  for (const instance of input.instances) {
    if (
      instance.deleted_at ||
      !['skipped', 'overdue'].includes(instance.status) ||
      !withinWindow(instance.due_at, now, 14)
    ) continue
    repeatedTaskCounts.set(instance.task_id, (repeatedTaskCounts.get(instance.task_id) ?? 0) + 1)
  }
  for (const [taskId, count] of repeatedTaskCounts) {
    const rule = getRule('repeated_task_overdue')
    if (count < rule.threshold) continue
    const task = taskById.get(taskId)
    if (!task) continue
    suggestions.push(candidate(
      rule.id,
      taskId,
      `Review ${task.name}`,
      rule.reasonTemplate.replace('{count}', String(count)),
      { count, task_id: taskId },
    ))
  }

  const issueCounts = new Map<string, { areaId: string; category: string; count: number }>()
  for (const issue of input.issues) {
    if (issue.deleted_at || !issue.area_id || !withinWindow(issue.created_at, now, 30)) continue
    const key = `${issue.area_id}\u0000${issue.category}`
    const value = issueCounts.get(key) ?? { areaId: issue.area_id, category: issue.category, count: 0 }
    value.count += 1
    issueCounts.set(key, value)
  }
  for (const { areaId, category, count } of issueCounts.values()) {
    const rule = getRule('repeated_area_issue')
    if (count < rule.threshold) continue
    const areaName = input.areas.find((area) => area.id === areaId)?.name ?? 'this area'
    suggestions.push(candidate(
      rule.id,
      `${areaId}:${category}`,
      `Review ${category.toLowerCase()} reports in ${areaName}`,
      rule.reasonTemplate.replace('{count}', String(count)),
      { count, area_id: areaId, category },
    ))
  }

  for (const supply of input.supplies) {
    if (supply.deleted_at || supply.quantity > supply.min_quantity) continue
    const rule = getRule('supply_below_minimum')
    suggestions.push(candidate(
      rule.id,
      supply.id,
      `Review low stock: ${supply.name}`,
      rule.reasonTemplate
        .replace('{item}', supply.name)
        .replace('{quantity}', String(supply.quantity))
        .replace('{unit}', supply.unit)
        .replace('{minimum}', String(supply.min_quantity)),
      { supply_id: supply.id, quantity: supply.quantity, minimum: supply.min_quantity },
    ))
  }

  const clutterCounts = new Map<string, number>()
  for (const signal of input.clutterSignals ?? []) {
    if (withinWindow(signal.occurred_at, now, 28)) {
      clutterCounts.set(signal.area_id, (clutterCounts.get(signal.area_id) ?? 0) + 1)
    }
  }
  for (const [areaId, count] of clutterCounts) {
    const rule = getRule('repeated_clutter')
    if (count < rule.threshold) continue
    const areaName = input.areas.find((area) => area.id === areaId)?.name ?? 'This zone'
    suggestions.push(candidate(
      rule.id,
      areaId,
      `Consider a short organization task for ${areaName}`,
      rule.reasonTemplate.replace('{count}', String(count)),
      { area_id: areaId, count },
    ))
  }

  for (const plant of input.plantChecks ?? []) {
    const dueAt = Date.parse(plant.due_at)
    if (!Number.isFinite(dueAt) || dueAt >= now.getTime()) continue
    const rule = getRule('plant_check_overdue')
    suggestions.push(candidate(
      rule.id,
      plant.id,
      `Check the plant: ${plant.name}`,
      rule.reasonTemplate.replace('{plant}', plant.name),
      { plant_id: plant.id, due_at: plant.due_at },
    ))
  }

  const upcoming = input.instances.filter((instance) =>
    !instance.deleted_at &&
    ['pending', 'in_progress', 'overdue'].includes(instance.status) &&
    Date.parse(instance.due_at) >= now.getTime() &&
    Date.parse(instance.due_at) < now.getTime() + 7 * DAY_MS
  )
  const tasksByDate = new Map<string, RecommendationInstance[]>()
  for (const instance of upcoming) {
    const key = localDateKey(new Date(instance.due_at), timezone)
    const list = tasksByDate.get(key) ?? []
    list.push(instance)
    tasksByDate.set(key, list)
  }
  for (const [date, instances] of tasksByDate) {
    const rule = getRule('task_day_congestion')
    if (instances.length < rule.threshold) continue
    suggestions.push(candidate(
      rule.id,
      date,
      'Consider spreading non-urgent tasks',
      rule.reasonTemplate.replace('{count}', String(instances.length)).replace('{date}', date),
      { count: instances.length, date, task_ids: [...new Set(instances.map((instance) => instance.task_id))] },
    ))
  }

  const recentAreaIds = new Set<string>()
  for (const task of input.tasks) {
    if (!task.area_id) continue
    if (input.instances.some((instance) =>
      instance.task_id === task.id && !instance.deleted_at && withinWindow(instance.due_at, now, 30)
    )) recentAreaIds.add(task.area_id)
  }
  for (const issue of input.issues) {
    if (issue.area_id && !issue.deleted_at && withinWindow(issue.created_at, now, 30)) recentAreaIds.add(issue.area_id)
  }
  for (const area of input.areas) {
    if (!area.active || recentAreaIds.has(area.id)) continue
    const rule = getRule('area_no_recent_record')
    suggestions.push(candidate(
      rule.id,
      area.id,
      `Consider a quick check of ${area.name}`,
      rule.reasonTemplate.replace('{area}', area.name).replace('{days}', String(rule.threshold)),
      { area_id: area.id, days_since_record: rule.threshold },
    ))
  }

  return suggestions
}

export function limitRecommendationCards(
  candidates: RecommendationCandidate[],
  existing: Array<{ created_at: string; status: string; data: unknown }>,
  now: Date,
  maxCardsPerWeek = 3,
): RecommendationCandidate[] {
  if (!Number.isInteger(maxCardsPerWeek) || maxCardsPerWeek < 0) {
    throw new Error('The weekly recommendation cap must be a non-negative integer.')
  }

  const cutoff = now.getTime() - 7 * DAY_MS
  const recent = existing.filter((item) => {
    const createdAt = Date.parse(item.created_at)
    return Number.isFinite(createdAt) && createdAt >= cutoff && createdAt <= now.getTime()
  })
  const disabledRuleIds = new Set(
    existing
      .filter((item) => item.status === 'disabled' && typeof item.data === 'object' && item.data !== null && 'rule_id' in item.data)
      .map((item) => (item.data as { rule_id: string }).rule_id),
  )
  const recentlyDismissedRuleIds = new Set(
    recent
      .filter((item) => item.status === 'dismissed' && typeof item.data === 'object' && item.data !== null && 'rule_id' in item.data)
      .map((item) => (item.data as { rule_id: string }).rule_id),
  )
  const activeCardCount = recent.filter((item) => item.status !== 'disabled' && item.status !== 'dismissed').length
  const remaining = Math.max(0, maxCardsPerWeek - activeCardCount)
  const unique = new Map<string, RecommendationCandidate>()
  for (const item of candidates) {
    const key = `${item.ruleId}:${item.entityId}`
    if (disabledRuleIds.has(item.ruleId) || recentlyDismissedRuleIds.has(item.ruleId) || unique.has(key)) continue
    unique.set(key, item)
  }
  return [...unique.values()].slice(0, remaining)
}
