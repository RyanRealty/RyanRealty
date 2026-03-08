import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getActiveBrokers } from '../actions/brokers'
import { getBrokerageSettings } from '../actions/brokerage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const brokerage = await getBrokerageSettings()
  const name = brokerage?.name ?? 'Ryan Realty'
  return {
    title: 'Our Team',
    description: `Meet the brokers at ${name} — your Central Oregon real estate experts.`,
  }
}

export default async function TeamPage() {
  const [brokers, brokerage] = await Promise.all([getActiveBrokers(), getBrokerageSettings()])
  const brokerageName = brokerage?.name ?? 'Ryan Realty'

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Our Team</h1>
      <p className="mt-2 text-zinc-600">
        Meet the brokers at {brokerageName}. We&apos;re here to help you find or sell your next home in Central Oregon.
      </p>
      {brokers.length === 0 ? (
        <p className="mt-8 text-zinc-500">Team profiles are being updated. Check back soon.</p>
      ) : (
        <ul className="mt-10 grid gap-8 sm:grid-cols-2">
          {brokers.map((broker) => (
            <li key={broker.id}>
              <Link
                href={`/team/${broker.slug}`}
                className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                  {broker.photo_url ? (
                    <Image
                      src={broker.photo_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-zinc-400">
                      {broker.display_name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-zinc-900">{broker.display_name}</span>
                  {broker.title && (
                    <p className="mt-0.5 text-sm text-zinc-600">{broker.title}</p>
                  )}
                  <span className="mt-2 inline-block text-sm font-medium text-emerald-600">View profile →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
