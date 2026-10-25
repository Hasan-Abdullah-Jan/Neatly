import { useState, useEffect, useCallback } from 'react'
import { Plus, Package } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/Tabs'
import { EmptyState } from '@components/ui/EmptyState'
import { ErrorState } from '@components/ui/ErrorState'
import { Skeleton } from '@components/ui/Skeleton'
import { SupplyCard } from '../components/SupplyCard'
import { SupplyFormModal } from '../components/SupplyFormModal'
import { ShoppingList } from '../components/ShoppingList'
import { RequestList } from '../components/RequestList'
import { RequestModal } from '../components/RequestModal'
import {
  getSupplyItems,
  getShoppingList,
  getSupplyRequests,
  updateQuantity,
  markLowStock,
  createSupplyRequest,
  recordPurchase,
} from '../api/supplies'
import type { MembershipRole, SupplyItem, SupplyRequest, SupplyRequestInsert } from '@/types/database'
import { useAuth } from '@contexts/AuthContext'
import { fetchMembershipRole } from '@features/tasks/api/tasks'

export function SuppliesPage() {
  const { currentSpace, user } = useAuth()
  const [membership, setMembership] = useState<{
    spaceId: string
    userId: string
    role: MembershipRole | null
  } | null>(null)
  const canManageSpace = membership !== null
    && membership.spaceId === currentSpace?.id
    && membership.userId === user?.id
    && ['owner', 'admin', 'supervisor'].includes(membership.role ?? '')
  const [activeTab, setActiveTab] = useState('catalog')
  const [items, setItems] = useState<SupplyItem[]>([])
  const [shoppingList, setShoppingList] = useState<SupplyItem[]>([])
  const [requests, setRequests] = useState<SupplyRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadedSpaceId, setLoadedSpaceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showRequest, setShowRequest] = useState(false)
  const [editingItem, setEditingItem] = useState<SupplyItem | null>(null)

  const loadData = useCallback(async () => {
    const spaceId = currentSpace?.id
    if (!spaceId) return

    try {
      const [itemsData, shoppingData, requestsData] = await Promise.all([
        getSupplyItems(spaceId),
        getShoppingList(spaceId),
        getSupplyRequests(spaceId),
      ])
      setItems(itemsData)
      setShoppingList(shoppingData)
      setRequests(requestsData)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load supplies')
    } finally {
      setLoadedSpaceId(spaceId)
      setLoading(false)
    }
  }, [currentSpace?.id])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    let active = true
    const spaceId = currentSpace?.id
    const userId = user?.id
    if (!spaceId || !userId) return

    fetchMembershipRole(spaceId, userId)
      .then((role) => {
        if (active) setMembership({ spaceId, userId, role })
      })
      .catch((roleError) => {
        if (active) {
          setError(roleError instanceof Error ? roleError.message : 'Your space permissions could not be loaded.')
        }
      })

    return () => {
      active = false
    }
  }, [currentSpace?.id, user?.id])

  const handleQuantityChange = async (id: string, delta: number) => {
    try {
      await updateQuantity(id, delta)
      await loadData()
    } catch (err: any) {
      console.error('Failed to update quantity:', err)
      alert(err.message || 'Failed to update quantity')
    }
  }

  const handleMarkLow = async (id: string) => {
    try {
      await markLowStock(id)
      await loadData()
    } catch (err: any) {
      console.error('Failed to mark low:', err)
      alert(err.message || 'Failed to mark as low stock')
    }
  }

  const handleEdit = (item: SupplyItem) => {
    setEditingItem(item)
    setShowForm(true)
  }

  const handleCreate = () => {
    setEditingItem(null)
    setShowForm(true)
  }

  const handleFormClose = async () => {
    setShowForm(false)
    setEditingItem(null)
    await loadData()
  }

  const handleRequestSubmit = async (request: Omit<SupplyRequestInsert, 'space_id' | 'requested_by' | 'status'>) => {
    try {
      await createSupplyRequest(request)
      setShowRequest(false)
      await loadData()
    } catch (err: any) {
      console.error('Failed to create request:', err)
      alert(err.message || 'Failed to create request')
    }
  }

  const handlePurchase = async (itemId: string, quantity: number) => {
    try {
      await recordPurchase(itemId, quantity)
      await loadData()
    } catch (err: any) {
      console.error('Failed to record purchase:', err)
      alert(err.message || 'Failed to record purchase')
    }
  }

  if (loading || loadedSpaceId !== currentSpace?.id) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Supplies</h1>
          <p className="text-gray-600 dark:text-gray-400">Track inventory and manage restocking</p>
        </div>
        {canManageSpace && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add item
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="gap-2">
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="shopping">
            Shopping List ({shoppingList.length})
          </TabsTrigger>
          <TabsTrigger value="requests">
            Requests ({requests.filter((r) => r.status === 'pending').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="pt-4">
          <div className="space-y-4">
            {items.length === 0 ? (
              <EmptyState
                icon={<Package className="h-8 w-8" />}
                title="No supplies yet"
                description={canManageSpace ? 'Add your first supply item to start tracking inventory' : 'Ask a space manager to add supply items to this catalog.'}
                action={{
                  label: canManageSpace ? 'Add item' : 'Request a supply',
                  onClick: canManageSpace ? handleCreate : () => setShowRequest(true),
                }}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <SupplyCard
                    key={item.id}
                    item={item}
                    onQuantityChange={handleQuantityChange}
                    onMarkLow={handleMarkLow}
                    onEdit={handleEdit}
                    canEdit={canManageSpace}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="shopping" className="pt-4">
          <ShoppingList
            items={shoppingList}
            canManage={canManageSpace}
            onPurchase={handlePurchase}
            onRequest={() => setShowRequest(true)}
          />
        </TabsContent>

        <TabsContent value="requests" className="pt-4">
          <RequestList
            requests={requests}
            canManage={canManageSpace}
            onRefresh={loadData}
          />
        </TabsContent>
      </Tabs>

      {showForm && (
        <SupplyFormModal
          isOpen={showForm}
          item={editingItem}
          onClose={handleFormClose}
        />
      )}

      {showRequest && (
        <RequestModal
          isOpen={showRequest}
          items={items}
          onClose={() => setShowRequest(false)}
          onSubmit={handleRequestSubmit}
        />
      )}
    </div>
  )
}
