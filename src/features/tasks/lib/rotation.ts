export interface RotationSelection {
  userId: string | null
  nextCursor: number
}

function normalizeCursor(cursor: number, length: number): number {
  if (length <= 0) return 0
  const normalized = Number.isFinite(cursor) ? Math.trunc(cursor) : 0
  return ((normalized % length) + length) % length
}

function normalizeMemberId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return value ?? null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function selectRotationMember(
  memberIds: string[],
  cursor: number,
  awayIds: ReadonlySet<string>
): RotationSelection {
  const normalizedAwayIds = new Set(
    [...awayIds].map((id) => normalizeMemberId(id)).filter((id): id is string => id !== null)
  )
  const candidates = Array.from(
    new Set(
      memberIds
        .map((id) => normalizeMemberId(id))
        .filter((id): id is string => id !== null)
    )
  )
  if (candidates.length === 0) return { userId: null, nextCursor: 0 }

  const start = normalizeCursor(cursor, candidates.length)
  for (let offset = 0; offset < candidates.length; offset += 1) {
    const index = (start + offset) % candidates.length
    const userId = candidates[index]
    if (userId && !normalizedAwayIds.has(userId)) {
      return { userId, nextCursor: (index + 1) % candidates.length }
    }
  }
  return { userId: null, nextCursor: start }
}
