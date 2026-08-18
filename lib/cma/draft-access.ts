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

/** Admin iframe + Open report. Print HTML is the seller document of record.
 *  Live immersive can drift (production still rendered the marketing pitch
 *  from render_args). `print=1` serves the stored spine. */
export function brokerCmaViewHref(slug: string): string {
  return `/admin/cmas/${slug.trim().toLowerCase()}/view?print=1`
}
