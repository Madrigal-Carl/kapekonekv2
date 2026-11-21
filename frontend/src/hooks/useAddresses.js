import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
