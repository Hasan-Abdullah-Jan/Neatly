import { describe, expect, it } from 'vitest'
import { selectRotationMember } from './rotation'

describe('selectRotationMember', () => {
  it('moves forward in order and wraps around', () => {
    const members = ['a', 'b', 'c']
    const first = selectRotationMember(members, 0, new Set())
    const second = selectRotationMember(members, first.nextCursor, new Set())
    const third = selectRotationMember(members, second.nextCursor, new Set())

    expect([first.userId, second.userId, third.userId]).toEqual(['a', 'b', 'c'])
    expect(selectRotationMember(members, third.nextCursor, new Set()).userId).toBe('a')
  })

  it('skips away members without changing the order of available members', () => {
    expect(selectRotationMember(['a', 'b', 'c'], 0, new Set(['a', 'b']))).toEqual({
      userId: 'c',
      nextCursor: 0,
    })
  })

  it('normalizes negative and invalid cursors and removes duplicates', () => {
    expect(selectRotationMember(['a', 'a', 'b', 'c'], -2, new Set())).toEqual({
      userId: 'b',
      nextCursor: 2,
    })
    expect(selectRotationMember(['a', 'b', 'c'], Number.NaN, new Set())).toEqual({
      userId: 'a',
      nextCursor: 1,
    })
  })

  it('returns no assignee when all selected people are away', () => {
    expect(selectRotationMember(['a', 'b'], 1, new Set(['a', 'b']))).toEqual({
      userId: null,
      nextCursor: 1,
    })
  })

  it('treats blank and whitespace ids as absent and ignores whitespace away ids', () => {
    expect(selectRotationMember(['a', '   ', 'b'], 0, new Set([' b ']))).toEqual({
      userId: 'a',
      nextCursor: 1,
    })
  })
})
