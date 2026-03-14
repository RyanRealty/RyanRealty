import Link from 'next/link'
import { getReportCities } from '@/app/actions/reports'
import CustomReportBuilder from './CustomReportBuilder'

export default async function AdminCustomReportPage() {
  const { cities } = await getReportCities()
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/admin/reports" className="hover:text-primary">Reports</Link>
        <span className="mx-2">/</span>
        <span className="text-primary">Custom report builder</span>
      </nav>
      <h1 className="text-2xl font-bold text-primary">Custom report builder</h1>
      <p className="mt-2 text-muted-foreground">
        Build a report for any location and any date range. Choose what data to include: summary metrics, price bands, time series, and pending/closed sales. No presets — select city, optional subdivision, and exact start and end dates.
      </p>
      <CustomReportBuilder cities={cities} />
      <p className="mt-10 text-sm text-muted-foreground">
        <Link href="/admin/reports" className="underline hover:no-underline">Back to Reports</Link>
      </p>
    </main>
  )
}
