/**
 * POST /api/cma/email-link — the CMA door's "Email me the link" (Matt 2026-10-07).
 *
 * Form fields: slug, email. When the email is one we already hold for this
 * document, the report's private link goes to it from the broker's mailbox
 * (lib/cma/email-link.ts). The answer page is the same either way, and the
 * send runs after the response, so neither the words nor the timing tell a
 * stranger which address owns a home.
 *
 * What may send (the locked CMA rules, CLAUDE.md §9):
 *  - DELIVERED documents only. A finalized report the broker has not sent yet
 *    reaches the owner through review and the send window, never this form.
 *  - The live listed-again screen first (rule 6): active, pending, sold since,
 *    or an MLS that cannot be read means no email.
 *  - The broker's own mailbox, resolved from the broker row. No row, no send:
 *    a guessed mailbox would put one broker's name on another's report.
 *  - The governed chokepoint: hard-stop and suppression still refuse.
 *  - One link email per address per home per window, however often the form
 *    is sent. Same-origin form posts only, plus the per-IP auth limiter.
 */
import { NextResponse, after } from 'next/server'
import { getCmaAccessIdentity, getCmaServeHead } from '@/lib/data'
import { CMA_DOC_HEADERS, cmaDoorBroker, cmaHasEmailOnFile } from '@/lib/cma/serve-document'
import { renderEmailLinkSentShell } from '@/lib/cma/register-gate'
import {
  cmaLinkIdempotencyKey,
  composeCmaLinkEmail,
  isKnownCmaEmail,
  normalizeLinkEmail,
} from '@/lib/cma/email-link'
import { cmaSendBrokerSlug } from '@/lib/cma/first-contact-for-send'
import { screenAddressForSolicitation } from '@/lib/cma/solicit-screen'
import { sendGovernedEmail } from '@/lib/comms/sendGovernedEmail'
import { checkRateLimit } from '@/lib/rate-limit'

export const revalidate = 0

const SLUG_RE = /^[a-z0-9-]{3,80}$/

/**
 * A cross-site form cannot make us email an owner. Browsers send Origin on
 * every form POST; a post without one (or with a Referer from elsewhere) is
 * not our page.
 */
function isSameOrigin(request: Request): boolean {
  const ours = new URL(request.url).host
  const from = request.headers.get('origin') ?? request.headers.get('referer')
  if (!from) return false
  try {
    return new URL(from).host === ours
  } catch {
    return false
  }
}

function page(html: string, status = 200): NextResponse {
  return new NextResponse(html, { status, headers: CMA_DOC_HEADERS })
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await request.formData()
  const slug = String(form.get('slug') ?? '').trim().toLowerCase()
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })

  const head = await getCmaServeHead(slug)
  if (!head || head.status !== 'delivered') {
    return NextResponse.json({ error: 'CMA not found' }, { status: 404 })
  }

  const [identity, door] = await Promise.all([getCmaAccessIdentity(slug), cmaDoorBroker(head.broker_slug)])
  const address = identity?.subjectAddress ?? null

  const rl = await checkRateLimit(request, 'auth')
  if (rl.limited) return page(renderEmailLinkSentShell({ slug, address, broker: door.broker, limited: true }), 429)

  const email = normalizeLinkEmail(form.get('email'))
  const personId = identity?.personId ?? null
  if (email && personId && identity && cmaHasEmailOnFile(identity) && isKnownCmaEmail(email, identity)) {
    const requestedAt = Date.now()
    after(async () => {
      try {
        const brokerRow = door.row
        if (!brokerRow?.email) {
          console.warn('[cma/email-link] not sent: broker row unavailable', slug)
          return
        }
        const screen = await screenAddressForSolicitation({
          address,
          city: identity.subjectCity,
          sinceIso: null,
          subjectListingKey: identity.subjectListingKey,
        })
        if (!screen.ok) {
          console.warn('[cma/email-link] not sent: listed-again screen', slug, screen.reason)
          return
        }
        const brokerSlug = cmaSendBrokerSlug(brokerRow.email as string)
        const { subject, html } = composeCmaLinkEmail({ slug, address })
        const res = await sendGovernedEmail({
          personId,
          purpose: 'cma:private-link',
          idempotencyKey: cmaLinkIdempotencyKey(slug, email, requestedAt),
          initiator: { kind: 'system', broker: brokerSlug, source: 'cma-email-link' },
          payload: {
            rail: 'gmail',
            to: [email],
            subject,
            bodyText: html,
            bodyFormat: 'html',
            withSignature: true,
            track: { personId, emailKey: `cma:${slug}:link`, label: subject, broker: brokerSlug },
          },
        })
        if (!res.ok) console.warn('[cma/email-link] not sent', slug, res.stage)
      } catch (err) {
        console.error('[cma/email-link] send failed', slug, err instanceof Error ? err.message : err)
      }
    })
  }

  return page(renderEmailLinkSentShell({ slug, address, broker: door.broker }))
}
