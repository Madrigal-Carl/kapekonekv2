import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as records from '@/services/record.service'
import { dashboardKeys } from './useDashboard'
import { farmerKeys } from './useFarmers'

export const recordKeys = {
  all: ['records'],
  farms: (params) => ['records', 'farms', params],
  farm: (id) => ['records', 'farm', id],
  treeGroups: (params) => ['records', 'tree-groups', params],
  harvests: (params) => ['records', 'harvests', params],
}

export const useFarms = (params, options = {}) =>
  useQuery({ queryKey: recordKeys.farms(params), queryFn: () => records.listFarms(params), placeholderData: keepPreviousData, ...options })
export const useFarm = (id) => useQuery({ queryKey: recordKeys.farm(id), queryFn: () => records.getFarm(id), enabled: Boolean(id), retry: false })
export const useTreeGroups = (params, options = {}) =>
  useQuery({ queryKey: recordKeys.treeGroups(params), queryFn: () => records.listTreeGroups(params), placeholderData: keepPreviousData, ...options })
export const useHarvests = (params, options = {}) =>
  useQuery({ queryKey: recordKeys.harvests(params), queryFn: () => records.listHarvests(params), placeholderData: keepPreviousData, ...options })

// shortcut: the farm pickers list the first 50 active farms in scope; add server search when someone outgrows that.
const FARM_OPTION_LIMIT = 50
/** Active farms the user may add trees and harvests to (`canManageRecords`). */
export function useRecordFarms(enabled = true) {
  const farms = useFarms({ status: 'active', limit: FARM_OPTION_LIMIT }, { enabled })
  return { ...farms, data: farms.data?.items.filter((f) => f.canManageRecords) }
}

/** Farms, trees and harvests feed each other's counts (and the overviews), so any change refreshes all of them. */
function useRecordMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recordKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
      queryClient.invalidateQueries({ queryKey: farmerKeys.all })
    },
  })
}
export const useCreateFarm = () => useRecordMutation(records.createFarm)
export const useUpdateFarm = () => useRecordMutation(records.updateFarm)
export const useArchiveFarm = () => useRecordMutation(records.archiveFarm)
export const useRestoreFarm = () => useRecordMutation(records.restoreFarm)
export const useSetAssignedFarmers = () => useRecordMutation(records.setAssignedFarmers)
export const useCreateTreeGroup = () => useRecordMutation(records.createTreeGroup)
export const useUpdateTreeGroup = () => useRecordMutation(records.updateTreeGroup)
export const useArchiveTreeGroup = () => useRecordMutation(records.archiveTreeGroup)
export const useRestoreTreeGroup = () => useRecordMutation(records.restoreTreeGroup)
export const useCreateHarvest = () => useRecordMutation(records.createHarvest)
export const useUpdateHarvest = () => useRecordMutation(records.updateHarvest)
export const useArchiveHarvest = () => useRecordMutation(records.archiveHarvest)
export const useRestoreHarvest = () => useRecordMutation(records.restoreHarvest)
