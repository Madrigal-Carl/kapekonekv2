import { useMutation } from '@tanstack/react-query'
import { saveDownload } from '@/lib/download'

/** Fetch an export (`download(format)` → `{ blob, filename }`) and hand it to the browser as a file. */
export function useExportFile(download) {
  return useMutation({ mutationFn: download, onSuccess: saveDownload })
}
