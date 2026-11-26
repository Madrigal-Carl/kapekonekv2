import { io } from 'socket.io-client'
import { refreshOnce } from '@/api/axios'

let current = null

/** Send a client event (`typing`, `conversation:delivered`) on the open socket; a no-op while offline. */
export const emitSocket = (event, payload) => current?.emit(event, payload)

/**
 * Open the socket (server push, plus the two Inbox client events). The handshake uses the
 * accessToken cookie; when the server refuses it (token expired), refresh once and reconnect.
 * @param {Record<string, (payload: any) => void>} handlers event → listener
 * @returns {() => void} disconnect
 */
export function connectSocket(handlers) {
  const socket = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:5000', { withCredentials: true, transports: ['websocket'] })
  let retried = false
  socket.on('connect', () => {
    retried = false
  })
  socket.on('connect_error', () => {
    // A middleware refusal doesn't auto-reconnect (socket.active is false); transport errors do.
    if (socket.active || retried) return
    retried = true
    refreshOnce().then(
      () => socket.connect(),
      () => {},
    )
  })
  for (const [event, listener] of Object.entries(handlers)) socket.on(event, listener)
  current = socket
  return () => {
    if (current === socket) current = null
    socket.disconnect()
  }
}
