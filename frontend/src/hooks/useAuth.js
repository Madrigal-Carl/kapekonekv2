import { useMutation, useQuery } from '@tanstack/react-query'
import * as authService from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'

export const authKeys = {
  all: ['auth'],
  usernameAvailability: (username) => ['auth', 'username-availability', username],
  usernameSuggestions: (firstName, lastName) => ['auth', 'username-suggestions', firstName, lastName],
}

/** The session plus convenience flags. Only buyers must verify their email. */
export function useAuth() {
  const session = useAuthStore((s) => s.session)
  const status = useAuthStore((s) => s.status)
  const roles = session?.roles ?? []
  const isVerified = Boolean(session?.user.emailVerifiedAt)
  return {
    user: session?.user ?? null,
    roles,
    permissions: session?.permissions ?? [],
    isLoading: status === 'loading',
    isAuthenticated: Boolean(session),
    isVerified,
    mustVerify: roles.includes('buyer') && !isVerified,
  }
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({ mutationFn: authService.login, onSuccess: setSession })
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({ mutationFn: authService.register, onSuccess: setSession })
}

/**
 * Sign out, then load the storefront fresh: no guard can bounce the user to /login,
 * and every cached query of the old account is dropped.
 */
export const useLogout = () =>
  useMutation({ mutationFn: authService.logout, onSettled: () => window.location.replace('/') })

export function useVerifyEmail() {
  const load = useAuthStore((s) => s.load)
  return useMutation({ mutationFn: authService.verifyEmail, onSuccess: load })
}

export const useResendVerification = () => useMutation({ mutationFn: authService.resendVerification })
export const useForgotPassword = () => useMutation({ mutationFn: authService.forgotPassword })

export function useResetPassword() {
  const clear = useAuthStore((s) => s.clear)
  return useMutation({ mutationFn: authService.resetPassword, onSuccess: clear })
}

/** Checks a valid username's availability. */
export const useUsernameAvailability = (username, enabled) =>
  useQuery({
    queryKey: authKeys.usernameAvailability(username),
    queryFn: () => authService.usernameAvailability(username),
    enabled,
    staleTime: 30_000,
  })

export const useUsernameSuggestions = (firstName, lastName) =>
  useQuery({
    queryKey: authKeys.usernameSuggestions(firstName, lastName),
    queryFn: () => authService.usernameSuggestions({ firstName, lastName }),
    enabled: Boolean(firstName || lastName),
    staleTime: 60_000,
  })
