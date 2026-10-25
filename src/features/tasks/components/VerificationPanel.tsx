import { useState } from 'react'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Textarea } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { supabase } from '@lib/supabase'

interface VerificationPanelProps {
  instanceId: string
  verificationStatus: 'not_required' | 'pending' | 'verified' | 'rework_requested'
  verifiedBy?: string | null
  verifiedAt?: string | null
  verificationNote?: string | null
  reworkRequestedBy?: string | null
  reworkRequestedAt?: string | null
  reworkNote?: string | null
  canVerify: boolean
  onVerified?: () => void
  onReworkRequested?: () => void
}

export function VerificationPanel({
  instanceId,
  verificationStatus,
  verifiedAt,
  verificationNote,
  reworkRequestedAt,
  reworkNote,
  canVerify,
  onVerified,
  onReworkRequested,
}: VerificationPanelProps) {
  const [isVerifying, setIsVerifying] = useState(false)
  const [isRequestingRework, setIsRequestingRework] = useState(false)
  const [note, setNote] = useState('')

  const handleVerify = async () => {
    setIsVerifying(true)
    try {
      await supabase.rpc('verify_task_instance', {
        p_instance_id: instanceId,
        p_note: note || null,
      })
      setNote('')
      onVerified?.()
    } catch (err: any) {
      console.error('Failed to verify:', err)
      alert(err.message || 'Failed to verify task')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleRequestRework = async () => {
    if (!note.trim()) {
      alert('Please explain what needs another pass')
      return
    }

    setIsRequestingRework(true)
    try {
      await supabase.rpc('request_task_rework', {
        p_instance_id: instanceId,
        p_note: note,
      })
      setNote('')
      onReworkRequested?.()
    } catch (err: any) {
      console.error('Failed to request rework:', err)
      alert(err.message || 'Failed to request rework')
    } finally {
      setIsRequestingRework(false)
    }
  }

  if (verificationStatus === 'not_required') {
    return null
  }

  return (
    <div className="mt-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/50">
      <div className="flex items-center gap-2 mb-3">
        {verificationStatus === 'pending' && (
          <AlertCircle className="h-5 w-5 text-amber-600" />
        )}
        {verificationStatus === 'verified' && (
          <CheckCircle className="h-5 w-5 text-green-600" />
        )}
        {verificationStatus === 'rework_requested' && (
          <XCircle className="h-5 w-5 text-red-600" />
        )}
        <span className="font-medium">
          {verificationStatus === 'pending' && 'Awaiting verification'}
          {verificationStatus === 'verified' && 'Verified'}
          {verificationStatus === 'rework_requested' && 'Rework requested'}
        </span>
      </div>

      {verificationStatus === 'pending' && canVerify && (
        <div className="space-y-3">
          <Textarea
            placeholder="Add a verification note (optional)..."
            value={note}
            onChange={(value) => setNote(value)}
            rows={2}
          />
          <div className="flex gap-2">
            <Button onClick={handleVerify} disabled={isVerifying} size="sm">
              {isVerifying ? 'Verifying...' : 'Verify'}
            </Button>
            <Button
              onClick={() => setIsRequestingRework(true)}
              variant="outline"
              size="sm"
            >
              Request rework
            </Button>
          </div>
        </div>
      )}

      {verificationStatus === 'verified' && (
        <div className="text-sm space-y-1">
          {verifiedAt && (
            <p className="text-gray-600 dark:text-gray-400">
              Verified {new Date(verifiedAt).toLocaleString()}
            </p>
          )}
          {verificationNote && (
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">Note:</span> {verificationNote}
            </p>
          )}
        </div>
      )}

      {verificationStatus === 'rework_requested' && (
        <div className="text-sm space-y-2">
          {reworkNote && (
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-medium">Reason:</span> {reworkNote}
            </p>
          )}
          {reworkRequestedAt && (
            <p className="text-gray-600 dark:text-gray-400">
              Requested {new Date(reworkRequestedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {isRequestingRework && (
        <Modal
          isOpen={isRequestingRework}
          onClose={() => setIsRequestingRework(false)}
          title="Request rework"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Explain what needs another pass. This will create a new task instance for the
              assignee.
            </p>
            <Textarea
              placeholder="Describe what needs to be fixed..."
              value={note}
              onChange={(value) => setNote(value)}
              rows={4}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsRequestingRework(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRequestRework}
                disabled={!note.trim() || isRequestingRework}
              >
                {isRequestingRework ? 'Requesting...' : 'Request rework'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
