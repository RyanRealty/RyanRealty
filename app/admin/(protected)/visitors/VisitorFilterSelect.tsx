'use client'

// 11D: the identified/anonymous facet as ONE compact control
// (ADMIN_UI.md §3 acceptance-bar rule 2). It replaces three shadcn tab links
// whose hrefs were `?filter=all`, `?filter=anonymous`, `?filter=identified`
// with `replace` — router.replace on the same three values keeps both the
// query string and the history semantics byte-for-byte.
//
// P7 identity loop (2026-09-23): a fourth value, `people`, turns the page into
// the known-contact activity view (one row per identified person, with the
// pages they viewed), and a window control (last 1 / 7 / 30 days) appears with it.
import { usePathname, useRouter } from 'next/navigation'
import { SelectField } from '@/components/admin/v2'

export type VisitorFilter = 'all' | 'anonymous' | 'identified' | 'people'

export default function VisitorFilterSelect({
  filter,
  days = 7,
}: {
  filter: VisitorFilter
  days?: 1 | 7 | 30
}) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="flex flex-wrap gap-3">
      <div style={{ minWidth: 200 }}>
        <SelectField
          label="Show"
          value={filter}
          onChange={(e) =>
            router.replace(
              e.target.value === 'people'
                ? `${pathname}?filter=people&days=${days}`
                : `${pathname}?filter=${e.target.value}`,
            )
          }
        >
          <option value="people">Known people</option>
          <option value="all">All sessions</option>
          <option value="anonymous">Anonymous sessions</option>
          <option value="identified">Identified sessions</option>
        </SelectField>
      </div>
      {filter === 'people' ? (
        <div style={{ minWidth: 160 }}>
          <SelectField
            label="Active in"
            value={String(days)}
            onChange={(e) => router.replace(`${pathname}?filter=people&days=${e.target.value}`)}
          >
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </SelectField>
        </div>
      ) : null}
    </div>
  )
}
