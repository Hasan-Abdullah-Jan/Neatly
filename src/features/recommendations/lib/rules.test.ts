import {
  evaluateRecommendations,
  limitRecommendationCards,
  RECOMMENDATION_RULES,
  type RecommendationInput,
} from './rules'

const now = new Date('2026-01-01T12:00:00.000Z')

function fixture(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    now,
    timezone: 'UTC',
    tasks: [{ id: 'task-1', name: 'Kitchen reset', area_id: 'area-1' }],
    instances: [],
    issues: [],
    supplies: [],
    areas: [{ id: 'area-1', name: 'Kitchen', active: true }],
    ...overrides,
  }
}

function matchingRule(input: RecommendationInput, ruleId: string) {
  return evaluateRecommendations(input).filter((suggestion) => suggestion.ruleId === ruleId)
}

describe('transparent recommendation rules', () => {
  it('declares each requested rule with a signal, threshold, reason, and no more than two actions', () => {
    expect(RECOMMENDATION_RULES).toHaveLength(7)
    for (const rule of RECOMMENDATION_RULES) {
      expect(rule.signal.trim()).not.toBe('')
      expect(rule.threshold).toBeGreaterThan(0)
      expect(rule.reasonTemplate.trim()).not.toBe('')
      expect(rule.actions.length).toBeGreaterThan(0)
      expect(rule.actions.length).toBeLessThanOrEqual(2)
    }
  })

  it('suggests task changes only after three overdue or skipped occurrences in 14 days', () => {
    const occurrences = [1, 2, 3].map((day) => ({
      task_id: 'task-1',
      due_at: new Date(now.getTime() - day * 86400000).toISOString(),
      status: 'skipped' as const,
    }))
    expect(matchingRule(fixture({ instances: occurrences.slice(0, 2) }), 'repeated_task_overdue')).toHaveLength(0)
    const [suggestion] = matchingRule(fixture({ instances: occurrences }), 'repeated_task_overdue')
    expect(suggestion?.reason).toBe('This task was postponed or overdue 3 times in 14 days.')
    expect(suggestion?.actions).toHaveLength(2)
  })

  it('suggests review for repeated reports from the same area and category', () => {
    const reports = [1, 2, 3].map((day) => ({
      area_id: 'area-1',
      category: 'supplies',
      created_at: new Date(now.getTime() - day * 86400000).toISOString(),
    }))
    expect(matchingRule(fixture({ issues: reports.slice(0, 2) }), 'repeated_area_issue')).toHaveLength(0)
    expect(matchingRule(fixture({ issues: reports }), 'repeated_area_issue')[0]?.reason)
      .toBe('3 reports in this area share the same category in 30 days.')
  })

  it('suggests a low-stock option at or below the configured minimum only', () => {
    const supplies = [{ id: 'soap', name: 'Soap', quantity: 2, min_quantity: 2, unit: 'bottles' }]
    expect(matchingRule(fixture({ supplies }), 'supply_below_minimum')[0]?.reason)
      .toBe('Soap is at 2 bottles; its minimum is 2.')
    expect(matchingRule(fixture({
      supplies: [{ id: 'soap', name: 'Soap', quantity: 3, min_quantity: 2, unit: 'bottles' }],
    }), 'supply_below_minimum')).toHaveLength(0)
  })

  it('suggests a short organization task after three recent clutter reports', () => {
    const clutterSignals = [1, 2, 3].map((day) => ({
      area_id: 'area-1',
      occurred_at: new Date(now.getTime() - day * 86400000).toISOString(),
    }))
    expect(matchingRule(fixture({ clutterSignals }), 'repeated_clutter')[0]?.reason)
      .toBe('This zone was reported cluttered 3 times in 28 days.')
  })

  it('prompts for a plant check rather than instructing the user to water it', () => {
    const suggestions = matchingRule(fixture({
      plantChecks: [{ id: 'fern', name: 'Fern', due_at: '2025-12-30T12:00:00.000Z' }],
    }), 'plant_check_overdue')
    expect(suggestions[0]?.title).toBe('Check the plant: Fern')
    expect(suggestions[0]?.reason).toContain('check for Fern')
    expect(suggestions[0]?.reason.toLowerCase()).not.toContain('water now')
  })

  it('suggests spreading five tasks due on one local date', () => {
    const instances = Array.from({ length: 5 }, (_, index) => ({
      task_id: `task-${index}`,
      due_at: '2026-01-02T10:00:00.000Z',
      status: 'pending' as const,
    }))
    const suggestions = matchingRule(fixture({ instances }), 'task_day_congestion')
    expect(suggestions[0]?.reason).toBe('5 tasks are due on 2026-01-02.')
  })

  it('suggests a quick area check for areas without a record in 30 days', () => {
    const suggestions = matchingRule(fixture({
      areas: [{ id: 'area-2', name: 'Storage', active: true }],
    }), 'area_no_recent_record')
    expect(suggestions[0]?.reason).toBe('There has been no recent record for Storage in 30 days.')
    expect(suggestions[0]?.title.toLowerCase()).not.toContain('dirty')
  })

  it('does not recommend areas that already have a recent task or issue record', () => {
    const suggestions = matchingRule(fixture({
      instances: [{
        task_id: 'task-1',
        due_at: '2025-12-20T12:00:00.000Z',
        status: 'completed',
      }],
    }), 'area_no_recent_record')
    expect(suggestions).toHaveLength(0)
  })

  it('caps cards per week and honors disabled or recently dismissed rule types', () => {
    const candidates = evaluateRecommendations(fixture({
      supplies: [
        { id: 'soap', name: 'Soap', quantity: 0, min_quantity: 1, unit: 'bottles' },
        { id: 'cloths', name: 'Cloths', quantity: 0, min_quantity: 1, unit: 'packs' },
      ],
    }))
    expect(limitRecommendationCards(candidates, [], now, 1)).toHaveLength(1)

    const suppressed = limitRecommendationCards(candidates, [{
      created_at: now.toISOString(),
      status: 'disabled',
      data: { rule_id: 'supply_below_minimum' },
    }], now)
    expect(suppressed.some((suggestion) => suggestion.ruleId === 'supply_below_minimum')).toBe(false)

    const dismissed = limitRecommendationCards(candidates, [{
      created_at: now.toISOString(),
      status: 'dismissed',
      data: { rule_id: 'supply_below_minimum' },
    }], now)
    expect(dismissed.some((suggestion) => suggestion.ruleId === 'supply_below_minimum')).toBe(false)

    const fullWeek = Array.from({ length: 3 }, (_, index) => ({
      created_at: now.toISOString(),
      status: 'accepted',
      data: { rule_id: `rule-${index}` },
    }))
    expect(limitRecommendationCards(candidates, fullWeek, now)).toHaveLength(0)
  })
})
