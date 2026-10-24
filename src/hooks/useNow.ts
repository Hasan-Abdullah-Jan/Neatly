import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let currentTimestamp = Date.now()
let timer: ReturnType<typeof setInterval> | null = null

function tick(): void {
  currentTimestamp = Date.now()
  for (const notify of listeners) notify()
}

function subscribe(listener: () => void): () => void {
  currentTimestamp = Date.now()
  listeners.add(listener)
  if (timer === null) {
    timer = setInterval(tick, 60_000)
  }
  // Refresh the mounting component immediately if the shared clock was idle.
  listener()

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }
}

function getSnapshot(): number {
  return currentTimestamp
}

/**
 * A shared, minute-resolution clock. Reading it through useSyncExternalStore
 * keeps render pure while still letting due/overdue labels update over time.
 */
export function useNow(): Date {
  const timestamp = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return new Date(timestamp)
}
