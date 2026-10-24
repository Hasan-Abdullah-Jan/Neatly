import { describe, expect, it } from 'vitest'
import {
  addZonedDays,
  generateInstances,
  startOfZonedDay,
  zonedDateKey,
  type RecurrenceTask,
} from './recurrence'

function task(overrides: Partial<RecurrenceTask> = {}): RecurrenceTask {
  return {
    id: 'task-1',
    frequency: 'daily',
    due_time: '09:00',
    schedule_anchor_at: '2026-01-01T12:00:00.000Z',
    created_at: '2026-01-01T12:00:00.000Z',
    ...overrides,
  }
}

function dueDates(instances: ReturnType<typeof generateInstances>): string[] {
  return instances.map((instance) => instance.dueAt)
}

describe('generateInstances', () => {
  it('generates daily instances in a half-open window', () => {
    const instances = generateInstances(
      task(),
      '2026-01-01T00:00:00.000Z',
      '2026-01-04T00:00:00.000Z',
      'Europe/London'
    )

    expect(dueDates(instances)).toEqual([
      '2026-01-01T09:00:00.000Z',
      '2026-01-02T09:00:00.000Z',
      '2026-01-03T09:00:00.000Z',
    ])
    expect(instances.map((instance) => instance.localDate)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ])
  })

  it('excludes an occurrence exactly at the window end', () => {
    const instances = generateInstances(
      task(),
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T09:00:00.000Z',
      'UTC'
    )

    expect(dueDates(instances)).toEqual(['2026-01-01T09:00:00.000Z'])
  })

  it('generates exactly one instance for a one-off task', () => {
    const instances = generateInstances(
      task({
        frequency: 'custom',
        custom_frequency_days: 1,
        is_one_off: true,
        schedule_anchor_at: '2026-01-01T12:00:00.000Z',
      }),
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      'UTC'
    )

    expect(dueDates(instances)).toEqual(['2026-01-01T09:00:00.000Z'])
  })

  it('does not repeat a one-off task outside its anchor window', () => {
    const instances = generateInstances(
      task({
        frequency: 'custom',
        custom_frequency_days: 1,
        is_one_off: true,
        schedule_anchor_at: '2026-01-01T12:00:00.000Z',
      }),
      '2026-01-02T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      'UTC'
    )

    expect(instances).toEqual([])
  })

  it('generates weekly instances from the anchor day', () => {
    const instances = generateInstances(
      task({ frequency: 'weekly', schedule_anchor_at: '2026-01-05T12:00:00.000Z' }),
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      'Europe/London'
    )

    expect(dueDates(instances)).toEqual([
      '2026-01-05T09:00:00.000Z',
      '2026-01-12T09:00:00.000Z',
      '2026-01-19T09:00:00.000Z',
      '2026-01-26T09:00:00.000Z',
    ])
  })

  it('generates biweekly instances every fourteen days', () => {
    const instances = generateInstances(
      task({ frequency: 'biweekly', schedule_anchor_at: '2026-01-05T12:00:00.000Z' }),
      '2026-01-01T00:00:00.000Z',
      '2026-02-10T00:00:00.000Z',
      'UTC'
    )

    expect(dueDates(instances)).toEqual([
      '2026-01-05T09:00:00.000Z',
      '2026-01-19T09:00:00.000Z',
      '2026-02-02T09:00:00.000Z',
    ])
  })

  it('clamps monthly instances to shorter months and returns to the anchor day', () => {
    const instances = generateInstances(
      task({ frequency: 'monthly', schedule_anchor_at: '2026-01-31T12:00:00.000Z' }),
      '2026-01-01T00:00:00.000Z',
      '2026-04-01T00:00:00.000Z',
      'UTC'
    )

    expect(instances.map((instance) => instance.localDate)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ])
  })

  it('generates quarterly instances every three months', () => {
    const instances = generateInstances(
      task({ frequency: 'quarterly', schedule_anchor_at: '2026-11-15T12:00:00.000Z' }),
      '2026-11-01T00:00:00.000Z',
      '2027-06-01T00:00:00.000Z',
      'UTC'
    )

    expect(instances.map((instance) => instance.localDate)).toEqual([
      '2026-11-15',
      '2027-02-15',
      '2027-05-15',
    ])
  })

  it('handles leap-day yearly recurrence without drifting', () => {
    const instances = generateInstances(
      task({ frequency: 'yearly', schedule_anchor_at: '2024-02-29T12:00:00.000Z' }),
      '2024-01-01T00:00:00.000Z',
      '2029-01-01T00:00:00.000Z',
      'UTC'
    )

    expect(instances.map((instance) => instance.localDate)).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ])
  })

  it('generates custom intervals in whole days', () => {
    const instances = generateInstances(
      task({ frequency: 'custom', custom_frequency_days: 3 }),
      '2026-01-01T00:00:00.000Z',
      '2026-01-11T00:00:00.000Z',
      'UTC'
    )

    expect(instances.map((instance) => instance.localDate)).toEqual([
      '2026-01-01',
      '2026-01-04',
      '2026-01-07',
      '2026-01-10',
    ])
  })

  it('falls back to weekly when a custom interval is missing', () => {
    const instances = generateInstances(
      task({
        frequency: 'custom',
        custom_frequency_days: null,
        schedule_anchor_at: '2026-01-05T12:00:00.000Z',
      }),
      '2026-01-05T00:00:00.000Z',
      '2026-01-26T00:00:00.000Z',
      'UTC'
    )

    expect(instances.map((instance) => instance.localDate)).toEqual([
      '2026-01-05',
      '2026-01-12',
      '2026-01-19',
    ])
  })

  it('keeps the local due time across the US spring DST change', () => {
    const instances = generateInstances(
      task({
        schedule_anchor_at: '2026-03-06T12:00:00.000Z',
        due_time: '09:00',
      }),
      '2026-03-06T00:00:00.000Z',
      '2026-03-10T00:00:00.000Z',
      'America/New_York'
    )

    expect(dueDates(instances)).toEqual([
      '2026-03-06T14:00:00.000Z',
      '2026-03-07T14:00:00.000Z',
      '2026-03-08T13:00:00.000Z',
      '2026-03-09T13:00:00.000Z',
    ])
  })

  it('keeps the local due time across the UK spring DST change', () => {
    const instances = generateInstances(
      task({ schedule_anchor_at: '2026-03-27T12:00:00.000Z' }),
      '2026-03-27T00:00:00.000Z',
      '2026-03-31T00:00:00.000Z',
      'Europe/London'
    )

    expect(dueDates(instances)).toEqual([
      '2026-03-27T09:00:00.000Z',
      '2026-03-28T09:00:00.000Z',
      '2026-03-29T08:00:00.000Z',
      '2026-03-30T08:00:00.000Z',
    ])
  })

  it('filters by local calendar days in the space timezone', () => {
    const instances = generateInstances(
      task({ schedule_anchor_at: '2025-12-30T20:00:00.000Z' }),
      '2025-12-31T08:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
      'America/Los_Angeles'
    )

    expect(instances.map((instance) => instance.localDate)).toEqual([
      '2025-12-31',
      '2026-01-01',
    ])
    expect(dueDates(instances)).toEqual([
      '2025-12-31T17:00:00.000Z',
      '2026-01-01T17:00:00.000Z',
    ])
  })

  it('uses the task due time instead of a hard-coded hour', () => {
    const instances = generateInstances(
      task({ due_time: '14:30' }),
      '2026-01-01T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z',
      'UTC'
    )

    expect(dueDates(instances)).toEqual([
      '2026-01-01T14:30:00.000Z',
      '2026-01-02T14:30:00.000Z',
    ])
  })

  it('returns nothing when the anchor is after the window', () => {
    const instances = generateInstances(
      task({ schedule_anchor_at: '2026-06-01T12:00:00.000Z' }),
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      'UTC'
    )

    expect(instances).toEqual([])
  })

  it('returns nothing for an invalid window', () => {
    expect(
      generateInstances(task(), '2026-02-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'UTC')
    ).toEqual([])
    expect(generateInstances(task(), 'not-a-date', '2026-01-02T00:00:00.000Z', 'UTC')).toEqual([])
  })

  it('rejects an unknown timezone with a clear error', () => {
    expect(() =>
      generateInstances(task(), '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', 'Mars/Olympus')
    ).toThrow('Unknown time zone')
  })
})

describe('zoned day helpers', () => {
  it('finds local midnight across a DST change', () => {
    expect(startOfZonedDay('2026-03-08T12:00:00.000Z', 'America/New_York').toISOString()).toBe(
      '2026-03-08T05:00:00.000Z'
    )
    expect(addZonedDays('2026-03-08T12:00:00.000Z', 1, 'America/New_York').toISOString()).toBe(
      '2026-03-09T04:00:00.000Z'
    )
  })

  it('reports the local date for an instant near midnight UTC', () => {
    expect(zonedDateKey('2026-03-09T03:30:00.000Z', 'America/New_York')).toBe('2026-03-08')
    expect(zonedDateKey('2026-03-09T03:30:00.000Z', 'UTC')).toBe('2026-03-09')
  })
})
