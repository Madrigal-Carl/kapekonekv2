import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as inbox from '@/services/inbox.service'
import { dashboardKeys } from './useDashboard'

export const inboxKeys = {
  all: ['inbox'],
  lists: ['inbox', 'list'],
  list: (params) => ['inbox', 'list', params],
  one: (id) => ['inbox', 'one', id],
  allMessages: ['inbox', 'messages'],
  messages: (id) => ['inbox', 'messages', id],
  people: (q) => ['inbox', 'people', q],
}

export const useConversations = (params) =>
  useQuery({ queryKey: inboxKeys.list(params), queryFn: () => inbox.listConversations(params), placeholderData: keepPreviousData })
export const useConversation = (id) => useQuery({ queryKey: inboxKeys.one(id), queryFn: () => inbox.getConversation(id), enabled: Boolean(id), retry: false })
/** Pages of 30, newest first; `fetchNextPage` loads older messages. */
export const useMessages = (id) =>
  useInfiniteQuery({
    queryKey: inboxKeys.messages(id),
    queryFn: ({ pageParam }) => inbox.listMessages(id, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.meta?.hasMore ? last.meta.nextCursor : undefined),
    enabled: Boolean(id),
    retry: false,
  })
export const usePeople = (q, enabled) => useQuery({ queryKey: inboxKeys.people(q), queryFn: () => inbox.listPeople(q), enabled, placeholderData: keepPreviousData })

/** Any message change moves the thread, the chat list (preview, unread) and the receipt. */
function useMessageMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inboxKeys.allMessages })
      queryClient.invalidateQueries({ queryKey: inboxKeys.lists })
      queryClient.invalidateQueries({ queryKey: ['inbox', 'one'] })
    },
  })
}

export const useSendMessage = () => useMessageMutation(inbox.sendMessage)
export const useEditMessage = () => useMessageMutation(inbox.editMessage)
export const useDeleteMessage = () => useMessageMutation(inbox.deleteMessage)

/** Opening a chat: unread goes to 0 in the list and the sidebar badge. */
export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: inbox.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inboxKeys.lists })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.badges })
    },
  })
}

export function useOpenDirect() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: inbox.openDirect, onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxKeys.lists }) })
}
