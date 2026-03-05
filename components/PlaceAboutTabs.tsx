'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getSectionImageAttractions } from '../lib/section-images'
import {
  generateSubdivisionDescription,
  generateSubdivisionAttractions,
} from '../app/actions/subdivision-descriptions'

export type PlaceAttractionItem = {
  id: string
  name: string
  phone: string | null
  description: string | null
  is_coming: boolean
  sort_order: number
}

export type PlaceAboutTabsProps = {
  /** About tab: combined description + demographics + famous for (paragraphs separated by \n\n) */
  aboutText: string
  attractionsText: string | null
  /** Structured attractions with phone numbers and coming events (when populated) */
  attractionsList?: PlaceAttractionItem[]
  /** Not used in About tab (we use a different image so hero and about differ). Kept for future use. */
  bannerUrl: string | null
  /** Display name for alt text */
  displayName: string
  /** When subdivision page: city and subdivision name for Generate actions */
  city?: string
  subdivisionName?: string | null
  hasAbout: boolean
  hasAttractions: boolean
}

const sectionImageAttractions = getSectionImageAttractions()

export default function PlaceAboutTabs({
  aboutText,
  attractionsText,
  attractionsList = [],
  bannerUrl,
  displayName,
  city,
  subdivisionName,
  hasAbout,
  hasAttractions,
}: PlaceAboutTabsProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'about' | 'attractions'>('about')
  const [loadingTab, setLoadingTab] = useState<'about' | 'attractions' | null>(null)

  const canGenerate = Boolean(city && subdivisionName)

  const tabs: { id: 'about' | 'attractions'; label: string }[] = [
    { id: 'about', label: 'About' },
    { id: 'attractions', label: 'Attractions' },
  ]

  async function handleGenerate(tab: 'about' | 'attractions') {
    if (!canGenerate || !city || !subdivisionName) return
    setLoadingTab(tab)
    try {
      const action = tab === 'about' ? generateSubdivisionDescription : generateSubdivisionAttractions
      const result = await action(city, subdivisionName)
      if (result.ok) router.refresh()
    } finally {
      setLoadingTab(null)
    }
  }

  /* About tab: dedicated image (not hero) so section feels distinct. Two-column: image left, text right. */
  const aboutImageUrl = sectionImageAttractions

  return (
    <section className="mb-10 rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-zinc-200 bg-zinc-50/80">
        <nav className="flex gap-1 p-2" aria-label="About this area">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                activeTab === id
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:bg-white/60 hover:text-zinc-900'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {activeTab === 'about' && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)]">
            {aboutImageUrl && (
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100 sm:aspect-[3/4]">
                <Image
                  src={aboutImageUrl}
                  alt={`${displayName} – area overview`}
                  width={600}
                  height={450}
                  className="h-full w-full object-cover"
                  sizes="(max-width: 640px) 100vw, 40vw"
                />
              </div>
            )}
            <div className="min-w-0">
              {hasAbout ? (
                <div className="text-zinc-600 leading-relaxed space-y-3">
                  {aboutText.split(/\n\n+/).map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              ) : canGenerate ? (
                <div>
                  <p className="text-sm text-zinc-500 mb-3">No about content yet.</p>
                  <button
                    type="button"
                    onClick={() => handleGenerate('about')}
                    disabled={loadingTab === 'about'}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
                  >
                    {loadingTab === 'about' ? 'Generating…' : 'Generate about'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === 'attractions' && (
          <div className="space-y-4">
            <div className="relative -mx-6 -mt-2 mb-4 overflow-hidden rounded-lg">
              <Image
                src={sectionImageAttractions}
                alt="Things to do and attractions"
                width={1200}
                height={336}
                className="h-40 w-full object-cover sm:h-48"
                sizes="100vw"
              />
            </div>
            {attractionsList.length > 0 ? (
              <ul className="space-y-4">
                {attractionsList.map((a) => (
                  <li key={a.id} className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-900">{a.name}</span>
                      {a.is_coming && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Coming
                        </span>
                      )}
                    </div>
                    {a.phone && (
                      <p className="mt-1 text-sm">
                        <a href={`tel:${a.phone.replace(/\D/g, '')}`} className="text-emerald-600 hover:underline">
                          {a.phone}
                        </a>
                      </p>
                    )}
                    {a.description && (
                      <p className="mt-1 text-sm text-zinc-600">{a.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : hasAttractions ? (
              <p className="text-zinc-600 leading-relaxed">{attractionsText}</p>
            ) : canGenerate ? (
              <div>
                <p className="text-sm text-zinc-500 mb-3">No attractions content yet.</p>
                <button
                  type="button"
                  onClick={() => handleGenerate('attractions')}
                  disabled={loadingTab === 'attractions'}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
                >
                  {loadingTab === 'attractions' ? 'Generating…' : 'Generate attractions'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No attractions content for this area yet.</p>
            )}
          </div>
        )}

      </div>
    </section>
  )
}
