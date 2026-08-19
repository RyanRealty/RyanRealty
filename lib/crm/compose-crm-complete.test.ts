import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

describe('CRM compose is the only send path', () => {
  it('compose can attach disclosure, CMA PDF, and vCard from the site', () => {
    const surface = read('components/admin/crm/ComposeSurface.tsx')
    const actions = read('app/admin/(protected)/messages/actions.ts')
    const lib = read('lib/crm/library-attachments.ts')
    expect(surface).toMatch(/Agency disclosure/)
    expect(surface).toMatch(/CMA PDF/)
    expect(surface).toMatch(/vCard/)
    expect(surface).toMatch(/attachLibraryItemAction/)
    expect(actions).toMatch(/attachLibraryItemAction/)
    expect(lib).toMatch(/disclosure/)
    expect(lib).toMatch(/renderCmaPdfBuffer/)
    expect(lib).toMatch(/buildBrokerVcard/)
  })

  it('Text me this CMA opens compose and does not send until Send', () => {
    const btn = read('components/admin/crm/CmaTextMeButton.tsx')
    expect(btn).toMatch(/\/admin\/messages\/new\?self=1/)
    expect(btn).not.toMatch(/textCmaReviewLinkToMeAction/)
    expect(btn).not.toMatch(/startTransition/)
    const actions = read('app/admin/(protected)/messages/actions.ts')
    expect(actions).toMatch(/brokerSelf/)
    expect(actions).toMatch(/sendWhitelistedBrokerSms/)
  })

  it('person Email goes to CRM compose, not mailto', () => {
    const page = read('app/admin/(protected)/people/[id]/page.tsx')
    expect(page).toMatch(/replyChannel=email#comms/)
    expect(page).not.toMatch(/mailto:\$\{card\.email\}/)
  })

  it('thread compose loads saved drafts', () => {
    const thread = read('app/admin/(protected)/messages/MessagesThread.tsx')
    expect(thread).toMatch(/getDraftsForPerson/)
    expect(thread).toMatch(/draftText/)
  })

  it('does not document a Gmail or Mac Messages fallback on compose', () => {
    const surface = read('components/admin/crm/ComposeSurface.tsx')
    expect(surface).not.toMatch(/Gmail|iMessage|mailto:/i)
    expect(surface.includes('osascript')).toBe(false)
  })
})
