/**
 * Render an edition payload to PDF bytes. Goes through htmlToPdfBuffer, so the
 * page contract's fit check (before print) and byte-level safety check (after)
 * both run on every edition: a document whose content reaches a margin throws
 * here and never publishes.
 */
import { BRAND, CONTACT } from '@/lib/brand/contact'
import { htmlToPdfBuffer } from '@/lib/pdf/html-to-pdf'
import { monthLabel } from '../format'
import type { EditionPayload } from '../types'
import { loadReportAssets } from './assets'
import { renderEditionHtml } from './document'

export async function renderEditionHtmlDocument(payload: EditionPayload): Promise<string> {
  const assets = await loadReportAssets()
  return renderEditionHtml(payload, assets)
}

/** The running header and footer every edition carries. */
export function editionMarks(payload: EditionPayload) {
  return {
    headerLeft: `${BRAND.name} · Central Oregon Market Report`,
    headerRight: monthLabel(payload.editionMonth),
    footerLeft: `${BRAND.domain} · ${CONTACT.phoneDirect}`,
  }
}

/** Render to PDF. Pass `html` when the caller already built it (to keep a copy for review). */
export async function renderEditionPdf(
  payload: EditionPayload,
  html?: string,
): Promise<{ pdf: Buffer; html: string }> {
  const doc = html ?? (await renderEditionHtmlDocument(payload))
  const pdf = await htmlToPdfBuffer(doc, {
    label: `market report ${payload.editionMonth}`,
    marks: editionMarks(payload),
  })
  return { pdf, html: doc }
}
