// @no-parity — internal admin surface, no public mockup contract
//
// Compose a newsletter — P11C: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the shared presentation kit
// (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: the getCrmAccess() → /admin/access-denied redirect,
// the NewsletterComposeForm mount (which still calls
// adminCreateNewsletterAction and routes to the new draft), the
// /admin/newsletters href, and the draft-first sentence.
//
// Shape changed, data did not: the console panel became a v2 section head and
// the page title is gone — the nav names this page.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { SectionHead } from '@/components/admin/v2'
import NewsletterComposeForm from '../NewsletterComposeForm'

export const metadata = { title: 'Compose newsletter | Admin' }
export const dynamic = 'force-dynamic'

export default async function NewNewsletterPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <nav style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)' }}>
        <Link href="/admin/newsletters" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Newsletter
        </Link>
      </nav>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 4px' }}>
        Saves a draft. You review and send it from the draft page.
      </p>

      <SectionHead>Compose</SectionHead>
      <NewsletterComposeForm />
    </div>
  )
}
