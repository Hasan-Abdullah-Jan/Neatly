import { describe, expect, it } from 'vitest'
import { findCyclicDependencies, wouldCreateDependencyCycle, type DependencyEdge } from './dependencies'

const edges: DependencyEdge[] = [
  { taskId: 'b', dependsOnTaskId: 'a' },
  { taskId: 'c', dependsOnTaskId: 'b' },
]

describe('dependency cycle detection', () => {
  it('rejects a task depending on itself', () => {
    expect(wouldCreateDependencyCycle(edges, 'a', 'a')).toBe(true)
  })

  it('allows an unrelated dependency', () => {
    expect(wouldCreateDependencyCycle(edges, 'd', 'a')).toBe(false)
  })

  it('detects a direct two-way cycle', () => {
    expect(wouldCreateDependencyCycle(edges, 'a', 'b')).toBe(true)
  })

  it('detects an indirect cycle', () => {
    expect(wouldCreateDependencyCycle(edges, 'a', 'c')).toBe(true)
  })

  it('allows extending a chain forward', () => {
    expect(wouldCreateDependencyCycle(edges, 'd', 'c')).toBe(false)
  })

  it('reports only the dependency ids that would cycle', () => {
    expect(findCyclicDependencies(edges, 'a', ['b', 'd', 'c', 'a'])).toEqual(['b', 'c', 'a'])
  })
})
