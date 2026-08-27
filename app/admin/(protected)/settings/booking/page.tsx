import { requireAdminPage } from '@/lib/admin/require-admin'
import { getCrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
import { listBookingBlackouts } from '@/lib/data/crm/bookingBlackouts'
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'
import { VerdictLine } from '@/components/admin/v2'
import BookingSettingsForm from './BookingSettingsForm'

/**
 * Booking settings — the public /book calendar's two controls.
 *
 * Both bookable hours and days off shipped working but editable only by SQL,
 * which meant the broker could not run their own calendar (Matt 2026-08-26).
 */
export const metadata = { title: 'Booking | Admin' }
export const dynamic = 'force-dynamic'

export default async function BookingSettingsPage() {
  const ctx = await requireAdminPage('settings.account')
  const brokerSlug = CRM_BROKER_BY_EMAIL[String(ctx.email ?? '').trim().toLowerCase()] ?? 'matt'

  const settings = await getCrmCompanySettings()
  const blackouts = await listBookingBlackouts(brokerSlug)
  const timeZone = settings.time_zone || 'America/Los_Angeles'

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 20px' }}>
        <VerdictLine tone={settings.booking_hours.length > 0 ? 'ok' : 'attention'}>
          {settings.booking_hours.length > 0 ? (
            <>
              <b>Your public booking calendar.</b> Hours are company-wide. Days off are yours only.
            </>
          ) : (
            <>
              <b>Booking is closed.</b> With no bookable hours set, ryan-realty.com/book offers no times.
            </>
          )}
        </VerdictLine>
      </div>

      <BookingSettingsForm
        brokerSlug={brokerSlug}
        hours={settings.booking_hours}
        blackouts={blackouts}
        timeZone={timeZone}
      />
    </div>
  )
}
