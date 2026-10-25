import { useState, useEffect } from 'react'
import { Modal } from '@components/ui/Modal'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import { getSharedDeviceMembers, openSession } from '../api/sharedDevice'
import type { SharedDeviceMember, SharedDeviceSession } from '../api/sharedDevice'

interface SessionSelectorProps {
  spaceId: string
  isOpen: boolean
  onClose: () => void
  onSessionStart: (session: SharedDeviceSession) => void
}

export function SessionSelector({
  spaceId,
  isOpen,
  onClose,
  onSessionStart,
}: SessionSelectorProps) {
  const [members, setMembers] = useState<SharedDeviceMember[]>([])
  const [selectedMember, setSelectedMember] = useState<SharedDeviceMember | null>(null)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && spaceId) {
      loadMembers()
    }
  }, [isOpen, spaceId])

  const loadMembers = async () => {
    try {
      const data = await getSharedDeviceMembers(spaceId)
      setMembers(data)
    } catch (err) {
      console.error('Failed to load members:', err)
      setError('Failed to load members')
    }
  }

  const handleOpenSession = async () => {
    if (!selectedMember) return

    setError('')
    setLoading(true)

    try {
      const session = await openSession(spaceId, selectedMember.member_id, pin)
      setPin('')
      setSelectedMember(null)
      onSessionStart(session)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to open session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Who are you?">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Select your name and enter your PIN to sign in on this shared device.
        </p>

        <div>
          <label className="block text-sm font-medium mb-2">Select your name</label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {members.map((member) => (
              <button
                key={member.member_id}
                type="button"
                onClick={() => setSelectedMember(member)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedMember?.member_id === member.member_id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{member.full_name}</span>
                  {!member.has_pin && (
                    <span className="text-xs text-gray-500">No PIN set</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 capitalize">{member.role}</div>
              </button>
            ))}
          </div>
        </div>

        {selectedMember && (
          <div>
            <label htmlFor="pin" className="block text-sm font-medium mb-1">
              Enter your PIN
            </label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              maxLength={6}
              autoFocus
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleOpenSession}
            disabled={!selectedMember || !pin || loading || !selectedMember.has_pin}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
