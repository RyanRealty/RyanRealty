/**
 * Broker review of a CMA draft is not a public send.
 * Finalized / delivered stay the only public statuses.
 */

export function isCmaClientReady(status: string | null | undefined): boolean {
  return status === 'finalized' || status === 'delivered'
}

/** Admin (not report_viewer) may open a draft. The public still gets a 404. */
export function canBrokerReviewCma(opts: {
  isAdmin: boolean
  status: string | null | undefined
}): boolean {
  if (opts.isAdmin) return true
  return isCmaClientReady(opts.status)
}

/** Admin iframe + Open report. Does not depend on the public /cma gate. */
export function brokerCmaViewHref(slug: string): string {
  return `/admin/cmas/${slug.trim().toLowerCase()}/view`
}

/** True when html_content lives in the row (builder stamp) without reading the blob. */
export function cmaHasStoredHtml(htmlPath: unknown): boolean {
  return String(htmlPath ?? '').startsWith('db:cmas.html_content:')
}

/** Stored HTML, render_args (draft rebuild), or a legacy public file. */
export function canOpenCmaDocument(row: {
  html_content?: unknown
  html_path?: unknown
  render_args?: unknown
  built_at?: unknown
}): boolean {
  if (row.html_content) return true
  if (cmaHasStoredHtml(row.html_path)) return true
  if (row.render_args && typeof row.render_args === 'object') return true
  if (row.built_at) return true
  return String(row.html_path ?? '').startsWith('public/cmas/')
}

export type AdminCmaEntityAction = {
  id: 'review-cma' | 'open-pdf'
  label: string
  href: string
  primary: boolean
}

/** Entity-page actions in visual order. Review CMA is first when a document exists. */
export function adminCmaEntityActions(opts: {
  slug: string
  canOpenDocument: boolean
  hasPdf: boolean
}): AdminCmaEntityAction[] {
  const slug = opts.slug.trim().toLowerCase()
  const actions: AdminCmaEntityAction[] = []
  if (opts.canOpenDocument) {
    actions.push({
      id: 'review-cma',
      label: 'Review CMA',
      href: brokerCmaViewHref(slug),
      primary: true,
    })
  }
  if (opts.hasPdf) {
    actions.push({
      id: 'open-pdf',
      label: 'Open PDF',
      href: `/api/cma/${slug}/pdf`,
      primary: false,
    })
  }
  return actions
}
