import type { ChecklistItem, ChecklistResult } from '../api/checklist'
import { Check, X, AlertTriangle } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Textarea } from '@components/ui/Input'
import { useState } from 'react'

interface ChecklistExecutionProps {
  items: ChecklistItem[]
  results: ChecklistResult[]
  onSaveResult: (
    itemId: string,
    status: 'done' | 'not_applicable' | 'problem',
    note?: string
  ) => Promise<void>
  disabled?: boolean
  canReportIssue?: boolean
  onReportIssue?: (itemId: string) => void
}

export function ChecklistExecution({
  items,
  results,
  onSaveResult,
  disabled,
  canReportIssue = false,
  onReportIssue,
}: ChecklistExecutionProps) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const getResult = (itemId: string) => results.find((r) => r.checklist_item_id === itemId)

  const handleSave = async (itemId: string, status: 'done' | 'not_applicable' | 'problem') => {
    setSaving((prev) => ({ ...prev, [itemId]: true }))
    try {
      await onSaveResult(itemId, status, notes[itemId])
      setNotes((prev) => ({ ...prev, [itemId]: '' }))
    } finally {
      setSaving((prev) => ({ ...prev, [itemId]: false }))
    }
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const result = getResult(item.id)
        const isSaving = saving[item.id]

        return (
          <div
            key={item.id}
            className={`p-4 border rounded-lg ${
              result?.status === 'problem'
                ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20'
                : result?.status === 'done'
                  ? 'border-green-300 bg-green-50 dark:bg-green-950/20'
                  : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium">{item.label}</p>
                {result?.note && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{result.note}</p>
                )}
              </div>

              <div className="flex items-center gap-1">
                {!result && !disabled && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSave(item.id, 'done')}
                      disabled={isSaving}
                      className="text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-950/30"
                      aria-label="Mark as done"
                    >
                      <Check className="h-5 w-5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSave(item.id, 'not_applicable')}
                      disabled={isSaving}
                      className="text-gray-600 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-950/30"
                      aria-label="Mark as not applicable"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSave(item.id, 'problem')}
                      disabled={isSaving}
                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-950/30"
                      aria-label="Report problem"
                    >
                      <AlertTriangle className="h-5 w-5" />
                    </Button>
                  </>
                )}

                {result && (
                  <div className="flex items-center gap-2">
                    {result.status === 'done' && (
                      <span className="inline-flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
                        <Check className="h-4 w-4" />
                        Done
                      </span>
                    )}
                    {result.status === 'not_applicable' && (
                      <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <X className="h-4 w-4" />
                        Not applicable
                      </span>
                    )}
                    {result.status === 'problem' && (
                      <span className="inline-flex items-center gap-1 text-sm text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                        Problem
                      </span>
                    )}
                    {!disabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSave(item.id, 'done')}
                        disabled={isSaving}
                      >
                        Change
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!result && !disabled && (
              <div className="mt-3">
                <Textarea
                  placeholder="Add a note (optional)..."
                  value={notes[item.id] || ''}
                  onChange={(value) => setNotes((prev) => ({ ...prev, [item.id]: value }))}
                  rows={2}
                  className="text-sm"
                />
              </div>
            )}

            {result?.status === 'problem' && canReportIssue && onReportIssue && (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onReportIssue(item.id)}
                >
                  Report issue
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
