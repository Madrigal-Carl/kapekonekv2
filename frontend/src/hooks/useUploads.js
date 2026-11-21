import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { uploadImage } from '@/services/upload.service'

/** Signed Cloudinary upload with progress (0–100). `mutate({ file })` resolves to `{ url, publicId }`. */
export function useUploadImage(type) {
  const [progress, setProgress] = useState(0)
  const mutation = useMutation({
    mutationFn: ({ file }) => {
      setProgress(0)
      return uploadImage(file, type, setProgress)
    },
  })
  return { ...mutation, progress }
}
