import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { useAuth } from '@contexts/AuthContext'
import { acceptInvitation } from '../api/assignments'

export function InvitationAcceptancePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { refreshSpaces, setCurrentSpace } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accept = async () => {
    if (!token) {
      setError('This invitation link is incomplete.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const spaceId = await acceptInvitation(token)
      const spaces = await refreshSpaces()
      const space = spaces.find((entry) => entry.id === spaceId)
      if (!space) throw new Error('You joined the space, but it could not be loaded. Refresh and try again.')
      setCurrentSpace(space)
      navigate('/today', { replace: true })
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Could not accept this invitation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg p-6">
        <h1 className="text-heading-lg font-semibold text-text">Join a shared space</h1>
        <p className="mt-2 text-sm text-text-muted">
          Accepting adds your account to the space using the role chosen by its manager.
        </p>
        {error && <p className="mt-4 text-sm text-destructive-600" role="alert">{error}</p>}
        <Button className="mt-5" onClick={() => void accept()} loading={busy}>
          Accept invitation
        </Button>
      </Card>
    </main>
  )
}
