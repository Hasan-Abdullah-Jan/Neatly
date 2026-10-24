import { describe, expect, it } from 'vitest'
import type { SpaceType } from '@/types/database'
import { TEMPLATE_PACKS, getAllSpaceTypes, getTemplatePack } from './templatePacks'

const spaceTypes = Object.keys(TEMPLATE_PACKS) as SpaceType[]

describe('template packs', () => {
  it('provides a pack for every supported space type', () => {
    expect(spaceTypes.sort()).toEqual(
      ['healthcare', 'institution', 'personal', 'shared_home', 'workplace', 'custom'].sort()
    )
    expect(getAllSpaceTypes()).toHaveLength(spaceTypes.length)
  })

  it('keeps packs data-only and non-empty', () => {
    for (const type of spaceTypes) {
      const pack = getTemplatePack(type)
      expect(pack.spaceType).toBe(type)
      expect(pack.label.length).toBeGreaterThan(0)
      expect(pack.suggestedAreas.length).toBeGreaterThan(0)

      for (const area of pack.suggestedAreas) {
        expect(area.name.length).toBeGreaterThan(0)
        expect(area.suggestedTasks.length).toBeGreaterThan(0)
        for (const task of area.suggestedTasks) {
          expect(task.name.length).toBeGreaterThan(0)
          expect(task.estimatedMinutes).toBeGreaterThan(0)
        }
      }
    }
  })

  it('always keeps core task and area modules on', () => {
    for (const type of spaceTypes) {
      const pack = getTemplatePack(type)
      expect(pack.defaultModules.tasks).toBe(true)
      expect(pack.defaultModules.areas).toBe(true)
    }
  })

  it('matches the requested type in getAllSpaceTypes', () => {
    const listed = getAllSpaceTypes()
    for (const item of listed) {
      expect(getTemplatePack(item.type).label).toBe(item.label)
    }
  })
})
