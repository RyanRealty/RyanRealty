/**
 * Market-report title month must name the same period as the body figures.
 *
 * Fleet content-blog: "June 2026" in the H1 next to "The May numbers" and
 * May medians is two labels for one report (fleet:300d209840574d3b21bc8a191c775a8b).
 * The July issue does the same with June closings. Publish the data month
 * on the H1 / meta / JSON-LD. Keep the byline as the publish date.
 *
 * Body H2 "The May numbers" stays. That is the source of the data month.
 * Lifestyle posts and reports whose title month already matches are untouched.
 */
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const MONTH_RE = MONTHS.join('|')

export type BlogReportMonth = {
  month: (typeof MONTHS)[number]
  year: string
}

export type PublishedBlogReportPeriod = {
  displayTitle: string
  metaTitle: string
  periodNote: string | null
  rewrote: boolean
  titlePeriod: BlogReportMonth | null
  dataPeriod: BlogReportMonth | null
}

function titleCaseMonth(raw: string): (typeof MONTHS)[number] | null {
  const hit = MONTHS.find((m) => m.toLowerCase() === raw.toLowerCase())
  return hit ?? null
}

export function extractTitlePeriod(title: string): BlogReportMonth | null {
  const match = title.match(new RegExp(`\\b(${MONTH_RE})\\s+(20\\d{2})\\b`, 'i'))
  if (!match) return null
  const month = titleCaseMonth(match[1] ?? '')
  const year = match[2]
  if (!month || !year) return null
  return { month, year }
}

export function extractDataPeriod(html: string, fallbackYear: string | null): BlogReportMonth | null {
  const heading = html.match(new RegExp(`The\\s+(${MONTH_RE})\\s+numbers`, 'i'))
  if (!heading) return null
  const month = titleCaseMonth(heading[1] ?? '')
  if (!month) return null
  const yearMatch = html.match(new RegExp(`\\b${month}\\s+(20\\d{2})\\b`, 'i'))
  const year = yearMatch?.[1] ?? fallbackYear
  if (!year) return null
  return { month, year }
}

function replacePeriod(text: string, from: BlogReportMonth, to: BlogReportMonth): string {
  return text.replace(new RegExp(`\\b${from.month}\\s+${from.year}\\b`, 'gi'), `${to.month} ${to.year}`)
}

export function publishBlogReportPeriod(input: {
  title: string
  html: string
  seoTitle?: string | null
}): PublishedBlogReportPeriod {
  const title = input.title.trim()
  const titlePeriod = extractTitlePeriod(title)
  const dataPeriod = extractDataPeriod(input.html, titlePeriod?.year ?? null)
  const defaultMeta = input.seoTitle?.trim() || (title ? `${title} | Ryan Realty Blog` : 'Ryan Realty Blog')

  if (!titlePeriod || !dataPeriod) {
    return {
      displayTitle: title,
      metaTitle: defaultMeta,
      periodNote: null,
      rewrote: false,
      titlePeriod,
      dataPeriod,
    }
  }

  if (titlePeriod.month === dataPeriod.month && titlePeriod.year === dataPeriod.year) {
    return {
      displayTitle: title,
      metaTitle: defaultMeta,
      periodNote: null,
      rewrote: false,
      titlePeriod,
      dataPeriod,
    }
  }

  const displayTitle = replacePeriod(title, titlePeriod, dataPeriod)
  const metaTitle = replacePeriod(defaultMeta, titlePeriod, dataPeriod)
  return {
    displayTitle,
    metaTitle,
    periodNote: `${dataPeriod.month} ${dataPeriod.year} closings. Published ${titlePeriod.month} ${titlePeriod.year}.`,
    rewrote: displayTitle !== title,
    titlePeriod,
    dataPeriod,
  }
}
