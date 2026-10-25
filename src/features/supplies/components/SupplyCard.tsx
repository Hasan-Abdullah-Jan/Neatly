import { AlertTriangle, Plus, Minus } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { Badge } from '@components/ui/Badge'
import type { SupplyItem } from '@/types/database'

interface SupplyCardProps {
  item: SupplyItem
  onQuantityChange: (id: string, delta: number) => void
  onMarkLow: (id: string) => void
  onEdit: (item: SupplyItem) => void
  canEdit: boolean
}

export function SupplyCard({ item, onQuantityChange, onMarkLow, onEdit, canEdit }: SupplyCardProps) {
  const isLow = item.quantity <= item.min_quantity
  const isOut = item.quantity === 0

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium">{item.name}</h3>
            {isOut && (
              <Badge variant="destructive" size="sm">Out of stock</Badge>
            )}
            {isLow && !isOut && (
              <Badge variant="amber" size="sm">Low stock</Badge>
            )}
          </div>
          {item.category && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{item.category}</p>
          )}
          {item.location && (
            <p className="text-sm text-gray-600 dark:text-gray-400">📍 {item.location}</p>
          )}
        </div>

        <div className="text-right">
          <p className="text-2xl font-bold">
            {item.quantity} <span className="text-sm font-normal text-gray-600 dark:text-gray-400">{item.unit}</span>
          </p>
          {isLow && !isOut && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Min: {item.min_quantity}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        {canEdit && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onQuantityChange(item.id, -1)}
              disabled={item.quantity === 0}
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onQuantityChange(item.id, 1)}
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </Button>
            {!isLow && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onMarkLow(item.id)}
                className="text-amber-600 hover:text-amber-700"
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                Mark low
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEdit(item)}
            >
              Edit
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}
