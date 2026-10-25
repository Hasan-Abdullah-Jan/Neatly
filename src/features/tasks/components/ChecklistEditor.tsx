import { useState } from 'react'
import { X, Plus, GripVertical } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'

interface ChecklistEditorProps {
  items: string[]
  onChange: (items: string[]) => void
  disabled?: boolean
}

export function ChecklistEditor({ items, onChange, disabled }: ChecklistEditorProps) {
  const [newItem, setNewItem] = useState('')

  const addItem = () => {
    if (newItem.trim() && items.length < 30) {
      onChange([...items, newItem.trim()])
      setNewItem('')
    }
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, value: string) => {
    const updated = [...items]
    updated[index] = value
    onChange(updated)
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <GripVertical className="h-5 w-5 text-gray-400" />
          <Input
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            placeholder={`Step ${index + 1}`}
            disabled={disabled}
            maxLength={160}
            className="flex-1"
          />
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeItem(index)}
              aria-label="Remove step"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}

      {!disabled && items.length < 30 && (
        <div className="flex items-center gap-2">
          <div className="h-5 w-5" />
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="Add a step..."
            maxLength={160}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={addItem}
            disabled={!newItem.trim()}
            aria-label="Add step"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {items.length >= 30 && (
        <p className="text-sm text-gray-500">Maximum 30 checklist steps reached.</p>
      )}
    </div>
  )
}
