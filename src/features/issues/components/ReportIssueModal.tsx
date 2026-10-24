import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@components/ui/Button'
import { Input, Textarea } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { Select } from '@components/ui/Select'
import { Badge } from '@components/ui/Badge'
import { ImagePlus, ShieldCheck, Trash2 } from 'lucide-react'
import type { Area, IssueCategory, IssuePriority } from '@/types/database'
import {
  ISSUE_PHOTO_GUIDANCE,
  ISSUE_PHOTO_MAX_BYTES,
  ISSUE_PHOTO_TYPES,
  issueCategoryLabels,
  issueCategoryValues,
  issuePriorityLabels,
  issuePriorityValues,
  issueReportSchema,
  type IssueReportInput,
} from '../api/schema'

export interface ReportIssueModalProps {
  isOpen: boolean
  areas: Area[]
  defaultAreaId?: string | null
  photosEnabled: boolean
  submitting: boolean
  onClose: () => void
  onSubmit: (input: IssueReportInput, photo: File | null) => Promise<boolean>
}

const priorityStyles: Record<IssuePriority, string> = {
  low: 'border-border text-text-muted',
  medium: 'border-info-300 bg-info-50 text-info-800 dark:border-info-800 dark:bg-info-900/20 dark:text-info-200',
  high: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200',
  urgent:
    'border-destructive-300 bg-destructive-50 text-destructive-800 dark:border-destructive-800 dark:bg-destructive-900/20 dark:text-destructive-200',
}

export function ReportIssueModal({
  isOpen,
  areas,
  defaultAreaId,
  photosEnabled,
  submitting,
  onClose,
  onSubmit,
}: ReportIssueModalProps) {
  const [areaId, setAreaId] = useState(defaultAreaId ?? '')
  const [category, setCategory] = useState<IssueCategory>('cleanliness')
  const [customCategory, setCustomCategory] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<IssuePriority>('medium')
  const [photo, setPhoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setAreaId(defaultAreaId ?? '')
    setCategory('cleanliness')
    setCustomCategory('')
    setDescription('')
    setPriority('medium')
    setPhoto(null)
    setPhotoError(null)
    setErrors({})
  }, [defaultAreaId, isOpen])

  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const areaOptions = useMemo(
    () => [
      { value: '', label: 'No specific area' },
      ...areas.map((area) => ({
        value: area.id,
        label: area.active ? area.name : `${area.name} (archived)`,
      })),
    ],
    [areas]
  )

  const handlePhoto = (file: File | null) => {
    setPhotoError(null)
    if (!file) {
      setPhoto(null)
      return
    }
    if (!ISSUE_PHOTO_TYPES.includes(file.type)) {
      setPhotoError('Choose a JPEG, PNG, or WebP photo.')
      return
    }
    if (file.size > ISSUE_PHOTO_MAX_BYTES) {
      setPhotoError('Choose a photo smaller than 5 MB.')
      return
    }
    setPhoto(file)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const input: IssueReportInput = {
      areaId: areaId || null,
      category,
      customCategory,
      description,
      priority,
      dueAt: null,
    }

    const parsed = issueReportSchema.safeParse(input)
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String)[0] ?? 'form'
        if (!nextErrors[key]) nextErrors[key] = issue.message
      }
      setErrors(nextErrors)
      return
    }

    setErrors({})
    const saved = await onSubmit(parsed.data, photo)
    if (saved) onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Report an issue"
      description="Pick the area and category, then add a few words. A photo is optional."
      size="lg"
      closeOnOverlayClick={!submitting}
      closeOnEscape={!submitting}
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Select
          label="Area"
          options={areaOptions}
          value={areaId}
          onChange={setAreaId}
          hint="Choose where the issue is, or leave it general."
        />

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-text">Category</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {issueCategoryValues.map((value) => {
              const selected = category === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategory(value)}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    selected
                      ? 'border-primary-500 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-200'
                      : 'border-border bg-surface text-text hover:border-primary-300 dark:hover:border-primary-700'
                  }`}
                >
                  {issueCategoryLabels[value]}
                </button>
              )
            })}
          </div>
          {category === 'custom' && (
            <div className="mt-3">
              <Input
                label="Custom category name"
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value)}
                error={errors.customCategory}
                maxLength={60}
                autoFocus
              />
            </div>
          )}
        </fieldset>

        <Textarea
          label="What needs attention?"
          value={description}
          onChange={setDescription}
          error={errors.description}
          hint="A sentence is enough. Avoid names or personal details."
          rows={4}
          maxLength={2000}
          required
        />

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-text">Priority</legend>
          <div className="flex flex-wrap gap-2">
            {issuePriorityValues.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={priority === value}
                onClick={() => setPriority(value)}
                className={`min-h-10 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  priority === value
                    ? priorityStyles[value]
                    : 'border-border bg-surface text-text-muted hover:text-text'
                }`}
              >
                {issuePriorityLabels[value]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-text-muted" aria-hidden="true" />
              <p className="text-sm font-medium text-text">Photo (optional)</p>
              <Badge variant="outline" size="sm">
                Off by default
              </Badge>
            </div>
            {photosEnabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
              >
                {photo ? 'Change photo' : 'Add a photo'}
              </Button>
            )}
          </div>

          {photosEnabled ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ISSUE_PHOTO_TYPES.join(',')}
                className="sr-only"
                onChange={(event) => handlePhoto(event.target.files?.[0] ?? null)}
                aria-label="Choose an issue photo"
              />
              <p className="mt-2 text-xs text-text-muted">{ISSUE_PHOTO_GUIDANCE}</p>
              {photoError && (
                <p className="mt-2 text-sm text-destructive-600 dark:text-destructive-400" role="alert">
                  {photoError}
                </p>
              )}
              {photo && previewUrl && (
                <div className="mt-3 flex items-start gap-3">
                  <img
                    src={previewUrl}
                    alt="Preview of the photo you selected"
                    className="h-24 w-24 rounded-lg border border-border object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{photo.name}</p>
                    <p className="text-xs text-text-muted">
                      {submitting ? 'Uploading with the issue...' : 'Ready to upload'}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-1"
                      onClick={() => handlePhoto(null)}
                      disabled={submitting}
                      leftIcon={<Trash2 className="h-4 w-4" />}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="mt-2 flex items-start gap-2 text-xs text-text-muted">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              Photos are off for this space. You can turn them on in Space settings. Issue text
              and status never depend on photos.
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? 'Reporting...' : 'Report issue'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
