/**
 * Approve / finalize / send never rebuild.
 *
 * A broker who clicks Approve or Send must ship the stored document as it
 * sits. These paths must not call buildCma or any rebuild.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const admin = readFileSync(join(root, 'app/actions/cma-admin.ts'), 'utf8')
const send = readFileSync(join(root, 'lib/cma/send.ts'), 'utf8')
const auto = readFileSync(join(root, 'lib/cma/auto-send.ts'), 'utf8')
const queue = readFileSync(join(root, 'app/actions/cma-queue.ts'), 'utf8')
const pdf = readFileSync(join(root, 'lib/cma-pdf.ts'), 'utf8')
const contact = readFileSync(join(root, 'app/actions/contact-cma.ts'), 'utf8')

function functionBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`)
  expect(start).toBeGreaterThan(0)
  const next = src.indexOf('\nexport async function ', start + 1)
  return next === -1 ? src.slice(start) : src.slice(start, next)
}

describe('approve and send never rebuild', () => {
  it('approveCmaAction only finalizes the stored row', () => {
    const fn = functionBody(admin, 'approveCmaAction')
    expect(fn).not.toMatch(/buildCma\(/)
    expect(fn).not.toMatch(/rebuildCmaAction/)
    expect(fn).toMatch(/updateCmaRowFieldsBySlug/)
    expect(fn).toMatch(/status: 'finalized'/)
    expect(fn).toMatch(/finalized_at/)
  })

  it('sendCmaToLeadAction forwards the stored slug to sendCmaToLead', () => {
    const fn = functionBody(admin, 'sendCmaToLeadAction')
    expect(fn).not.toMatch(/buildCma\(/)
    expect(fn).not.toMatch(/rebuildCmaAction/)
    expect(fn).toMatch(/sendCmaToLead\(safeSlug/)
  })

  it('sendCmaToLead renders the stored document as a PDF and never builds', () => {
    expect(send).not.toMatch(/from '@\/lib\/cma\/build'/)
    expect(send).not.toMatch(/buildCma\(/)
    expect(send).not.toMatch(/rebuildCma/)
    expect(send).toMatch(/renderCmaPdfBuffer\(slug\)/)
    const fn = functionBody(send, 'sendCmaToLead')
    expect(fn).toMatch(/resolveSendContext\(slug\)/)
    expect(fn).toMatch(/renderCmaPdfBuffer/)
  })

  it('auto-send finalize writes status only, same as approveCmaAction', () => {
    expect(auto).not.toMatch(/from '@\/lib\/cma\/build'/)
    expect(auto).not.toMatch(/buildCma\(/)
    expect(auto).toMatch(/status: 'finalized'/)
    expect(auto).toMatch(/finalized_at/)
    expect(auto).toMatch(/sendCmaToLead/)
  })

  it('approveAndDeliverCma goes through approveCmaAction then send, not buildCma', () => {
    const fn = functionBody(queue, 'approveAndDeliverCma')
    expect(fn).not.toMatch(/buildCma\(/)
    expect(fn).toMatch(/approveCmaAction/)
    expect(fn).toMatch(/sendCmaToLeadAction/)
  })

  it('PDF render reads the stored HTML, not a rebuild', () => {
    expect(pdf).not.toMatch(/from '@\/lib\/cma\/build'/)
    expect(pdf).not.toMatch(/buildCma\(/)
    expect(pdf).toMatch(/resolveCmaPrintHtml\(slug\)/)
  })

  it('sendCmaForContactAction sends the stored slug through sendCmaToLead', () => {
    const fn = functionBody(contact, 'sendCmaForContactAction')
    expect(fn).not.toMatch(/buildCma\(/)
    expect(fn).toMatch(/sendCmaToLead\(slug\)/)
  })
})
