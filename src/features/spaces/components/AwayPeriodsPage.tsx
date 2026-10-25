import { useState, useEffect } from 'react'
import { Calendar, Plus, X } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { EmptyState } from '@components/ui/EmptyState'
import { ErrorState } from '@components/ui/ErrorState'
import { Skeleton } from '@components/ui/Skeleton'
import { AwayModal } from './AwayModal'
import { getAwayPeriods, createAwayPeriod, endAwayPeriod } from '../api/assignments'
import type { MemberAway, MemberAwayInsert } from '@/types/database'
import { useAuth } from '@contexts/AuthContext'

export function AwayPeriodsPage() {
  const { currentSpace, user } = useAuth()
  const [awayPeriods, setAwayPeriods] = useState<MemberAway[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (currentSpace?.id) {
      loadAwayPeriods()
    }
  }, [currentSpace?.id])

  const loadAwayPeriods = async () => {
    if (!currentSpace?.id) return

    setLoading(true)
    setError(null)

    try {
      const data = await getAwayPeriods(currentSpace.id)
      setAwayPeriods(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load away periods')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (away: Pick<MemberAwayInsert, 'type' | 'starts_at' | 'ends_at' | 'reason'>) => {
    if (!currentSpace?.id) return
    try {
      await createAwayPeriod(currentSpace.id, {
        type: away.type,
        starts_at: away.starts_at,
        ends_at: away.ends_at ?? null,
        reason: away.reason ?? null,
      })
      setShowForm(false)
      await loadAwayPeriods()
    } catch (err: any) {
      console.error('Failed to create away period:', err)
      alert(err.message || 'Failed to create away period')
    }
  }

  const handleEnd = async (id: string) => {
    if (!confirm('End this away period early?')) return

    try {
      await endAwayPeriod(id)
      await loadAwayPeriods()
    } catch (err: any) {
      console.error('Failed to end away period:', err)
      alert(err.message || 'Failed to end away period')
    }
  }

  const isActive = (away: MemberAway) => {
    const now = new Date()
    const start = new Date(away.starts_at)
    const end = away.ends_at ? new Date(away.ends_at) : null
    return start <= now && (!end || end >= now)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadAwayPeriods} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Away Periods</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage absences and pause assignments</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Set away period
        </Button>
      </div>

      {awayPeriods.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-8 w-8" />}
          title="No away periods"
          description="Set away periods when you're unavailable for task assignments"
          action={{ label: 'Set away period', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-3">
          {awayPeriods.map((away) => (
            <Card key={away.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium capitalize">{away.type}</h3>
                    {isActive(away) && (
                      <span className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {new Date(away.starts_at).toLocaleDateString()}
                    {away.ends_at && ` → ${new Date(away.ends_at).toLocaleDateString()}`}
                  </p>
                </div>

                {isActive(away) && away.user_id === user?.id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleEnd(away.id)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    End early
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <AwayModal
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  )
}
