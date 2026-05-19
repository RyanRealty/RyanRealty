/**
 * Types for the buyers-guide subsystem.
 *
 * Source spec: marketing_brain_skills/producers/buyers-guide/SKILL.md
 *
 * The buyer's guide is a per-community PDF that backs the "Soft start"
 * card on every community/subdivision/city LP. The canonical web version
 * lives at /lp/<community>/buyers-guide/; the PDF is generated via
 * Puppeteer from that same page (with `?print=true`) and delivered via
 * Resend when a visitor submits the request form.
 */

/**
 * Inbound payload for /api/buyers-guide/request — the form on the LP.
 */
export interface BuyersGuideRequestPayload {
  /** Subscriber email (required). */
  email: string
  /** Optional first name. Drives the personalized greeting in the cover note. */
  name?: string
  /** Community slug (must match a row in resort-communities or
   *  a `data/resort-community-<slug>.json` file). */
  community_slug: string
  /** LP identifier, e.g. 'lp-tetherow-v1'. Used in FUB lead tagging. */
  source_lp: string
  /** Marketing consent (required true). */
  consent_marketing: boolean
  /** Optional UTM payload captured from LP query string. */
  utm?: {
    source?: string
    medium?: string
    campaign?: string
    term?: string
    content?: string
  }
}

/**
 * Manifest entry for a generated guide PDF. Stored alongside the file at
 * `public/guides/<community>/manifest.json` so the request handler can
 * report freshness without re-running Puppeteer.
 */
export interface BuyersGuideManifest {
  /** Community slug ('tetherow', 'pronghorn', etc.). */
  slug: string
  /** Display name ('Tetherow', 'Pronghorn / Juniper Preserve'). */
  name: string
  /** Path to the generated PDF, relative to public/ (e.g. 'guides/tetherow/tetherow-buyers-guide.pdf'). */
  pdfPath: string
  /** ISO timestamp of last successful generation. */
  generatedAt: string
  /** File size in bytes at generation time. */
  sizeBytes: number
  /** Page count reported by the renderer. */
  pages: number
  /** Methodology version of the underlying market data. */
  methodologyVersion?: string
}
