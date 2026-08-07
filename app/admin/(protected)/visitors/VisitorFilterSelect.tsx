'use client'

// 11D: the identified/anonymous facet as ONE compact control
// (ADMIN_UI.md §3 acceptance-bar rule 2). It replaces three shadcn tab links
// whose hrefs were `?filter=all`, `?filter=anonymous`, `?filter=identified`
// with `replace` — router.replace on the same three values keeps both the
// query string and the history semantics byte-for-byte.
import { usePathname, useRouter } from 'next/navigation'
import { SelectField } from '@/components/admin/v2'

export default function VisitorFilterSelect({
  filter,
}: {
  filter: 'all' | 'anonymous' | 'identified'
}) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <SelectField
      label="Show"
      value={filter}
      onChange={(e) => router.replace(`${pathname}?filter=${e.target.value}`)}
    >
      <option value="all">All</option>
      <option value="anonymous">Anonymous</option>
      <option value="identified">Identified</option>
    </SelectField>
  )
}
