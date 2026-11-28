import { create } from 'zustand'

const timers = new Map()

/**
 * Inbox client state: the chat on screen (`openId`) and who is typing where (socket `typing` events).
 * `typing[conversationId][userId] = name`; each entry removes itself after the server's `expiresInMs`.
 */
export const useTypingStore = create((set, get) => ({
  openId: null,
  setOpen: (openId) => set({ openId }),
  typing: {},
  setTyping: ({ conversationId, user, expiresInMs = 5000 }) => {
    const key = `${conversationId}:${user.id}`
    clearTimeout(timers.get(key))
    timers.set(key, setTimeout(() => get().stopTyping(conversationId, user.id), expiresInMs))
    set((s) => ({ typing: { ...s.typing, [conversationId]: { ...s.typing[conversationId], [user.id]: user.name } } }))
  },
  stopTyping: (conversationId, userId) =>
    set((s) => ({ typing: { ...s.typing, [conversationId]: Object.fromEntries(Object.entries(s.typing[conversationId] ?? {}).filter(([id]) => id !== userId)) } })),
}))
