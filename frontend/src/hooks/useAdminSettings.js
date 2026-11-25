import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as adminSettings from '@/services/adminSetting.service'
import { settingKeys } from './useSettings'

export const adminSettingKeys = { one: (section) => ['admin-settings', section] }

/** @param {'branch'|'delivery'|'ewallet'} section */
export const useAdminSetting = (section) => useQuery({ queryKey: adminSettingKeys.one(section), queryFn: () => adminSettings.getAdminSetting(section) })

/** Saving refreshes the section and the public delivery and payment info checkout reads. */
export function useSaveAdminSetting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminSettings.saveAdminSetting,
    onSuccess: (saved, { section }) => {
      queryClient.setQueryData(adminSettingKeys.one(section), (old) => ({ ...old, ...saved }))
      queryClient.invalidateQueries({ queryKey: settingKeys.all })
    },
  })
}
