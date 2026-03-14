/** Period slug for sales reports (URL and lookup). */
export const SALES_PERIODS = ['this-week', 'last-week', 'last-month', 'last-year'] as const
export type SalesPeriodSlug = (typeof SALES_PERIODS)[number]

/** Date range for a sales report period (UTC). */
export function getDateRangeForPeriod(period: SalesPeriodSlug): { start: Date; end: Date } {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))

  switch (period) {
    case 'this-week': {
      const day = now.getUTCDay()
      const sunday = new Date(startOfToday)
      sunday.setUTCDate(now.getUTCDate() - day)
      return { start: sunday, end: today }
    }
    case 'last-week': {
      const day = now.getUTCDay()
      const lastSunday = new Date(startOfToday)
      lastSunday.setUTCDate(now.getUTCDate() - day - 7)
      const lastSaturday = new Date(lastSunday)
      lastSaturday.setUTCDate(lastSunday.getUTCDate() + 6)
      lastSaturday.setUTCHours(23, 59, 59, 999)
      return { start: lastSunday, end: lastSaturday }
    }
    case 'last-month': {
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0))
      const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999))
      return { start: first, end: last }
    }
    case 'last-year': {
      const y = now.getUTCFullYear() - 1
      const first = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0))
      const last = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999))
      return { start: first, end: last }
    }
    default:
      return { start: startOfToday, end: today }
  }
}

export function getPeriodLabel(period: SalesPeriodSlug): string {
  switch (period) {
    case 'this-week':
      return "This Week's Sales"
    case 'last-week':
      return "Last Week's Sales"
    case 'last-month':
      return "Last Month's Sales"
    case 'last-year':
      return "Last Year's Sales"
    default:
      return 'Sales'
  }
}
