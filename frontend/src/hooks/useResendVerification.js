import { useEffect, useState } from 'react'
import { useResendVerification } from './useAuth'

const COOLDOWN_SECONDS = 60

/** Resend the verification email, then lock the button for 60 seconds (the API allows one per minute). */
export function useResendWithCooldown() {
  const resend = useResendVerification()
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (secondsLeft <= 0) return undefined
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  const send = () =>
    resend.mutate(undefined, {
      onSuccess: () => setSecondsLeft(COOLDOWN_SECONDS),
      onError: (error) => {
        if (error.response?.status === 429) setSecondsLeft(Number(error.response.headers?.['retry-after']) || COOLDOWN_SECONDS)
      },
    })

  return { send, secondsLeft, isPending: resend.isPending, isSuccess: resend.isSuccess, error: resend.error }
}
