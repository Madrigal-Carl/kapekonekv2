import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as beans from '@/services/bean.service'
import { dashboardKeys } from './useDashboard'

export const beanKeys = {
  all: ['beans'],
  list: (params) => ['beans', 'list', params],
  one: (id) => ['beans', 'one', id],
  cap: (farmerId) => ['beans', 'cap', farmerId ?? 'me'],
}

export const useBeans = (params) => useQuery({ queryKey: beanKeys.list(params), queryFn: () => beans.listBeans(params), placeholderData: keepPreviousData })
export const useBean = (id) => useQuery({ queryKey: beanKeys.one(id), queryFn: () => beans.getBean(id), enabled: Boolean(id), retry: false })
/** The 5 kg meter: the signed-in farmer's, or (with `farmerId`) a farmer a Group Manager or Kaluppa looks at. */
export const useBeanCap = (farmerId, { enabled = true } = {}) =>
  useQuery({ queryKey: beanKeys.cap(farmerId), queryFn: () => beans.getBeanCap(farmerId ? { farmerId } : {}), enabled })

/** Any listing change moves the lists, the meter, the sidebar badge and the overview counts. */
function useBeanMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: beanKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export const useCreateBean = () => useBeanMutation(beans.createBean)
export const useUpdateBean = () => useBeanMutation(beans.updateBean)
export const useApproveBean = () => useBeanMutation(beans.approveBean)
export const useRejectBean = () => useBeanMutation(beans.rejectBean)
export const useCompleteBean = () => useBeanMutation(beans.completeBean)
export const useCancelBean = () => useBeanMutation(beans.cancelBean)
