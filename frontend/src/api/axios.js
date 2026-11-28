import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api',
  withCredentials: true,
})

/** Set once by the app: what to do when the session can't be refreshed, a buyer must verify, or the terms must be agreed to. */
const handlers = { onSessionExpired: () => {}, onEmailNotVerified: () => {}, onTermsRequired: () => {} }
export const setAuthHandlers = (next) => Object.assign(handlers, next)

const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']
let refreshing = null

/** One refresh for every request that hit 401 at the same time (also used when the socket handshake is refused). */
export function refreshOnce() {
  refreshing ??= api
    .post('/auth/refresh', null, { _skipRefresh: true })
    .catch((error) => {
      handlers.onSessionExpired()
      throw error
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

api.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error
  if (response?.data?.code === 'EMAIL_NOT_VERIFIED') handlers.onEmailNotVerified()
  if (response?.data?.code === 'TERMS_REQUIRED') handlers.onTermsRequired()

  const canRefresh =
    response?.status === 401 && config && !config._retried && !config._skipRefresh && !NO_REFRESH.includes(config.url)
  if (!canRefresh) throw error

  await refreshOnce().catch(() => {
    throw error
  })
  return api({ ...config, _retried: true })
})
