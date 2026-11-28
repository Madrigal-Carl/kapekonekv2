import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import * as contactService from '@/services/contact.service'

export const contactKeys = {
  all: ['contact-messages'],
  list: (params) => ['contact-messages', 'list', params],
  detail: (id) => ['contact-messages', 'detail', id],
}

export const useSendContactMessage = () => useMutation({ mutationFn: contactService.sendContactMessage })
export const useContactMessages = (params) =>
  useQuery({ queryKey: contactKeys.list(params), queryFn: () => contactService.listContactMessages(params), placeholderData: keepPreviousData })
export const useContactMessage = (id, initial) =>
  useQuery({ queryKey: contactKeys.detail(id), queryFn: () => contactService.getContactMessage(id), enabled: Boolean(id), initialData: initial })
