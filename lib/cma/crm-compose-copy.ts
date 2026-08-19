/**
 * Compose prefill for a CMA send through the CRM composers.
 * Drafts stay off the public /cma URL (that path 404s until publish).
 */

export function cmaComposeEmailSubject(subjectAddress: string): string {
  const address = subjectAddress.trim()
  return address ? `CMA — ${address}` : 'CMA'
}

export function cmaComposeEmailBody(subjectAddress: string): string {
  const address = subjectAddress.trim()
  return address
    ? `The CMA for ${address} is attached as a PDF.`
    : 'The CMA is attached as a PDF.'
}

export function cmaComposeSmsBody(subjectAddress: string): string {
  const address = subjectAddress.trim()
  return address ? `CMA for ${address} is attached.` : 'CMA PDF is attached.'
}

export function cmaComposePdfFilename(slug: string): string {
  const safe = slug.trim().toLowerCase().replace(/[^\w.\-]/g, '_') || 'cma'
  return `${safe}.pdf`
}
