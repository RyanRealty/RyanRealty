import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const todayActions = new URL('../../app/admin/(protected)/today/actions.ts', import.meta.url)
const queueActions = new URL(
  '../../app/admin/(protected)/approval-queue/actions.ts',
  import.meta.url,
)
const todayPage = new URL('../../app/admin/(protected)/today/page.tsx', import.meta.url)
const todayForm = new URL(
  '../../app/admin/(protected)/today/TodayApproveDraftForm.tsx',
  import.meta.url,
)

describe('Today Yes stamps a ready draft', () => {
  it('reuses the approval-queue approve action and does not publish or text', () => {
    const todaySrc = readFileSync(todayActions, 'utf8')
    const queueSrc = readFileSync(queueActions, 'utf8')
    const pageSrc = readFileSync(todayPage, 'utf8')
    const formSrc = readFileSync(todayForm, 'utf8')

    expect(queueSrc).toMatch(/export async function approveNowAction/)
    expect(queueSrc).toMatch(/checkAdminAction\('approvals\.act'\)/)
    expect(queueSrc).toMatch(/approveAction/)
    expect(queueSrc).toMatch(/from ['"]@\/lib\/data\/agent\/actions['"]/)
    expect(queueSrc).not.toMatch(/\/api\/social\/publish/)
    expect(queueSrc).not.toMatch(/publisher-sweep/)
    expect(queueSrc).not.toMatch(/sendCrmSmsAction/)

    expect(todaySrc).toMatch(/export async function approveReadyDraftToday/)
    expect(todaySrc).toMatch(/checkAdminAction\('today\.view'\)/)
    expect(todaySrc).toMatch(/approveNowAction/)
    expect(todaySrc).toMatch(/revalidatePath\('\/admin\/today'\)/)
    expect(todaySrc).not.toMatch(/\/api\/social\/publish/)
    expect(todaySrc).not.toMatch(/publisher-sweep/)
    expect(todaySrc).not.toMatch(/from ['"]@\/lib\/crm\/twilio['"]/)

    expect(pageSrc).toMatch(/TodayApproveDraftForm/)
    expect(pageSrc).toMatch(/approveReadyDraftToday|TodayApproveDraftForm/)
    expect(formSrc).toMatch(/useTransition/)
    expect(formSrc).toMatch(/toast/)
    expect(formSrc).toMatch(/'Yes'/)
    expect(formSrc).toMatch(/from ['"]@\/components\/admin\/v2['"]/)
  })
})
