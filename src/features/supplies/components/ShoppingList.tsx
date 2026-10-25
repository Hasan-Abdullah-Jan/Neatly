import { Check, ShoppingCart, MessageSquarePlus } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { EmptyState } from '@components/ui/EmptyState'
import { Input } from '@components/ui/Input'
import { useState } from 'react'
import type { SupplyItem } from '@/types/database'

interface ShoppingListProps {
  items: SupplyItem[]
  canManage: boolean
  onPurchase: (itemId: string, quantity: number) => void
  onRequest: () => void
}

export function ShoppingList({ items, canManage, onPurchase, onRequest }: ShoppingListProps) {
  const [quantities, setQuantities] = useState<Record<string, string>>({})

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-8 w-8" />}
        title="Shopping list is empty"
        description="No items are currently below their minimum threshold"
        action={{
          label: 'Request a supply',
          onClick: onRequest,
          variant: 'outline',
        }}
      />
    )
  }

  const handlePurchase = (item: SupplyItem) => {
    const qty = Number(quantities[item.id] || item.min_quantity - item.quantity)
    if (qty > 0) {
      onPurchase(item.id, qty)
      setQuantities((prev) => ({ ...prev, [item.id]: '' }))
    }
  }

  const suggestedQuantity = (item: SupplyItem) => {
    const min = item.min_quantity
    const current = item.quantity
    return Math.max(min - current, 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {items.length} item{items.length !== 1 ? 's' : ''} need restocking
        </p>
        <Button variant="outline" onClick={onRequest}>
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          Request supply
        </Button>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-medium">{item.name}</h3>
                {item.category && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{item.category}</p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Current: {item.quantity} {item.unit} · Min: {item.min_quantity} {item.unit}
                </p>
                {item.location && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">📍 {item.location}</p>
                )}
              </div>

              {canManage && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    step="0.1"
                    value={quantities[item.id] || suggestedQuantity(item)}
                    onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    className="w-24"
                    placeholder="Qty"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handlePurchase(item)}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Bought
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
