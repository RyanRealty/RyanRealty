/**
 * One-tap CMA kick-off core (admin-rebuild v2, D8 — the litmus path).
 *
 * The broker taps "Build CMA" on a lead (usually arriving from a new-lead
 * notification deep link `?intent=cma`). This core:
 *   1. Parses + validates the subject address (city required — the builder
 *      cannot pick comps without one).
 *   2. Dedupes: an OPEN build (pending/in_production action row) for the same
 *      slug is attached to, never duplicated — direction-explicit
 *      "ensure exactly one build is queued", not a blind enqueue. Attaching
 *      ALSO joins the row's ready-notify list (atomic RPC append), so the
 *      second kicker gets the "draft ready" text the sheet promises, not just
 *      the first enqueuer.
 *   3. Enqueues via the canonical createCmaRequest (same pipeline as the
 *      seller LP): cmas draft row + content:cma action row, drained by the
 *      cma-build-worker cron. notifyLead=false (the broker initiated this),
 *      notifyBroker=false (no email about your own tap), brokerSmsNotify set
 *      so the worker TEXTS the broker a review link when the draft is ready.
 *   4. Is idempotent at the request layer: the whole run sits under
 *      withSendIdempotency keyed on the client-generated per-mount uuid, so a
 *      double-tap replays the first result instead of re-running.
 *
 * Auth lives in the server-action wrapper (app/actions/crm-cma-kickoff.ts):
 * requireCrmAccess + requirePersonInScope run in-body there. This core is
 * separated so the idempotency/dedupe contract is integration-testable
 * against the real DB without a session.
 */

import 'server-only'
import { parseContactAddress } from '@/lib/crm/contact-cma-address'
import { slugifyAddress } from '@/lib/cma/address-slug'
import { withSendIdempotency } from '@/lib/crm/idempotency'
import { appendCmaActionNotify, findOpenCmaActionBySlug } from '@/lib/data'
import { getLatestCmaRowForBaseSlug, resolveWritableCmaSlot } from '@/lib/cma/versions'
import { getPersonForCmaKickoff, logCmaKickoffTimeline } from '@/lib/data/crm/cmaKickoff'

export type CmaKickoffResult =
  | {
      ok: true
      slug: string
      /** An OPEN build for this slug already exists — attached, not re-enqueued. */
      alreadyQueued: boolean
      /** A cmas row for this slug already exists (draft/finalized/delivered) —
       *  NOTHING was enqueued or overwritten; review the existing document.
       *  Guards the upsert-by-slug clobber class (adversarial review 2026-07-17
       *  HIGH: a kick-off for an address with a delivered CMA must never flip
       *  its status/client back to a fresh draft). */
      alreadyBuilt?: boolean
      /** A sibling request with the SAME key is still mid-flight — the caller
       *  should poll again rather than render a terminal success. */
      inFlight?: boolean
    }
  | { ok: false; error: string }

const IDEM_KEY_RE = /^[a-z0-9][a-z0-9-]{7,63}$/i

/**
 * Join a kicker to an open build's ready-notify list (the attach half of the
 * D8 notify contract — review MED 2026-07-17: the second kicker's text must
 * not silently depend on the first enqueue's payload). The append is atomic
 * server-side (row-locked RPC), so concurrent attaches never lose an entry.
 * If the worker closed the build before the append landed, its notify pass has
 * already read the list without this entry — when the draft reached 'ready',
 * text now instead (queueBrokerAlert's per-(slug, person) dedupe absorbs any
 * overlap with the worker). Best-effort: a notify hiccup never fails the
 * attach itself.
 */
async function joinReadyNotify(params: {
  actionId: string
  slug: string
  subjectAddress: string
  personId: number
  broker: string
}): Promise<void> {
  try {
    const res = await appendCmaActionNotify(params.actionId, {
      personId: params.personId,
      broker: params.broker,
    })
    if (res.status === 'ready') {
      const { queueCmaReadyAlert } = await import('@/lib/crm/broker-alerts')
      await queueCmaReadyAlert({
        slug: params.slug,
        subjectAddress: params.subjectAddress,
        personId: params.personId,
        broker: params.broker,
      })
    }
  } catch (e) {
    console.warn('[cma-kickoff] ready-notify join failed:', e instanceof Error ? e.message : String(e))
  }
}

export async function kickoffCmaCore(input: {
  personId: number
  address: string
  idempotencyKey: string
  /** CRM broker slug of the broker who tapped (from getCrmAccess). */
  actorBroker: string | null
}): Promise<CmaKickoffResult> {
  const address = (input.address ?? '').trim()
  if (!address) return { ok: false, error: 'Enter the property address.' }
  if (!IDEM_KEY_RE.test(input.idempotencyKey ?? '')) {
    return { ok: false, error: 'Invalid request key. Reload and try again.' }
  }

  const parsed = parseContactAddress(address)
  if (!parsed || !parsed.parsedCity) {
    return {
      ok: false,
      error: 'Include the city so comps resolve — e.g. "123 NW Bond St, Bend".',
    }
  }

  const person = await getPersonForCmaKickoff(input.personId)
  if (!person) return { ok: false, error: 'Contact not found.' }

  const slug = slugifyAddress(parsed.rawAddress)
  const alertBroker = input.actorBroker ?? person.assignedBroker ?? 'matt'

  return withSendIdempotency<CmaKickoffResult>(
    {
      key: `cma-kickoff:${input.personId}:${input.idempotencyKey}`,
      scope: 'cma-kickoff',
      // inFlight marks this as NON-terminal: the client polls again instead of
      // rendering a success the sibling request may yet fail to deliver.
      onInFlight: { ok: true, slug, alreadyQueued: true, inFlight: true },
    },
    async () => {
      // Resolve the address's version-chain slot FIRST (lib/cma/versions.ts):
      // an address can carry a preserved delivered document at the base slug
      // plus a newer --vN document, so the open-build check, the existing-
      // document guard, and the stub carve-out below all operate on the
      // chain's writable end — never blindly on the base slug.
      const slot = await resolveWritableCmaSlot(slug)
      if (!slot.ok) return { ok: false, error: slot.error }

      // Direction-explicit dedupe FIRST: attach to an in-flight build for this
      // slot rather than enqueueing a second one ("already building" is the
      // truthful answer while an open action row exists) — a build queued by
      // ANY intake path (seller LP, cron) for this chain position counts.
      // Attaching joins the build's ready-notify list — the sheet promises
      // this kicker a text too. Stamp the attach on the timeline (review MED:
      // the second kicker's audit trail must not be silent).
      const open = await findOpenCmaActionBySlug(slot.slug)
      if (open) {
        await joinReadyNotify({
          actionId: open.id,
          slug: slot.slug,
          subjectAddress: parsed.rawAddress,
          personId: person.id,
          broker: alertBroker,
        })
        await logCmaKickoffTimeline({
          personId: person.id,
          title: 'CMA kick-off attached to in-flight build',
          body: `A CMA build for ${parsed.rawAddress} is already queued. No duplicate was created — ${alertBroker} is on the ready-text list for this build.`,
          broker: alertBroker,
          dedupeKey: `cma:kickoff-attach:${slot.slug}:${input.idempotencyKey.slice(0, 8)}`,
        })
        return { ok: true, slug: slot.slug, alreadyQueued: true }
      }

      // Clobber guard (review HIGH): surface an existing reviewable document
      // instead of rebuilding or overwriting anything from a kick-off:
      //   · the chain's newest document is protected (finalized/delivered/
      //     archived — the slot stepped past it), or
      //   · the writable slot already holds a BUILT draft.
      // EXCEPTION — never-built stubs are re-kickable (review LOW liveness
      // gap): a build killed after 3 failures leaves `html_path: 'pending:…'`
      // with no html_content. That row holds NO reviewed content to clobber,
      // and without this carve-out the address would be permanently stuck at
      // "already on file" pointing at a document that never built.
      if (!slot.existing && slot.priorStatus) {
        const latest = await getLatestCmaRowForBaseSlug(slug)
        const docSlug = latest?.slug ?? slug
        await logCmaKickoffTimeline({
          personId: person.id,
          title: 'CMA kick-off — existing document found',
          body: `A CMA for ${parsed.rawAddress} already exists (${slot.priorStatus}). Nothing was rebuilt or overwritten — review it at /admin/cmas/${docSlug}.`,
          broker: alertBroker,
          dedupeKey: `cma:kickoff-existing:${docSlug}:${input.idempotencyKey.slice(0, 8)}`,
        })
        return { ok: true, slug: docSlug, alreadyQueued: false, alreadyBuilt: true }
      }
      if (slot.existing) {
        const ex = slot.existing.row as { html_path?: unknown; html_content?: unknown }
        const isNeverBuiltStub = String(ex.html_path ?? '').startsWith('pending:') && !ex.html_content
        if (!isNeverBuiltStub) {
          await logCmaKickoffTimeline({
            personId: person.id,
            title: 'CMA kick-off — existing document found',
            body: `A CMA for ${parsed.rawAddress} already exists (draft). Nothing was rebuilt or overwritten — review it at /admin/cmas/${slot.slug}.`,
            broker: alertBroker,
            dedupeKey: `cma:kickoff-existing:${slot.slug}:${input.idempotencyKey.slice(0, 8)}`,
          })
          return { ok: true, slug: slot.slug, alreadyQueued: false, alreadyBuilt: true }
        }
      }

      const { createCmaRequest } = await import('@/lib/cma-request')
      const created = await createCmaRequest({
        rawAddress: parsed.rawAddress,
        parsedStreet: parsed.parsedStreet,
        parsedCity: parsed.parsedCity,
        parsedState: parsed.parsedState,
        parsedPostalCode: parsed.parsedPostalCode,
        leadEmail: person.primaryEmail,
        leadName: person.name,
        leadPhone: person.primaryPhone,
        crmPersonId: person.id,
        requestSource: 'crm-kickoff',
        notifyLead: false,
        notifyBroker: false,
        brokerSmsNotify: { personId: person.id, broker: alertBroker },
      })
      if (!created.ok) {
        // TOCTOU fallback (review MED): a concurrent kicker can win the race
        // between our open-build check and the insert. The partial unique
        // index on open content:cma rows turns that into a duplicate-key
        // error — attach to the winner instead of surfacing a failure, and
        // join its ready-notify list like any other attach.
        if (/duplicate key|23505/i.test(created.error)) {
          const winner = await findOpenCmaActionBySlug(slug)
          if (winner) {
            await joinReadyNotify({
              actionId: winner.id,
              slug,
              subjectAddress: parsed.rawAddress,
              personId: person.id,
              broker: alertBroker,
            })
            return { ok: true, slug, alreadyQueued: true }
          }
        }
        return { ok: false, error: created.error }
      }

      await logCmaKickoffTimeline({
        personId: person.id,
        title: 'CMA build kicked off',
        body: `CMA for ${parsed.rawAddress} queued from the contact page. The draft lands in /admin/cmas for review — a text goes to ${alertBroker} when it's ready.`,
        broker: alertBroker,
        dedupeKey: `cma:kickoff:${slug}:${input.idempotencyKey.slice(0, 8)}`,
      })

      return { ok: true, slug: created.slug, alreadyQueued: false }
    },
  )
}
