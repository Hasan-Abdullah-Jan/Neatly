import { describe, expect, it } from 'vitest'
import { detectTimezone, getTimezoneOptions, isValidTimezone } from './timezones'

describe('timezones', () => {
  it('detects a non-empty timezone', () => {
    expect(detectTimezone().length).toBeGreaterThan(0)
  })

  it('validates IANA timezones', () => {
    expect(isValidTimezone('UTC')).toBe(true)
    expect(isValidTimezone('America/New_York')).toBe(true)
    expect(isValidTimezone('Not/AZone')).toBe(false)
    expect(isValidTimezone('   ')).toBe(false)
  })

  it('includes the current timezone in options without duplicating', () => {
    const options = getTimezoneOptions('America/New_York')
    expect(options.some((option) => option.value === 'America/New_York')).toBe(true)
    expect(new Set(options.map((option) => option.value)).size).toBe(options.length)
  })

  it('adds unknown current timezones without duplicating', () => {
    const custom = 'Etc/GMT+5'
    const options = getTimezoneOptions(custom)
    expect(options.filter((option) => option.value === custom)).toHaveLength(1)
  })
})
