import type { Metadata } from 'next'
import AdminEmailCompose from '@/components/admin/AdminEmailCompose'
import { ConsoleSection } from '@/components/console/ConsoleSection'

export const metadata: Metadata = {
  title: 'Compose email',
  description: 'Compose and send email from admin.',
}

export const dynamic = 'force-dynamic'

export default function AdminEmailComposePage() {
  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground">Compose email</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Send an email to a recipient. Configure Resend for delivery.
      </p>
      <ConsoleSection title="Compose email" className="mt-6">
        <AdminEmailCompose />
      </ConsoleSection>
    </main>
  )
}
