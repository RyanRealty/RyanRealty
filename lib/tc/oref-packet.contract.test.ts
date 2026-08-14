import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const checkAdminAction = vi.fn()
vi.mock('@/lib/admin/require-admin', () => ({
  checkAdminAction: (...a: unknown[]) => checkAdminAction(...a),
}))

const sendGovernedEmail = vi.fn()
vi.mock('@/lib/comms/sendGovernedEmail', () => ({
  sendGovernedEmail: (...a: unknown[]) => sendGovernedEmail(...a),
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const serviceClientBuilt = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => {
    serviceClientBuilt()
    const b: Record<string, unknown> = {}
    for (const m of ['from', 'select', 'insert', 'update', 'eq', 'in', 'order', 'maybeSingle', 'single', 'is']) {
      b[m] = () => b
    }
    b.maybeSingle = () => Promise.resolve({ data: null })
    return b
  },
}))

const OLD_ENV = { ...process.env }
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc'

import { emailOrefPacketToMatt } from '@/app/actions/tc-oref-packet'

afterEach(() => {
  vi.clearAllMocks()
  process.env = { ...OLD_ENV, NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' }
})

const ALLOW = {
  ok: true as const,
  ctx: {
    email: 'matt@ryan-realty.com',
    role: 'superuser' as const,
    brokerId: null,
    brokerSlug: 'matt' as const,
    flags: { canExport: true, pauseLeads: false },
  },
}

const NEW_PATH_FILES = [
  'lib/tc/oref-fill.ts',
  'lib/tc/oref-fill-pdf.ts',
  'lib/tc/oref-001-field-map.ts',
  'lib/tc/oref-matt-email.ts',
  'app/actions/tc-oref-packet.ts',
  'app/admin/(protected)/deals/[key]/FillOrefPacket.tsx',
]

const SKYSLOPE_CLIENT = /from ['"][^'"]*skyslope-files-api|api-latest\.skyslope|forms\.skyslope\.com|SKYSLOPE_ACCESS|from ['"]@\/lib\/skyslope/

describe('OREF packet email action', () => {
  it('refuses a client recipient before sendGovernedEmail or a DB client', async () => {
    checkAdminAction.mockResolvedValue(ALLOW)
    const r = await emailOrefPacketToMatt('doc-1', { to: ['buyer@example.com'] })
    expect(r.error).toMatch(/client/i)
    expect(sendGovernedEmail).not.toHaveBeenCalled()
    expect(serviceClientBuilt).not.toHaveBeenCalled()
  })
})

describe('OREF packet path has no SkySlope client', () => {
  it('does not import a SkySlope API client in the new fill/email/seal files', () => {
    for (const rel of NEW_PATH_FILES) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
      expect(src, rel).not.toMatch(SKYSLOPE_CLIENT)
    }
  })
})
