import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, symlinkSync, mkdtempSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

/**
 * Break-tests for ci:cma-send-floor (scripts/check-cma-send-floor.mjs, G81).
 *
 * Each case copies the files the gate reads into a sandbox OUTSIDE the repo
 * (node_modules symlinked in for `typescript`), breaks exactly one rule, and
 * asserts a non-zero exit naming that rule. The first case proves the
 * untouched copy passes, so a failure below is the mutation, not the copy.
 */

const REPO = resolve(new URL('.', import.meta.url).pathname, '../..')
const SANDBOX = mkdtempSync(join(tmpdir(), 'cma-send-floor-gate-'))

const FILES = [
  'scripts/check-cma-send-floor.mjs',
  'lib/cma/send-floor.ts',
  'lib/cma/send.ts',
  'app/actions/cma-admin.ts',
  'app/actions/prospecting.ts',
  'lib/cma-deliver.ts',
  'lib/data/cma/unified-queue.ts',
  'app/actions/cma-queue.ts',
  'lib/data/prospecting/drip-drain.ts',
  'lib/cma/serve-document.ts',
  'app/actions/cma-publish.ts',
]

function reset() {
  rmSync(SANDBOX, { recursive: true, force: true })
  mkdirSync(SANDBOX, { recursive: true })
  symlinkSync(join(REPO, 'node_modules'), join(SANDBOX, 'node_modules'))
  for (const rel of FILES) {
    const dest = join(SANDBOX, rel)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(join(REPO, rel), dest)
  }
}

function runGate() {
  try {
    const out = execFileSync('node', [join(SANDBOX, 'scripts/check-cma-send-floor.mjs')], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

function edit(rel, fn) {
  const p = join(SANDBOX, rel)
  const before = readFileSync(p, 'utf8')
  const after = fn(before)
  if (after === before) throw new Error(`mutation did not change ${rel}`)
  writeFileSync(p, after)
}

function expectCaught(rule, breakIt) {
  reset()
  breakIt()
  const r = runGate()
  expect(r.code, r.out).not.toBe(0)
  expect(r.out).toContain(`${rule}:`)
}

afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

describe('ci:cma-send-floor', () => {
  it('passes on the untouched tree', () => {
    reset()
    const r = runGate()
    expect(r.code, r.out).toBe(0)
  })

  it('R1: moving the line fails', () => {
    expectCaught('R1', () => edit('lib/cma/send-floor.ts', (s) => s.replace('EXPIRED_SEND_FLOOR_RATIO = 0.8', 'EXPIRED_SEND_FLOOR_RATIO = 0.7')))
  })

  it('R2: the send rail without the check fails', () => {
    expectCaught('R2', () =>
      edit('lib/cma/send.ts', (s) => s.replace('const floor = await getCmaSendFloorBySlug(slug)', 'const floor = { held: false, reason: null }')),
    )
  })

  it('R2: the check moved after delivery fails', () => {
    expectCaught('R2', () =>
      edit('lib/cma/send.ts', (s) =>
        s
          .replace('const floor = await getCmaSendFloorBySlug(slug)\n  if (floor.held) return { ok: false, error: `Not sent. ${floor.reason}` }\n', '')
          .replace('    return await deliverCmaToLead(ctx,', '    const floor = await getCmaSendFloorBySlug(slug)\n    void floor\n    return await deliverCmaToLead(ctx,'),
      ),
    )
  })

  it('R3: approve without the check fails', () => {
    expectCaught('R3', () =>
      edit('app/actions/cma-admin.ts', (s) => s.replace('const floor = await getCmaSendFloorBySlug(safeSlug)\n    if (floor.held) return { error: floor.reason }', '')),
    )
  })

  it('R4: the text intro that never acts on the check fails', () => {
    expectCaught('R4', () => edit('app/actions/prospecting.ts', (s) => s.replace('if (smsFloor.held) {', 'if (smsFloor.ratio === 0) {')))
  })

  it('R4: the email intro that acts after the claim fails', () => {
    expectCaught('R4', () =>
      edit('app/actions/prospecting.ts', (s) => {
        const at = s.indexOf('if (emailFloor.held) {')
        const claim = s.indexOf('claimProspectEmailSend(kind')
        if (at < 0 || claim < 0) return s
        // Put a claim ahead of the floor's use inside the same function.
        return s.slice(0, at) + 'await claimProspectEmailSend(kind, id, args.idempotencyKey)\n    ' + s.slice(at)
      }),
    )
  })

  it('R5: the legacy delivery without the check fails', () => {
    expectCaught('R5', () => edit('lib/cma-deliver.ts', (s) => s.replace('const floor = await getCmaSendFloorBySlug(safeSlug)', 'const floor = { held: false, reason: null }')))
  })

  it('R6: a queue that never holds fails', () => {
    expectCaught('R6', () => edit('lib/data/cma/unified-queue.ts', (s) => s.replace("return 'held'", "return 'flagged'")))
  })

  it('R6: a send action that ignores held fails', () => {
    expectCaught('R6', () => edit('app/actions/cma-queue.ts', (s) => s.replace("if (row.state === 'held') {", 'if (false) {')))
  })

  it('R7: a drip that retries a held row fails', () => {
    expectCaught('R7', () => edit('lib/data/prospecting/drip-drain.ts', (s) => s.replace("  'price-floor',\n])", '])')))
  })

  it('R8: a new file that mails a CMA link without the check fails', () => {
    expectCaught('R8', () => {
      const p = join(SANDBOX, 'lib/new-cma-mailer.ts')
      writeFileSync(p, "export async function x(slug: string) {\n  await sendEmail({ to: 'a', html: `https://ryan-realty.com/cma/${slug}` })\n}\n")
    })
  })

  it('R2: a check whose answer is ignored fails', () => {
    expectCaught('R2', () =>
      edit('lib/cma/send.ts', (s) => s.replace('if (floor.held) return { ok: false, error: `Not sent. ${floor.reason}` }', 'if (false && floor.held) return { ok: false, error: `Not sent. ${floor.reason}` }')),
    )
  })

  it('R8: a new file that texts a CMA link without the check fails', () => {
    expectCaught('R8', () => {
      writeFileSync(
        join(SANDBOX, 'lib/new-cma-texter.ts'),
        "export async function x(slug: string, to: string) {\n  await sendSmsViaMessagingService({ to, body: 'https://ryan-realty.com/cma/' + slug })\n}\n",
      )
    })
  })

  it('R8: a comment that names sendEmail is not a send', () => {
    reset()
    writeFileSync(
      join(SANDBOX, 'lib/broker-preview.ts'),
      "// Never sendEmail( from here; the broker opens it.\nexport const previewLink = (slug: string) => `https://ryan-realty.com/cma/${slug}`\n",
    )
    const r = runGate()
    expect(r.code, r.out).toBe(0)
  })

  it('R9: a new file that attaches the CMA PDF without the check fails', () => {
    expectCaught('R9', () => {
      writeFileSync(
        join(SANDBOX, 'lib/new-pdf-mailer.ts'),
        "export async function x(slug: string) {\n  const pdf = await renderCmaPdfBuffer(slug)\n  await sendEmail({ to: 'a', attachments: [pdf] })\n}\n",
      )
    })
  })

  it('R10: a public page that shows a held CMA fails', () => {
    expectCaught('R10', () =>
      edit('lib/cma/serve-document.ts', (s) => s.replace('const floor = await getCmaSendFloorBySlug(safeSlug)', 'const floor = { held: false }')),
    )
  })

  it('R11: publishing a held CMA to a listing page fails', () => {
    expectCaught('R11', () =>
      edit('app/actions/cma-publish.ts', (s) => s.replace('if (floor.held && floor.reason) reasons.push(floor.reason)', 'void floor')),
    )
  })

  it('R8: the same file with the check stays green', () => {
    reset()
    const p = join(SANDBOX, 'lib/new-cma-mailer.ts')
    writeFileSync(
      p,
      "export async function x(slug: string) {\n  const f = await getCmaSendFloorBySlug(slug)\n  if (f.held) return\n  await sendEmail({ to: 'a', html: `https://ryan-realty.com/cma/${slug}` })\n}\n",
    )
    const r = runGate()
    expect(r.code, r.out).toBe(0)
  })
})
