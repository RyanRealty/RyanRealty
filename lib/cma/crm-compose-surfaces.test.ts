import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const review = readFileSync(resolve('app/admin/(protected)/cmas/_components/CmaReviewActions.tsx'), 'utf8')
const sendCenter = readFileSync(resolve('components/admin/crm/ContactSendCenter.tsx'), 'utf8')
const attach = readFileSync(resolve('components/admin/crm/CmaComposeAttach.tsx'), 'utf8')
const card = readFileSync(resolve('components/admin/crm/ContactCmaCard.tsx'), 'utf8')
const home = readFileSync(resolve('components/admin/crm/OwnedHomeCard.tsx'), 'utf8')
const action = readFileSync(resolve('app/actions/cma-compose.ts'), 'utf8')
const contactCmas = readFileSync(resolve('lib/data/crm/getContactCmas.ts'), 'utf8')
const comms = readFileSync(resolve('app/admin/(protected)/people/[id]/CommsSection.tsx'), 'utf8')
const header = readFileSync(resolve('app/admin/(protected)/people/[id]/PersonIdentityHeader.tsx'), 'utf8')
const personPage = readFileSync(resolve('app/admin/(protected)/people/[id]/page.tsx'), 'utf8')
const hrefMod = readFileSync(resolve('lib/cma/crm-compose-href.ts'), 'utf8')

describe('CMA send surfaces route through Review EmailBodyEditor', () => {
  it('review stays on shared EmailBodyEditor — Schedule/Send now, no People compose hop', () => {
    expect(review).toMatch(/approveAndDeliverCma/)
    expect(review).toMatch(/EmailBodyEditor/)
    expect(review).toMatch(/Schedule|Send now/)
    expect(review).not.toMatch(/cmaCrmComposeHref/)
    expect(review).not.toMatch(/Write a custom email/)
    expect(review).not.toMatch(/composeCma=/)
    expect(review).not.toMatch(/mailto:/)
  })

  it('Send Center CMA tab opens Review & send, never Blank People compose', () => {
    expect(sendCenter).toMatch(/cmaReviewSendHref/)
    expect(sendCenter).toMatch(/Review & send/)
    expect(sendCenter).toMatch(/hasDocument/)
    expect(sendCenter).not.toMatch(/cmaCrmComposeHref/)
    expect(sendCenter).not.toMatch(/Open in Messages/)
    expect(sendCenter).not.toMatch(/kind:\s*'cma'/)
    expect(sendCenter).not.toMatch(/label="Send CMA"/)
    expect(sendCenter).not.toMatch(/mailto:/)
  })

  it('compose strip can attach PDF, text-me, and email draft', () => {
    expect(attach).toMatch(/Attach PDF/)
    expect(attach).toMatch(/Text me/)
    expect(attach).toMatch(/Email draft/)
    expect(attach).toMatch(/stageCmaPdfForComposeAction/)
    expect(comms).toMatch(/CmaComposeAttach/)
    expect(comms).toMatch(/initialAttachments/)
    expect(comms).toMatch(/textMePhone/)
  })

  it('contact CMA card and owned-home card open Review, not People Blank compose', () => {
    expect(card).toMatch(/Review & send/)
    expect(card).toMatch(/reviewUrl/)
    expect(card).not.toMatch(/cmaCrmComposeHref/)
    expect(card).not.toMatch(/Send from CRM/)
    expect(card).not.toMatch(/sendAction/)
    expect(home).toMatch(/reviewSlug/)
    expect(home).toMatch(/Review & send/)
    expect(home).not.toMatch(/composeHref/)
    expect(home).not.toMatch(/Send from CRM/)
    expect(home).not.toMatch(/sendAction/)
  })

  it('href helper never returns People List Blank fallback', () => {
    expect(hrefMod).toMatch(/cmaReviewSendHref/)
    expect(hrefMod).toMatch(/return null/)
    expect(hrefMod).not.toMatch(/return '\/admin\/people'/)
  })

  it('stage action renders a PDF and uploads it — it does not send', () => {
    expect(action).toMatch(/renderCmaPdfBuffer/)
    expect(action).toMatch(/uploadAttachmentBytes/)
    expect(action).not.toMatch(/sendCmaToLead/)
    expect(action).not.toMatch(/sendDeliverable/)
    expect(action).not.toMatch(/gmail/i)
  })

  it('contact CMA list treats a built draft as attachable', () => {
    expect(contactCmas).toMatch(/built_at/)
    expect(contactCmas).toMatch(/cmaHasStoredHtml/)
    expect(contactCmas).toMatch(/hasDocument/)
  })

  it('person email chrome goes to #comms, not mailto or Gmail', () => {
    expect(header).toMatch(/href="#comms"/)
    expect(header).not.toMatch(/mailto:/)
    expect(personPage).toMatch(/replyChannel=email#comms/)
    expect(personPage).not.toMatch(/mailto:/)
  })
})
