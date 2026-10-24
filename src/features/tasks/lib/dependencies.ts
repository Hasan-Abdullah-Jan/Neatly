export interface DependencyEdge {
  taskId: string
  dependsOnTaskId: string
}

/**
 * Dependencies point from a task to a task that must be finished first.
 * Adding `taskId -> dependsOnTaskId` is a cycle when `dependsOnTaskId` can
 * already reach `taskId` through existing edges.
 */
export function wouldCreateDependencyCycle(
  edges: DependencyEdge[],
  taskId: string,
  dependsOnTaskId: string
): boolean {
  if (taskId === dependsOnTaskId) return true

  const nextByTask = new Map<string, string[]>()
  for (const edge of edges) {
    const list = nextByTask.get(edge.taskId) ?? []
    list.push(edge.dependsOnTaskId)
    nextByTask.set(edge.taskId, list)
  }

  const stack = [dependsOnTaskId]
  const visited = new Set<string>()
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || visited.has(current)) continue
    if (current === taskId) return true
    visited.add(current)
    for (const next of nextByTask.get(current) ?? []) {
      stack.push(next)
    }
  }

  return false
}

/** Return the requested dependency ids that would create a cycle. */
export function findCyclicDependencies(
  edges: DependencyEdge[],
  taskId: string,
  dependsOnTaskIds: string[]
): string[] {
  return dependsOnTaskIds.filter((dependsOnTaskId) =>
    wouldCreateDependencyCycle(edges, taskId, dependsOnTaskId)
  )
}
