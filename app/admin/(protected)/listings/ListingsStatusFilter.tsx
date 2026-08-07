'use client'

// 11D: the status facet as ONE compact control (ADMIN_UI.md §3 acceptance-bar
// rule 2 — a filter set is a dropdown, never a row of pills). It rebuilds the
// exact URL the four facet links built before: `status` only when a real status
// is chosen, `search` carried through, `page` and `remarks` dropped so a status
// change resets to page 0 and leaves remarks mode, and a bare /admin/listings
// when neither param survives.
import { useRouter } from 'next/navigation'
import { SelectField } from '@/components/admin/v2'

export default function ListingsStatusFilter({
  status,
  search,
  options,
}: {
  status: string | undefined
  search: string | undefined
  options: readonly string[]
}) {
  const router = useRouter()

  return (
    <SelectField
      label="Status"
      value={status ?? ''}
      onChange={(e) => {
        const next = e.target.value
        const params = new URLSearchParams()
        if (next) params.set('status', next)
        if (search) params.set('search', search)
        const qs = params.toString()
        router.push(qs ? `/admin/listings?${qs}` : '/admin/listings')
      }}
    >
      <option value="">All statuses</option>
      {options.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </SelectField>
  )
}
