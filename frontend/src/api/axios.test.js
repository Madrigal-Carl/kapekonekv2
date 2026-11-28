import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, setAuthHandlers } from './axios.js'

const reply = (config, status, data = {}) => {
  if (status < 400) return Promise.resolve({ data, status, statusText: 'OK', headers: {}, config })
  const error = new Error(`HTTP ${status}`)
  error.config = config
  error.response = { status, data, headers: {}, config }
  return Promise.reject(error)
}

afterEach(() => setAuthHandlers({ onSessionExpired: () => {}, onEmailNotVerified: () => {}, onTermsRequired: () => {} }))

describe('api interceptor', () => {
  it('refreshes once for parallel 401s and retries every request', async () => {
    const calls = []
    let fresh = false
    api.defaults.adapter = (config) => {
      calls.push(config.url)
      if (config.url === '/auth/refresh') {
        fresh = true
        return new Promise((resolve) => setTimeout(() => resolve(reply(config, 200)), 10))
      }
      return fresh ? reply(config, 200, { url: config.url }) : reply(config, 401)
    }
    const results = await Promise.all(['/a', '/b', '/c'].map((url) => api.get(url)))
    expect(results.map((r) => r.data.url)).toEqual(['/a', '/b', '/c'])
    expect(calls.filter((url) => url === '/auth/refresh')).toHaveLength(1)
  })

  it('reports an expired session once when the refresh fails', async () => {
    const onSessionExpired = vi.fn()
    setAuthHandlers({ onSessionExpired })
    api.defaults.adapter = (config) => (config.url === '/auth/refresh' ? reply(config, 401) : reply(config, 401))
    const results = await Promise.allSettled(['/a', '/b', '/c'].map((url) => api.get(url)))
    expect(results.every((r) => r.status === 'rejected' && r.reason.response.status === 401)).toBe(true)
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('sends unverified buyers to verify their email', async () => {
    const onEmailNotVerified = vi.fn()
    setAuthHandlers({ onEmailNotVerified })
    api.defaults.adapter = (config) => reply(config, 403, { code: 'EMAIL_NOT_VERIFIED' })
    await expect(api.get('/cart')).rejects.toThrow()
    expect(onEmailNotVerified).toHaveBeenCalledTimes(1)
  })

  it('tells the app when the terms must be agreed to (Change 09)', async () => {
    const onTermsRequired = vi.fn()
    setAuthHandlers({ onTermsRequired })
    api.defaults.adapter = (config) => reply(config, 403, { code: 'TERMS_REQUIRED' })
    await expect(api.get('/cart')).rejects.toThrow()
    expect(onTermsRequired).toHaveBeenCalledTimes(1)
  })

  it('does not try to refresh a failed login', async () => {
    const calls = []
    api.defaults.adapter = (config) => {
      calls.push(config.url)
      return reply(config, 401)
    }
    await expect(api.post('/auth/login')).rejects.toThrow()
    expect(calls).toEqual(['/auth/login'])
  })
})
