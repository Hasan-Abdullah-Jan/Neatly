import { describe, expect, it } from 'vitest'
import { areaCategoryLabel, formatFrequency } from './areaDisplay'

describe('areaCategoryLabel', () => {
  it('maps known categories', () => {
    expect(areaCategoryLabel('kitchen')).toBe('Kitchen')
    expect(areaCategoryLabel('exam')).toBe('Exam room')
  })

  it('falls back to the raw value or uncategorized', () => {
    expect(areaCategoryLabel('rooftop')).toBe('rooftop')
    expect(areaCategoryLabel(null)).toBe('Uncategorized')
  })
})

describe('formatFrequency', () => {
  it('formats built-in frequencies', () => {
    expect(formatFrequency('daily', null)).toBe('Daily')
    expect(formatFrequency('biweekly', null)).toBe('Every 2 weeks')
    expect(formatFrequency('yearly', null)).toBe('Yearly')
  })

  it('uses custom day intervals when present', () => {
    expect(formatFrequency('custom', 3)).toBe('Every 3 days')
    expect(formatFrequency('custom', null)).toBe('Custom interval')
  })
})
