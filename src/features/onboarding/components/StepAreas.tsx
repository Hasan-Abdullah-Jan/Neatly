import { useState } from 'react'
import { cn } from '@lib/utils'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Card, CardContent } from '@components/ui/Card'
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CornerDownRight,
  Plus,
  Trash2,
} from 'lucide-react'
import type { OnboardingActions, OnboardingArea } from '../hooks/useOnboarding'

interface StepAreasProps {
  onboarding: OnboardingActions
}

const categoryOptions = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'living', label: 'Living area' },
  { value: 'dining', label: 'Dining' },
  { value: 'office', label: 'Office' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'entry', label: 'Entryway' },
  { value: 'hallway', label: 'Hallway' },
  { value: 'storage', label: 'Storage' },
  { value: 'garden', label: 'Garden / yard' },
  { value: 'reception', label: 'Reception' },
  { value: 'meeting', label: 'Meeting room' },
  { value: 'waiting', label: 'Waiting room' },
  { value: 'exam', label: 'Exam room' },
  { value: 'classroom', label: 'Classroom' },
  { value: 'common', label: 'Common area' },
  { value: 'custom', label: 'Custom' },
]

const categoryLabels = new Map(categoryOptions.map((option) => [option.value, option.label]))

function areaDepth(areas: OnboardingArea[], area: OnboardingArea): number {
  let depth = 0
  let current: OnboardingArea | undefined = area
  while (current?.parentId) {
    depth += 1
    current = areas.find((candidate) => candidate.id === current?.parentId)
    if (depth > 5) break
  }
  return depth
}

export function StepAreas({ onboarding }: StepAreasProps) {
  const { state, activeAreas } = onboarding
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [newAreaName, setNewAreaName] = useState('')
  const [newAreaCategory, setNewAreaCategory] = useState('custom')
  const [newAreaParent, setNewAreaParent] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const archivedAreas = state.areas.filter((area) => area.archived)
  const suggestions = state.templatePack?.suggestedAreas ?? []
  const unusedSuggestions = suggestions.filter(
    (suggestion) =>
      !state.areas.some((area) => area.name === suggestion.name && !area.archived)
  )

  const handleAddSuggested = (name: string) => {
    onboarding.addSuggestedArea(name)
  }

  const handleAddCustom = () => {
    const name = newAreaName.trim()
    if (!name) return
    onboarding.addArea({
      name,
      category: newAreaCategory,
      description: '',
      parentId: newAreaParent || null,
      isCustom: true,
      suggestedTasks: [],
    })
    setNewAreaName('')
    setNewAreaParent('')
    setShowAddCustom(false)
  }

  const renderArea = (area: OnboardingArea) => {
    const siblings = activeAreas
      .filter((candidate) => candidate.parentId === area.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const index = siblings.findIndex((candidate) => candidate.id === area.id)
    const depth = areaDepth(state.areas, area)
    const children = activeAreas
      .filter((candidate) => candidate.parentId === area.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const taskCount = area.selectedTasks.length

    return (
      <li key={area.id} className={cn(depth > 0 && 'ml-4 sm:ml-8 border-l-2 border-border pl-3 sm:pl-4')}>
        <Card variant="outlined" className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={`Area name: ${area.name}`}
                value={area.name}
                onChange={(event) => onboarding.updateArea(area.id, { name: event.target.value })}
                className="flex-1 min-w-[140px] border-transparent bg-transparent px-2 py-1 font-medium"
                maxLength={60}
              />
              <span className="px-2 py-0.5 text-xs text-text-muted bg-neutral-100 dark:bg-neutral-800 rounded">
                {categoryLabels.get(area.category) ?? area.category}
              </span>
              <span className="text-xs text-text-muted">
                {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
              </span>
              {area.isCustom && (
                <span className="px-2 py-0.5 text-xs text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/30 rounded">
                  Custom
                </span>
              )}

              <div className="flex items-center gap-0.5 ml-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onboarding.moveArea(area.id, 'up')}
                  disabled={index <= 0}
                  aria-label={`Move ${area.name} up`}
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onboarding.moveArea(area.id, 'down')}
                  disabled={index === siblings.length - 1}
                  aria-label={`Move ${area.name} down`}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onboarding.nestArea(area.id)}
                  disabled={index <= 0 || depth >= 2}
                  aria-label={`Nest ${area.name} under the area above`}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onboarding.unnestArea(area.id)}
                  disabled={!area.parentId}
                  aria-label={`Move ${area.name} out one level`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onboarding.archiveArea(area.id)}
                  aria-label={`Archive ${area.name}`}
                >
                  <Archive className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onboarding.removeArea(area.id)}
                  className="text-destructive-600"
                  aria-label={`Remove ${area.name} from this draft`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {area.parentId && (
              <p className="mt-1 text-xs text-text-muted flex items-center gap-1">
                <CornerDownRight className="w-3 h-3" aria-hidden="true" />
                Nested under {state.areas.find((candidate) => candidate.id === area.parentId)?.name ?? 'zone'}
              </p>
            )}
          </CardContent>
        </Card>

        {children.length > 0 && <ul className="mt-2 space-y-2" role="list">{children.map(renderArea)}</ul>}
      </li>
    )
  }

  const rootAreas = activeAreas
    .filter((area) => !area.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-heading-sm font-medium text-text">Your areas</h3>
          <p className="text-sm text-text-muted mt-1">
            Rename, reorder, nest under a zone, or archive. Archived areas are skipped when you activate.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddCustom((value) => !value)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Custom area
        </Button>
      </div>

      {unusedSuggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-text mb-2">Suggested for this profile</h4>
          <div className="flex flex-wrap gap-2">
            {unusedSuggestions.map((suggestion) => (
              <button
                key={suggestion.name}
                type="button"
                onClick={() => handleAddSuggested(suggestion.name)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-text hover:border-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                {suggestion.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAddCustom && (
        <Card variant="outlined" className="bg-neutral-50 dark:bg-neutral-900/40">
          <CardContent className="p-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Area name"
                placeholder="e.g. Home gym, Quiet room"
                value={newAreaName}
                onChange={(event) => setNewAreaName(event.target.value)}
                maxLength={60}
                autoFocus
              />
              <Select
                label="Category"
                options={categoryOptions}
                value={newAreaCategory}
                onChange={setNewAreaCategory}
              />
              <Select
                label="Nest under (optional)"
                options={[
                  { value: '', label: 'Top level' },
                  ...activeAreas.map((area) => ({ value: area.id, label: area.name })),
                ]}
                value={newAreaParent}
                onChange={setNewAreaParent}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddCustom(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleAddCustom} disabled={!newAreaName.trim()}>
                Add area
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {rootAreas.length === 0 ? (
        <Card variant="outlined" className="border-dashed">
          <CardContent className="py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-3">
              <Plus className="w-6 h-6 text-primary-600" aria-hidden="true" />
            </div>
            <p className="font-medium text-text">No areas yet</p>
            <p className="text-sm text-text-muted mt-1">
              Add a suggested area above, or create one that fits your space.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3" role="list">{rootAreas.map(renderArea)}</ul>
      )}

      {archivedAreas.length > 0 && (
        <div className="border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowArchived((value) => !value)}
            aria-expanded={showArchived}
          >
            <Archive className="w-4 h-4 mr-2" />
            {showArchived ? 'Hide' : 'Show'} archived ({archivedAreas.length})
          </Button>
          {showArchived && (
            <ul className="mt-3 space-y-2" role="list">
              {archivedAreas.map((area) => (
                <li
                  key={area.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-text-muted line-through">{area.name}</p>
                    <p className="text-xs text-text-muted">{area.selectedTasks.length} tasks kept in draft</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onboarding.archiveArea(area.id)}
                    leftIcon={<ArchiveRestore className="w-4 h-4" />}
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
