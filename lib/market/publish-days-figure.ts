/**
 * One days figure, one printed string.
 *
 * Pulse medians land on half-days (39.5, 19.5). FAQ interpolates that number.
 * The market card and about-facts used Math.round, so one page printed 40
 * next to FAQ 39.5 (Black Butte Ranch, fleet 5b1120c4e25c70f0b99e75b956370319).
 *
 * Tenths are the published grain. Do not integer-round a public days figure.
 */

export function publishDaysFigure(days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days) || days <= 0) return null
  const tenths = Math.round(days * 10) / 10
  if (!Number.isFinite(tenths) || tenths <= 0) return null
  return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1)
}

export function publishDaysLabel(days: number | null | undefined): string | null {
  const figure = publishDaysFigure(days)
  return figure ? `${figure} days` : null
}
