import { io } from 'socket.io-client'
import { refreshOnce } from '@/api/axios'

/**
 * Open the push-only socket (`notification:new`, `order:updated`). The handshake uses the
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
  return () => socket.disconnect()
}
