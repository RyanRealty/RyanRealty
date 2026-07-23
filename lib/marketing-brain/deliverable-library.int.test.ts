/**
 * Real-storage integration test for the broker content library (W10.2).
 *
 * Runs the ACTUAL persistDeliverable / listBrokerDeliverables /
 * signDeliverableDownload against the live private `marketing-deliverables`
 * bucket.
 *
 * Written against an adversarial review that broke the first version live: a
 * percent-encoded traversal (`%2e%2e`) passed the old path-shaped guard,
 * because Supabase decodes the object key AFTER our check, and returned HTTP
 * 200 on another broker's bytes. That review also showed the original
 * isolation and privacy tests were partly vacuous — they would have passed on
 * an implementation that simply returned nothing. Both classes are covered
 * here on purpose: every negative assertion is paired with a positive one that
 * fails if the read path silently stops working.
 *
 * Skips itself (no failure) when SUPABASE_SERVICE_ROLE_KEY is absent so CI
 * without DB creds stays green. Self-cleaning: every object it writes is
 * removed in afterAll, even on assertion failure. Uses `zz-test-` prefixes
 * that can never collide with a real broker slug.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { config } from 'dotenv'

config({ path: '.env.local' })

const HAVE_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
const run = HAVE_DB ? describe : describe.skip

const STAMP = process.env.VITEST_WORKER_ID ?? '0'
const BROKER_A = `zz-test-broker-a-${STAMP}`
const BROKER_B = `zz-test-broker-b-${STAMP}`
const ACTION_ID = `zz-test-action-${STAMP}`
const FILENAME = 'deliverable.json'
const BODY_A = JSON.stringify({ owner: 'A', stamp: STAMP })
const BODY_B = JSON.stringify({ owner: 'B', stamp: STAMP })

run('broker content library — persistence + isolation (real storage)', () => {
  const written: string[] = []

  afterAll(async () => {
    if (!written.length) return
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { DELIVERABLE_BUCKET } = await import('./deliverable-library')
    await createServiceClient().storage.from(DELIVERABLE_BUCKET).remove(written)
  })

  it('persists, lists back for its own broker, and downloads the exact bytes', async () => {
    const lib = await import('./deliverable-library')

    const persisted = await lib.persistDeliverable({
      actionId: ACTION_ID,
      brokerSlug: BROKER_A,
      filename: FILENAME,
      body: BODY_A,
      contentType: 'application/json',
    })
    expect(persisted.ok, `persist failed: ${persisted.ok ? '' : persisted.error}`).toBe(true)
    if (!persisted.ok) return
    written.push(persisted.path)

    const mine = await lib.listBrokerDeliverables(BROKER_A)
    const found = mine.find((d) => d.path === persisted.path)
    expect(found, 'persisted deliverable was not listed back for its broker').toBeTruthy()
    expect(found?.filename).toBe(FILENAME)
    expect(found?.actionId).toBe(ACTION_ID)

    const url = await lib.signDeliverableDownload(BROKER_A, ACTION_ID, FILENAME)
    expect(url, 'owning broker could not sign their own deliverable').toBeTruthy()
    const res = await fetch(url as string)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(BODY_A)
  })

  it('filters by broker rather than returning nothing (non-vacuous isolation)', async () => {
    const lib = await import('./deliverable-library')

    // Broker B gets their OWN file, so a listing that always returned [] fails
    // this test — the original version asserted only absences and would have
    // passed on a totally broken read path.
    const b = await lib.persistDeliverable({
      actionId: ACTION_ID,
      brokerSlug: BROKER_B,
      filename: FILENAME,
      body: BODY_B,
      contentType: 'application/json',
    })
    expect(b.ok).toBe(true)
    if (!b.ok) return
    written.push(b.path)

    const theirs = await lib.listBrokerDeliverables(BROKER_B)
    // positive: B's own file IS present
    expect(theirs.some((d) => d.path === b.path), "broker B cannot see their own file").toBe(true)
    // negative: A's file is NOT
    expect(theirs.every((d) => d.brokerSlug !== BROKER_A)).toBe(true)
    expect(theirs.some((d) => d.path.startsWith(`${BROKER_A}/`))).toBe(false)
  })

  it('refuses every spelling of another broker’s path', async () => {
    const lib = await import('./deliverable-library')

    // The signature takes PARTS, so the only lever a caller has is the ids
    // themselves. Traversal in any encoding must not escape the prefix.
    const escapes = [
      '..',
      '%2e%2e',
      '%252e%252e',
      `../${BROKER_A}`,
      `..%2f${BROKER_A}`,
      '/',
      '',
    ]
    for (const evil of escapes) {
      const url = await lib.signDeliverableDownload(BROKER_B, evil, FILENAME)
      if (url) {
        const res = await fetch(url)
        const body = await res.text()
        expect(body, `traversal via "${evil}" reached another broker's bytes`).not.toBe(BODY_A)
      }
    }

    // And the guard itself rejects encoded traversal outright.
    expect(lib.pathBelongsToBroker(BROKER_B, `${BROKER_B}/%2e%2e/${BROKER_A}/${ACTION_ID}/${FILENAME}`)).toBe(false)
    expect(lib.pathBelongsToBroker(BROKER_B, `${BROKER_B}/../${BROKER_A}/${ACTION_ID}/${FILENAME}`)).toBe(false)
    // an empty/garbage slug must not become a wildcard
    expect(lib.pathBelongsToBroker('!!!', `${BROKER_A}/${ACTION_ID}/${FILENAME}`)).toBe(false)
    expect(lib.pathBelongsToBroker('', `/${BROKER_A}/${ACTION_ID}/${FILENAME}`)).toBe(false)
    // sanity: the owning broker's own canonical path still passes
    expect(lib.pathBelongsToBroker(BROKER_A, lib.deliverablePath(BROKER_A, ACTION_ID, FILENAME))).toBe(true)
  })

  it('refuses to WRITE an object whose segments sanitize to nothing', async () => {
    // REGRESSION (round 2, demonstrated live): persistDeliverable validated the
    // RAW inputs then built the key from the SANITIZED ones, so '!!!' passed the
    // truthiness check, sanitized to '', and the object landed at bucket ROOT
    // with no broker prefix — invisible to every library and listable by anyone
    // whose slug happened to equal the action id.
    const lib = await import('./deliverable-library')
    for (const bad of ['!!!', '..', '.', '-', ' ']) {
      const res = await lib.persistDeliverable({
        actionId: bad,
        brokerSlug: BROKER_A,
        filename: FILENAME,
        body: 'should never be written',
      })
      expect(res.ok, `persist accepted actionId "${bad}" — it can escape the broker prefix`).toBe(false)

      const res2 = await lib.persistDeliverable({
        actionId: ACTION_ID,
        brokerSlug: bad,
        filename: FILENAME,
        body: 'should never be written',
      })
      expect(res2.ok, `persist accepted brokerSlug "${bad}"`).toBe(false)
    }
  })

  it('canonicalizes the CRM slug namespace so the broker actually sees the file', async () => {
    // REGRESSION (found against live data, not by reading code): public.brokers
    // carries two namespaces — slug 'matthew-ryan' and crm_slug 'matt'. Every
    // live marketing_brain_actions row has assigned_approver='matt', while the
    // library page reads brokers.slug. Returning the raw approver piled every
    // deliverable into `matt/`, a prefix no login can read.
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { resolveBrokerSlugForAction } = await import('./deliverable-library')
    const supabase = createServiceClient()

    const { data: inserted, error } = await supabase
      .from('marketing_brain_actions')
      .insert({
        topic: 'zz-test canonical slug probe',
        format: 'test',
        hook: 'test',
        target_audience: 'test',
        generated_by: 'w10.2-int-test',
        action_type: 'analyze:test',
        target: 'test:w10.2',
        assigned_producer: 'test',
        assigned_approver: 'matt',
        status: 'pending',
      })
      .select('id')
      .single()

    if (error || !inserted) throw new Error(`could not seed action row: ${error?.message}`)
    try {
      const slug = await resolveBrokerSlugForAction(inserted.id as string)
      expect(slug).toBe('matthew-ryan')
      expect(slug).not.toBe('matt')
    } finally {
      await supabase.from('marketing_brain_actions').delete().eq('id', inserted.id)
    }
  })

  it('keeps the bucket private — signed serves it, unsigned does not', async () => {
    const lib = await import('./deliverable-library')
    const path = lib.deliverablePath(BROKER_A, ACTION_ID, FILENAME)

    // Positive first, so a non-200 below cannot be explained by "the object
    // isn't there" — the original test could not tell those apart.
    const signed = await lib.signDeliverableDownload(BROKER_A, ACTION_ID, FILENAME)
    expect(signed).toBeTruthy()
    expect((await fetch(signed as string)).status).toBe(200)

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${lib.DELIVERABLE_BUCKET}/${path}`
    const res = await fetch(publicUrl)
    expect(res.status, 'bucket is serving deliverables publicly').not.toBe(200)
  })
})
