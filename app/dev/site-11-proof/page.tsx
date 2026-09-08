// @no-parity — dev-only SITE-11 preview. Parity contracts bind production routes to their
// section lists; this page is the artifact the separate taste evaluator judges the proof
// block on before the wiring lane places it on /sell and the place templates. It is
// noindex, unlinked, refused in production by middleware, and never a public destination.
/**
 * SITE-11 PREVIEW — the proof block, on live Bend data, with the broker cards
 * that will sit under it on a place page.
 *
 * The point of the page is composition: the evaluator has to see the drawing,
 * the record, the words, and the reach to a named broker as ONE object, in the
 * order a visitor meets them, at 1440 and at 375. Reading the component does
 * not show that and neither does a passing gate (TASTE.md).
 *
 * `AboutFaces` is imported unchanged — it belongs to SITE-M1 and the wiring
 * lane places it. Nothing here is a second copy of it.
 */
import type { Metadata } from 'next'
import { getProofBlock, getBrokers } from '@/lib/data'
import { V3_ROOT_CLASS, V3ProofBlock, proofBlockView, type V3ProofReach } from '@/components/site/v3'
import { AboutFaces } from '@/app/about/_v3/AboutFaces'
import { aboutFaceFromBroker, type AboutFace } from '@/app/about/_v3/about-faces'

export const metadata: Metadata = {
  title: 'SITE-11 proof block preview',
  robots: { index: false, follow: false },
}

export const revalidate = 300

export default async function Site11ProofPreviewPage() {
  const [block, brokers] = await Promise.all([
    getProofBlock({ geoType: 'city', geoSlug: 'bend', geoLabel: 'Bend' }),
    getBrokers().catch(() => []),
  ])

  const faces: AboutFace[] = brokers
    .map((b) => aboutFaceFromBroker(b))
    .filter((face): face is AboutFace => face !== null)

  // The reach strip carries the broker the page would route to. Numbers come
  // from the live roster through the DAL, never a literal (gate G38).
  const lead = faces[0] ?? null
  const reach: V3ProofReach[] = lead
    ? [
        ...(lead.tel
          ? ([
              { key: 'call', kind: 'call', href: `tel:${lead.tel}`, label: `Call ${lead.name}` },
              { key: 'text', kind: 'text', href: `sms:${lead.tel}`, label: `Text ${lead.name}` },
            ] as V3ProofReach[])
          : []),
        ...(lead.bookHref
          ? ([{ key: 'book', kind: 'book', href: lead.bookHref, label: 'Book a call' }] as V3ProofReach[])
          : []),
      ]
    : []

  const view = proofBlockView({
    block,
    id: 'proof',
    headingLevel: 2,
    attribution: { surface: 'place', place: 'bend', source: 'proof_block' },
    reach,
  })

  return (
    <main className={V3_ROOT_CLASS}>
      {view ? <V3ProofBlock {...view} /> : <p>Nothing to prove yet.</p>}
      {faces.length > 0 ? (
        <AboutFaces people={faces} heading="Talk to a broker" headingLevel={2} />
      ) : null}
    </main>
  )
}
