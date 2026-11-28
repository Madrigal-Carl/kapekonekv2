import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as farmerService from '@/services/farmer.service'
import { useAuthStore } from '@/stores/auth.store'
import { dashboardKeys } from './useDashboard'

export const farmerKeys = {
  all: ['farmers'],
  list: (params) => ['farmers', 'list', params],
  detail: (id) => ['farmers', 'detail', id],
  mine: ['farmer-profile'],
}

export const useMyFarmerProfile = () => useQuery({ queryKey: farmerKeys.mine, queryFn: farmerService.getMyFarmerProfile })

/** The farmer's own requests: refresh the profile, the dashboard and the session (farmerStatus). */
function useMyProfileMutation(mutationFn) {
  const queryClient = useQueryClient()
  const reloadSession = useAuthStore((s) => s.load)
  return useMutation({
    mutationFn,
    onSuccess: (profile) => {
      queryClient.setQueryData(farmerKeys.mine, profile)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
      reloadSession()
    },
  })
}
export const useRequestToJoin = () => useMyProfileMutation(farmerService.requestToJoin)
export const useWithdrawRequest = () => useMyProfileMutation(farmerService.withdrawRequest)
export const useReplaceDocuments = () => useMyProfileMutation(farmerService.replaceDocuments)
export const useRequestTransfer = () => useMyProfileMutation(farmerService.requestTransfer)
export const useWithdrawTransfer = () => useMyProfileMutation(farmerService.withdrawTransfer)

export const useFarmers = (params, options = {}) =>
  useQuery({ queryKey: farmerKeys.list(params), queryFn: () => farmerService.listFarmers(params), placeholderData: keepPreviousData, ...options })
export const useFarmer = (id) => useQuery({ queryKey: farmerKeys.detail(id), queryFn: () => farmerService.getFarmer(id), enabled: Boolean(id) })

function useFarmerMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: farmerKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}
export const useCreateFarmer = () => useFarmerMutation(farmerService.createFarmer)
export const useUpdateFarmer = () => useFarmerMutation(farmerService.updateFarmer)
export const useResetFarmerPassword = () => useFarmerMutation(farmerService.resetFarmerPassword)
export const useApproveFarmer = () => useFarmerMutation(farmerService.approveFarmer)
export const useRejectFarmer = () => useFarmerMutation(farmerService.rejectFarmer)
export const useApproveTransfer = () => useFarmerMutation(farmerService.approveTransfer)
export const useRejectTransfer = () => useFarmerMutation(farmerService.rejectTransfer)
export const useRemoveFarmer = () => useFarmerMutation(farmerService.removeFarmer)
