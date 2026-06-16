// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import NewsletterComposeForm from '../NewsletterComposeForm'

export const metadata = { title: 'Compose newsletter | Admin' }
export const dynamic = 'force-dynamic'

export default async function NewNewsletterPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  return (
    <main className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-6 sm:py-8">
      <div className="mb-1 text-sm text-muted-foreground">
        <Link href="/admin/newsletters" className="inline-flex min-h-10 items-center hover:text-foreground">← Back to Newsletter</Link>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Compose newsletter</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Saves a draft. You review and send it from the draft page.
      </p>

      <ConsoleSection title="Compose" className="mt-6">
        <NewsletterComposeForm />
      </ConsoleSection>
    </main>
  )
}
