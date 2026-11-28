import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/applyServerErrors'
import * as addressService from '@/services/address.service'

export const addressKeys = { all: ['addresses'] }

export const useAddresses = () => useQuery({ queryKey: addressKeys.all, queryFn: addressService.listAddresses })

function useAddressMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: addressKeys.all }) })
}

export const useCreateAddress = () => useAddressMutation(addressService.createAddress)
export const useUpdateAddress = () => useAddressMutation(addressService.updateAddress)
export const useDeleteAddress = () => useAddressMutation(addressService.deleteAddress)
export const useSetDefaultAddress = () => useAddressMutation(addressService.setDefaultAddress)

/** Toast for a failed address change; "changed in another tab" (409 ADDRESSES_CHANGED) gets a Refresh button. */
export function useAddressErrorToast() {
  const queryClient = useQueryClient()
  return (error) =>
    error?.response?.data?.code === 'ADDRESSES_CHANGED'
      ? toast.error(errorMessage(error), { action: { label: 'Refresh', onClick: () => queryClient.invalidateQueries({ queryKey: addressKeys.all }) } })
      : toast.error(errorMessage(error))
}
