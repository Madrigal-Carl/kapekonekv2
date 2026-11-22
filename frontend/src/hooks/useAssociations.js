import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as associationService from '@/services/association.service'
import { dashboardKeys } from './useDashboard'

export const associationKeys = {
  all: ['associations'],
  options: ['associations', 'options'],
  list: (params) => ['associations', 'list', params],
  detail: (id) => ['associations', 'detail', id],
}
export const groupManagerKeys = {
  all: ['group-managers'],
  list: (params) => ['group-managers', 'list', params],
  detail: (id) => ['group-managers', 'detail', id],
}

export const useAssociationOptions = () => useQuery({ queryKey: associationKeys.options, queryFn: associationService.listAssociationOptions, staleTime: 60_000 })
export const useAssociations = (params) =>
  useQuery({ queryKey: associationKeys.list(params), queryFn: () => associationService.listAssociations(params), placeholderData: keepPreviousData })
export const useAssociation = (id) => useQuery({ queryKey: associationKeys.detail(id), queryFn: () => associationService.getAssociation(id), enabled: Boolean(id) })

export const useGroupManagers = (params, options = {}) =>
  useQuery({ queryKey: groupManagerKeys.list(params), queryFn: () => associationService.listGroupManagers(params), placeholderData: keepPreviousData, ...options })
export const useGroupManager = (id) => useQuery({ queryKey: groupManagerKeys.detail(id), queryFn: () => associationService.getGroupManager(id), enabled: Boolean(id) })

/** Associations and Group Managers point at each other, so every change refreshes both lists. */
function useRecordsMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      for (const queryKey of [associationKeys.all, groupManagerKeys.all, dashboardKeys.all]) queryClient.invalidateQueries({ queryKey })
    },
  })
}
export const useCreateAssociation = () => useRecordsMutation(associationService.createAssociation)
export const useUpdateAssociation = () => useRecordsMutation(associationService.updateAssociation)
export const useArchiveAssociation = () => useRecordsMutation(associationService.archiveAssociation)
export const useRestoreAssociation = () => useRecordsMutation(associationService.restoreAssociation)
export const useCreateGroupManager = () => useRecordsMutation(associationService.createGroupManager)
export const useUpdateGroupManager = () => useRecordsMutation(associationService.updateGroupManager)
export const useArchiveGroupManager = () => useRecordsMutation(associationService.archiveGroupManager)
export const useRestoreGroupManager = () => useRecordsMutation(associationService.restoreGroupManager)
