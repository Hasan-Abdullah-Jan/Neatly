import { useState, useEffect } from 'react'
import { Modal } from '@components/ui/Modal'
import { Input } from '@components/ui/Input'
import { Button } from '@components/ui/Button'
import { createSupplyItem, updateSupplyItem } from '../api/supplies'
import type { SupplyItem } from '@/types/database'

interface SupplyFormModalProps {
  isOpen: boolean
  item: SupplyItem | null
  onClose: () => void
}

const DEFAULT_CATEGORIES = [
  'Cleaning supplies',
  'Paper products',
  'Trash bags',
  'Tools',
  'Safety equipment',
  'First aid',
  'Other',
]

export function SupplyFormModal({ isOpen, item, onClose }: SupplyFormModalProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('')
  const [quantity, setQuantity] = useState('0')
  const [minQuantity, setMinQuantity] = useState('1')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (item) {
      setName(item.name)
      setCategory(item.category || '')
      setUnit(item.unit)
      setQuantity(String(item.quantity))
      setMinQuantity(String(item.min_quantity))
      setLocation(item.location || '')
      setDescription(item.description || '')
    } else {
      setName('')
      setCategory('')
      setUnit('')
      setQuantity('0')
      setMinQuantity('1')
      setLocation('')
      setDescription('')
    }
    setError('')
  }, [item, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!unit.trim()) {
      setError('Unit is required')
      return
    }

    setSubmitting(true)
    try {
      const data = {
        name: name.trim(),
        category: category.trim() || null,
        unit: unit.trim(),
        quantity: Number(quantity),
        min_quantity: Number(minQuantity),
        location: location.trim() || null,
        description: description.trim() || null,
      }

      if (item) {
        await updateSupplyItem(item.id, data)
      } else {
        await createSupplyItem(data)
      }

      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save supply item')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? 'Edit supply' : 'Add supply'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Hand soap"
          required
          autoFocus
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g., Cleaning supplies"
            list="categories"
          />
          <datalist id="categories">
            {DEFAULT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>

          <Input
            label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g., bottles, rolls, pieces"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Current quantity"
            type="number"
            min="0"
            step="0.1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <Input
            label="Minimum threshold"
            type="number"
            min="0"
            step="0.1"
            value={minQuantity}
            onChange={(e) => setMinQuantity(e.target.value)}
            required
            hint="Alert when quantity falls below this"
          />
        </div>

        <Input
          label="Storage location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g., Kitchen cabinet, Supply closet"
        />

        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Additional details..."
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
            {item ? 'Save changes' : 'Add item'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
