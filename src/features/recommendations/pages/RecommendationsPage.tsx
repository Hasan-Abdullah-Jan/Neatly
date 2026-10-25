import { useCallback, useEffect, useState } from 'react'
import { Check, Lightbulb, RefreshCw, X } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { useAuth } from '@contexts/AuthContext'
import { fetchMembershipRole } from '@features/tasks/api/tasks'
import { isTaskManager } from '@features/tasks/lib/permissions'
import type { Recommendation, RecommendationAction as StoredAction, RecommendationUpdate } from '@/types/database'
import {
  generateRecommendations,
  listRecommendations,
  updateRecommendation,
} from '../api/recommendations'
import type { RecommendationAction } from '../lib/rules'

const actionLabels: Record<RecommendationAction, string> = {
  reduce_scope: 'Reduce the task scope',
  split_task: 'Split it into smaller tasks',
  change_time: 'Change its scheduled time',
  reassign: 'Review who it is assigned to',
  review_frequency: 'Review task frequency',
  review_bin_capacity: 'Review bin capacity',
  review_access: 'Review access to the area',
  review_supplies: 'Review available supplies',
  review_ownership: 'Review task ownership',
  add_to_replenishment: 'Add it to the replenishment list',
  create_supply_request: 'Create a supply request',
  create_organization_task: 'Create a short organization task',
  spread_non_urgent_tasks: 'Spread non-urgent tasks across the week',
  suggest_area_check: 'Suggest a quick check of the area',
  check_plant: 'Check the plant condition and care notes',
  review_clutter_zone: 'Review this cluttered zone',
}

type RecommendationRecord = Recommendation & {
  data: Recommendation['data'] & { actions?: RecommendationAction[]; rule_id?: string }
}

function actionsFor(record: RecommendationRecord): RecommendationAction[] {
  if (!Array.isArray(record.data.actions)) return []
  return record.data.actions.filter((action): action is RecommendationAction => action in actionLabels).slice(0, 2)
}

export function RecommendationsPage() {
  const { currentSpace, user } = useAuth()
  const [items, setItems] = useState<Recommendation[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedActions, setSelectedActions] = useState<Record<string, RecommendationAction>>({})

  const load = useCallback(async () => {
    if (!currentSpace || !user) {
      setItems([])
      setCanManage(false)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [role, recommendations] = await Promise.all([
        fetchMembershipRole(currentSpace.id, user.id),
        listRecommendations(currentSpace.id),
      ])
      setCanManage(isTaskManager(role))
      setItems(recommendations)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Suggestions could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [currentSpace, user])

  useEffect(() => {
    void load()
  }, [load])

  const handleGenerate = async () => {
    if (!currentSpace || !user) return
    setGenerating(true)
    setError(null)
    try {
      const created = await generateRecommendations(currentSpace.id, user.id, currentSpace.timezone)
      setItems((current) => [...created, ...current])
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Suggestions could not be generated.')
    } finally {
      setGenerating(false)
    }
  }

  const update = async (record: Recommendation, updates: RecommendationUpdate) => {
    if (!currentSpace || !user) return
    setSavingId(record.id)
    setError(null)
    try {
      const saved = await updateRecommendation(currentSpace.id, user.id, record.id, updates)
      setItems((current) => current.map((item) => item.id === saved.id ? saved : item))
      setEditingId(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The suggestion could not be updated.')
    } finally {
      setSavingId(null)
    }
  }

  const setStatus = (record: Recommendation, status: Recommendation['status'], action: StoredAction, actionData: Recommendation['action_data'] = null) => {
    void update(record, {
      status,
      action,
      action_data: actionData,
      ...(status === 'dismissed' || status === 'disabled'
        ? { dismissed_at: new Date().toISOString(), dismissed_by: user?.id ?? null }
        : {}),
    })
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4" aria-label="Loading suggestions">
        <div className="h-10 animate-pulse rounded-xl bg-surface-elevated" />
        <div className="h-36 animate-pulse rounded-2xl bg-surface-elevated" />
        <div className="h-36 animate-pulse rounded-2xl bg-surface-elevated" />
      </div>
    )
  }

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface p-6">
        <h1 className="text-heading-xl font-semibold text-text">Suggestions</h1>
        <p className="mt-2 text-text-muted">Operational suggestions are visible to space managers only.</p>
      </div>
    )
  }

  const pending = items.filter((item) => item.status === 'pending')
  const history = items.filter((item) => item.status !== 'pending')

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-heading-xl font-semibold text-text">Insights & suggestions</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Suggestions are based on records from this space. They are options to review, not conclusions about people.
          </p>
        </div>
        <Button onClick={() => void handleGenerate()} disabled={generating} loading={generating} leftIcon={<RefreshCw className="h-4 w-4" />}>
          Generate suggestions
        </Button>
      </header>

      <p className="text-xs text-text-muted">Signals use a rolling 30-day data window unless a card states otherwise. Up to three new cards are shown per week.</p>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive-200 bg-destructive-50 p-3 text-sm text-destructive-text">
          {error}
        </p>
      )}

      {pending.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <Lightbulb className="mx-auto mb-3 h-8 w-8 text-primary-text" aria-hidden="true" />
          <h2 className="font-semibold text-text">No suggestions to review</h2>
          <p className="mt-1 text-sm text-text-muted">Generate suggestions to check recent task, issue, supply, and area records.</p>
        </section>
      ) : (
        <section aria-label="Suggestions to review" className="space-y-4">
          {pending.map((item) => {
            const record = item as RecommendationRecord
            const actions = actionsFor(record)
            const selectedAction = selectedActions[item.id] ?? actions[0]
            return (
              <article key={item.id} className="rounded-2xl border border-border bg-surface p-5 shadow-surface">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-xl bg-primary-light p-2 text-primary-text">
                    <Lightbulb className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {editingId === item.id ? (
                      <label className="block text-sm font-medium text-text">
                        Edit suggestion title
                        <input
                          className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-text"
                          value={editedTitles[item.id] ?? item.title}
                          maxLength={160}
                          onChange={(event) => setEditedTitles((current) => ({ ...current, [item.id]: event.target.value }))}
                        />
                      </label>
                    ) : (
                      <h2 className="font-semibold text-text">{item.title}</h2>
                    )}
                    <p className="mt-1 text-sm text-text-muted">{item.reason}</p>
                    {actions.length > 0 && (
                      <label className="mt-4 block text-sm font-medium text-text">
                        Possible next step
                        <select
                          className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-text sm:max-w-xl"
                          value={selectedAction}
                          onChange={(event) => {
                            const action = event.target.value as RecommendationAction
                            setSelectedActions((current) => ({ ...current, [item.id]: action }))
                          }}
                        >
                          {actions.map((action) => <option key={action} value={action}>{actionLabels[action]}</option>)}
                        </select>
                      </label>
                    )}
                    <time className="mt-3 block text-xs text-text-muted" dateTime={item.created_at}>
                      {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.created_at))}
                    </time>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {editingId === item.id ? (
                        <>
                          <Button
                            size="sm"
                            disabled={!editedTitles[item.id]?.trim() || savingId === item.id}
                            onClick={() => setStatus(item, 'edited', 'edit', {
                              edited_title: editedTitles[item.id]?.trim() ?? item.title,
                              selected_action: selectedAction ?? null,
                            })}
                          >
                            Save edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            leftIcon={<Check className="h-4 w-4" />}
                            disabled={savingId === item.id}
                            onClick={() => setStatus(item, 'accepted', 'accept', { selected_action: selectedAction ?? null })}
                          >
                            Accept option
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingId === item.id}
                            onClick={() => {
                              setEditedTitles((current) => ({ ...current, [item.id]: item.title }))
                              setEditingId(item.id)
                            }}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" disabled={savingId === item.id} onClick={() => setStatus(item, 'dismissed', 'dismiss')}>
                            <X className="mr-1 h-4 w-4" aria-hidden="true" />Dismiss
                          </Button>
                          <Button size="sm" variant="ghost" disabled={savingId === item.id} onClick={() => setStatus(item, 'disabled', 'disable')}>
                            Turn off this suggestion type
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      )}

      {history.length > 0 && (
        <details className="rounded-2xl border border-border bg-surface p-5">
          <summary className="cursor-pointer font-semibold text-text">Previous decisions ({history.length})</summary>
          <ul className="mt-4 space-y-3">
            {history.map((item) => (
              <li key={item.id} className="border-t border-border pt-3">
                <p className="font-medium text-text">{item.title}</p>
                <p className="text-sm text-text-muted">{item.reason}</p>
                <p className="mt-1 text-xs capitalize text-text-muted">Status: {item.status}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
