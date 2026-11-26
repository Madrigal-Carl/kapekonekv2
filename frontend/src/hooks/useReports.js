import { keepPreviousData, useQuery } from '@tanstack/react-query'
import * as reports from '@/services/report.service'

export const reportKeys = {
  all: ['reports'],
  section: (section, params) => ['reports', section, params],
}

/** @param {'summary'|'harvest'|'beans'|'sales'|'trees'|'breakdown'} section @param {{ period: string, association?: string }} params */
export const useReport = (section, params, { enabled = true } = {}) =>
  useQuery({ queryKey: reportKeys.section(section, params), queryFn: () => reports.getReport(section, params), placeholderData: keepPreviousData, enabled })
