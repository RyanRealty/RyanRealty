/**
 * Every outbound ryan-realty.com link in a CMA letter carries UTM tags, and
 * carries the signed person token when the row has a contact or lead id.
 */

import { CMA_DOC_ORIGIN, CMA_DOC_UTM_MEDIUM, CMA_DOC_UTM_SOURCE } from '@/lib/cma/doc-links'
import { IDENTITY_LINK_PARAM } from '@/lib/identity/link-token'

const SITE_HOST = 'ryan-realty.com'

export type LetterLinkIdentity = {
  personId?: number | null
  leadId?: number | string | null
  clientEmail?: string | null
}

export function letterHasContactIdentity(id: LetterLinkIdentity | null | undefined): boolean {
  if (!id) return false
  if (typeof id.personId === 'number' && Number.isInteger(id.personId) && id.personId > 0) return true
  if (id.leadId != null && String(id.leadId).trim() !== '' && String(id.leadId) !== '0') return true
  return false
}

/** Positive crm_people id when the row already has one. */
export function personIdFromLetterIdentity(id: LetterLinkIdentity | null | undefined): number | null {
  const n = id?.personId
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Attribute-value entity decode. Letter markup writes hrefs through escapeHtml
 * (`&` → `&amp;`), so a raw read turns `utm_medium` / `_pid` into `amp;utm_medium`
 * / `amp;_pid`. This is the only letter-consistency check that parses hrefs.
 */
export function decodeHtmlHref(href: string): string {
  return href
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    // & last: decoding it first would let "&amp;lt;" become "<"
    .replace(/&amp;/gi, '&')
}

function hrefsFromHtml(html: string): string[] {
  const out: string[] = []
  const re = /href\s*=\s*(["'])(.*?)\1/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const href = decodeHtmlHref((m[2] ?? '').trim())
    if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
      out.push(href)
    }
  }
  return out
}

export function isRyanRealtySiteHref(href: string): boolean {
  try {
    const u = new URL(href, CMA_DOC_ORIGIN)
    const host = u.hostname.replace(/^www\./, '')
    return host === SITE_HOST
  } catch {
    return false
  }
}

export type SiteLinkStamp = {
  href: string
  hasUtm: boolean
  hasPid: boolean
}

export function inspectLetterSiteLinks(html: string): SiteLinkStamp[] {
  return hrefsFromHtml(html)
    .filter(isRyanRealtySiteHref)
    .map((href) => {
      try {
        const u = new URL(href, CMA_DOC_ORIGIN)
        const source = (u.searchParams.get('utm_source') ?? '').toLowerCase()
        const medium = (u.searchParams.get('utm_medium') ?? '').toLowerCase()
        const hasUtm =
          source === CMA_DOC_UTM_SOURCE && medium === CMA_DOC_UTM_MEDIUM && Boolean(u.searchParams.get('utm_campaign'))
        const pid = u.searchParams.get(IDENTITY_LINK_PARAM)
        return { href, hasUtm, hasPid: Boolean(pid && pid.trim()) }
      } catch {
        return { href, hasUtm: false, hasPid: false }
      }
    })
}

export type LetterLinkCheck = {
  id: 'letter-links-tracked'
  severity: 'hard'
  pass: boolean
  detail: string
}

/** Hard refuse: a site link is missing UTM, or missing _pid when a contact exists. */
export function letterLinkTrackingCheck(
  html: string,
  identity: LetterLinkIdentity | null | undefined,
): LetterLinkCheck {
  const links = inspectLetterSiteLinks(html)
  if (links.length === 0) {
    return {
      id: 'letter-links-tracked',
      severity: 'hard',
      pass: true,
      detail: 'No outbound ryan-realty.com links to stamp.',
    }
  }
  const needPid = letterHasContactIdentity(identity)
  const missingUtm = links.filter((l) => !l.hasUtm)
  const missingPid = needPid ? links.filter((l) => !l.hasPid) : []
  const pass = missingUtm.length === 0 && missingPid.length === 0
  const bits: string[] = []
  if (missingUtm.length) bits.push(`${missingUtm.length} site link(s) missing utm_source=cma, utm_medium=document, and utm_campaign`)
  if (missingPid.length) bits.push(`${missingPid.length} site link(s) missing _pid though the row has a contact or lead`)
  return {
    id: 'letter-links-tracked',
    severity: 'hard',
    pass,
    detail: pass
      ? needPid
        ? `All ${links.length} outbound site links carry UTM tags and _pid.`
        : `All ${links.length} outbound site links carry UTM tags. No contact id on the row, so _pid is omitted.`
      : bits.join(' '),
  }
}
