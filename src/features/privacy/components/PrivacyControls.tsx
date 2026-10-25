import { useState } from 'react'
import { FileJson, FileSpreadsheet, Trash2 } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { useToastHelpers } from '@components/ui/Toast'
import { deleteMyAccount, downloadPrivacyExport } from '../api/privacy'

export function PrivacyControls() {
  const { showSuccess, showError } = useToastHelpers()
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)

  const exportData = async (format: 'json' | 'csv') => {
    setExporting(format)
    try {
      await downloadPrivacyExport(format)
      showSuccess('Export ready', `Your data was downloaded as ${format.toUpperCase()}.`)
    } catch (error) {
      showError('Export failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setExporting(null)
    }
  }

  const deleteAccount = async () => {
    setDeleting(true)
    try {
      await deleteMyAccount()
      window.location.replace('/login')
    } catch (error) {
      showError('Account deletion failed', error instanceof Error ? error.message : 'Please contact support.')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="font-medium text-text">Export your personal data</h3>
          <p className="text-sm text-text-muted">Download the records associated with your account. Exports are recorded in the audit log.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" loading={exporting === 'json'} disabled={exporting !== null} onClick={() => void exportData('json')} leftIcon={<FileJson className="h-4 w-4" />}>
            Export JSON
          </Button>
          <Button variant="outline" loading={exporting === 'csv'} disabled={exporting !== null} onClick={() => void exportData('csv')} leftIcon={<FileSpreadsheet className="h-4 w-4" />}>
            Export CSV
          </Button>
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-5">
        <div>
          <h3 className="font-medium text-destructive-700 dark:text-destructive-300">Delete your account</h3>
          <p className="text-sm text-text-muted">
            This permanently removes your sign-in and profile, removes sole-member personal spaces, transfers organization ownership where possible, and anonymizes retained shared records. Export first if you need a copy. Shared operational records and files may be retained under the organization’s retention policy.
          </p>
        </div>
        <Input
          label="Type DELETE to confirm"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          disabled={deleting}
        />
        <Button
          variant="destructive"
          loading={deleting}
          disabled={confirmation !== 'DELETE'}
          onClick={() => void deleteAccount()}
          leftIcon={<Trash2 className="h-4 w-4" />}
        >
          Permanently delete account
        </Button>
      </section>
      <p className="text-xs text-text-muted">
        Neatly does not use third-party advertising or analytics trackers. Data export and deletion requests are written to the workspace audit log.
      </p>
    </div>
  )
}
