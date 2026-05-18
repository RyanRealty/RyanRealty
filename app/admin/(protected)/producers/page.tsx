import { Suspense } from 'react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getAllProducers,
  getUniqueCategories,
  getUniqueStatuses,
  getUniqueOutputTypes,
  getUniquePlatforms,
} from '@/lib/producer-catalog'
import { ProducerCard } from './_components/ProducerCard'
import { ProducerFilterSidebar } from './_components/ProducerFilterSidebar'

export const metadata = { title: 'Producer Catalog | Admin' }

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>
}

function getParam(params: Record<string, string | string[]>, key: string): string[] {
  const v = params[key]
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

export default async function ProducerCatalogPage({ searchParams }: PageProps) {
  const params = await searchParams

  const q = String(params['q'] ?? '').toLowerCase().trim()
  const filterCats = getParam(params, 'cat')
  const filterStatuses = getParam(params, 'status')
  const filterTypes = getParam(params, 'type')
  const filterPlatforms = getParam(params, 'platform')

  const allProducers = getAllProducers()

  const filtered = allProducers.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
      return false
    }
    if (filterCats.length > 0 && !filterCats.includes(p.sectionLabel)) return false
    if (filterStatuses.length > 0 && !filterStatuses.includes(p.status)) return false
    if (filterTypes.length > 0 && !filterTypes.includes(p.outputType)) return false
    if (filterPlatforms.length > 0 && !filterPlatforms.some((pl) => p.targetPlatforms.includes(pl))) {
      return false
    }
    return true
  })

  const categories = getUniqueCategories()
  const statuses = getUniqueStatuses()
  const outputTypes = getUniqueOutputTypes()
  const platforms = getUniquePlatforms()

  // Group by section for display
  const sections = [...new Set(filtered.map((p) => p.sectionLabel))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Producer catalog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {allProducers.length} producers across Sections A through I. Click a card to view the
          full SKILL.md and request changes.
        </p>
      </div>

      {/* Search */}
      <form method="GET" action="/admin/producers" className="max-w-sm">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search producers..."
          aria-label="Search producers"
        />
      </form>

      <div className="flex gap-8">
        {/* Filter sidebar */}
        <Suspense fallback={<Skeleton className="h-64 w-56" />}>
          <ProducerFilterSidebar
            categories={categories}
            statuses={statuses}
            outputTypes={outputTypes}
            platforms={platforms}
          />
        </Suspense>

        {/* Grid */}
        <div className="min-w-0 flex-1">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-card py-16 text-center text-muted-foreground">
              No producers match the current filters.
            </div>
          ) : (
            <div className="space-y-8">
              {sections.map((sectionLabel) => {
                const sectionProducers = filtered.filter((p) => p.sectionLabel === sectionLabel)
                return (
                  <div key={sectionLabel}>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {sectionLabel}
                      <span className="ml-2 font-normal normal-case">
                        ({sectionProducers.length})
                      </span>
                    </h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {sectionProducers.map((p) => (
                        <ProducerCard key={p.slug} producer={p} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
