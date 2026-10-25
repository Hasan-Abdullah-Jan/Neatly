import { useEffect, useState } from 'react'
import { Modal } from '@components/ui/Modal'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import { setPin, removePin, getPinStatus } from '../api/sharedDevice'

interface PinSetupModalProps {
  spaceId: string
  isOpen: boolean
  onClose: () => void
}

export function PinSetupModal({ spaceId, isOpen, onClose }: PinSetupModalProps) {
  const [pinValue, setPinValue] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [hasPin, setHasPin] = useState(false)
  const [error, setError] = useState('')

  const loadStatus = async () => {
    try {
      const status = await getPinStatus(spaceId)
      setHasPin(status.has_pin)
    } catch (err) {
      console.error('Failed to load PIN status:', err)
    }
  }

  useEffect(() => {
    if (isOpen) {
      void loadStatus()
    }
  }, [isOpen, spaceId])

  const handleSetPin = async () => {
    setError('')

    if (pinValue.length < 4 || pinValue.length > 6) {
      setError('PIN must be 4-6 digits')
      return
    }

    if (!/^\d+$/.test(pinValue)) {
      setError('PIN must contain only numbers')
      return
    }

    if (pinValue !== confirmPin) {
      setError('PINs do not match')
      return
    }

    try {
      await setPin(spaceId, pinValue)
      setPinValue('')
      setConfirmPin('')
      setHasPin(true)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to set PIN')
    }
  }

  const handleRemovePin = async () => {
    setError('')

    try {
      await removePin(spaceId)
      setHasPin(false)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to remove PIN')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Shared Device PIN">
      <div className="space-y-4">
        {!hasPin ? (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Set a 4-6 digit PIN to sign in on this shared device. Other members will set their own
              PINs.
            </p>

            <div>
              <label htmlFor="pin" className="block text-sm font-medium mb-1">
                PIN
              </label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value)}
                placeholder="1234"
                maxLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirmPin" className="block text-sm font-medium mb-1">
                Confirm PIN
              </label>
              <Input
                id="confirmPin"
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="1234"
                maxLength={6}
              />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSetPin} disabled={!pinValue || !confirmPin}>
                Set PIN
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You have a PIN set for this space. Removing it will revoke all active sessions.
            </p>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRemovePin}>
                Remove PIN
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
