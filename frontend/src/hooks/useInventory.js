import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as inventory from '@/services/inventory.service'
import { dashboardKeys } from './useDashboard'
import { productKeys } from './useProducts'

export const inventoryKeys = {
  all: ['inventory'],
  list: (params) => ['inventory', 'list', params],
  one: (id) => ['inventory', 'one', id],
}

export const useInventory = (params) => useQuery({ queryKey: inventoryKeys.list(params), queryFn: () => inventory.listInventory(params), placeholderData: keepPreviousData })
export const useInventoryProduct = (id) => useQuery({ queryKey: inventoryKeys.one(id), queryFn: () => inventory.getInventoryProduct(id), enabled: Boolean(id), retry: false })

/** A product change moves the table, the store pages and the overview's low-stock list. */
function useInventoryMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export const useCreateProduct = () => useInventoryMutation(inventory.createProduct)
export const useUpdateProduct = () => useInventoryMutation(inventory.updateProduct)
export const useArchiveProduct = () => useInventoryMutation(inventory.archiveProduct)
export const useRestoreProduct = () => useInventoryMutation(inventory.restoreProduct)
