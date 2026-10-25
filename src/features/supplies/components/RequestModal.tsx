import { useState } from 'react'
import { Modal } from '@components/ui/Modal'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Button } from '@components/ui/Button'
import type { SupplyItem, SupplyRequestInsert } from '@/types/database'

interface RequestModalProps {
  isOpen: boolean
  items: SupplyItem[]
  onClose: () => void
  onSubmit: (request: Omit<SupplyRequestInsert, 'space_id' | 'requested_by' | 'status'>) => void
}

export function RequestModal({ isOpen, items, onClose, onSubmit }: RequestModalProps) {
  const [itemId, setItemId] = useState('')
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')
  const [notes, setNotes] = useState('')
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const itemOptions = [
    { value: '', label: 'Select an item...' },
    ...items.map((item) => ({
      value: item.id,
      label: item.name,
    })),
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const selectedId = itemId || null
    const name = itemName.trim()

    if (!selectedId && !name) {
      setError('Select an item or enter a custom name')
      return
    }

    const qty = Number(quantity)
    if (qty <= 0) {
      setError('Quantity must be positive')
      return
    }

    const unitValue = selectedId
      ? items.find((i) => i.id === selectedId)?.unit || unit
      : unit.trim()

    if (!unitValue) {
      setError('Unit is required')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        supply_item_id: selectedId,
        item_name: selectedId ? items.find((i) => i.id === selectedId)?.name || name : name,
        quantity: qty,
        unit: unitValue,
        urgency,
        notes: notes.trim() || null,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleItemChange = (value: string) => {
    setItemId(value)
    if (value) {
      const item = items.find((i) => i.id === value)
      if (item) {
        setItemName(item.name)
        setUnit(item.unit)
      }
    } else {
      setItemName('')
      setUnit('')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request supply">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Item"
          options={itemOptions}
          value={itemId}
          onChange={handleItemChange}
        />

        <Input
          label="Item name"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="e.g., Hand soap"
          required
          disabled={!!itemId}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Quantity"
            type="number"
            min="1"
            step="0.1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <Input
            label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g., bottles"
            required
            disabled={!!itemId}
          />
        </div>

        <Select
          label="Urgency"
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
          value={urgency}
          onChange={(value) => setUrgency(value as 'low' | 'medium' | 'high')}
        />

        <Input
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional details..."
          maxLength={500}
        />

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Submit request
          </Button>
        </div>
      </form>
    </Modal>
  )
}
