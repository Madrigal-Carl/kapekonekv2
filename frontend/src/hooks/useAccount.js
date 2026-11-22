import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as accountService from '@/services/account.service'
import { uploadImage } from '@/services/upload.service'
import { useAuthStore } from '@/stores/auth.store'

export const accountKeys = { profile: ['account', 'profile'] }

/** The signed-in user's profile; starts from the session and refreshes on mount (checkout may have saved a phone). */
export function useProfile() {
  const sessionUser = useAuthStore((s) => s.session?.user)
  return useQuery({ queryKey: accountKeys.profile, queryFn: accountService.getProfile, initialData: sessionUser, staleTime: 0 })
}

/** Mutations that return the updated user: keep the profile query and the navbar (session) in step. */
function useUserMutation(mutationFn) {
  const queryClient = useQueryClient()
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation({
    mutationFn,
    onSuccess: (user) => {
      queryClient.setQueryData(accountKeys.profile, user)
      setUser(user)
    },
  })
}

export const useUpdateProfile = () => useUserMutation(accountService.updateProfile)
export const useRemoveAvatar = () => useUserMutation(accountService.removeAvatar)

/** Upload the photo to Cloudinary (signed), then save it as the avatar. `progress` is 0–100. */
export const useChangeAvatar = () =>
  useUserMutation(async ({ file, onProgress }) => accountService.setAvatar(await uploadImage(file, 'avatar', onProgress)))

/** Both return a fresh session: after an email change it's unverified, so the guards send a buyer to /verify-email. */
function useSessionMutation(mutationFn) {
  const queryClient = useQueryClient()
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({
    mutationFn,
    onSuccess: (session) => {
      queryClient.setQueryData(accountKeys.profile, session.user)
      setSession(session)
    },
  })
}

export const useChangeEmail = () => useSessionMutation(accountService.changeEmail)
export const useChangePassword = () => useSessionMutation(accountService.changePassword)
