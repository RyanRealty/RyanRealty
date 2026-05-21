'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

export function FunnelVariantFilter({ variants, current }: { variants: string[]; current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const onChange = (v: string) => {
    const next = new URLSearchParams(params.toString())
    if (v === 'all') next.delete('lpVariant')
    else next.set('lpVariant', v)
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Filter by LP variant</Label>
      <Select value={current || 'all'} onValueChange={onChange}>
        <SelectTrigger className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All variants (combined)</SelectItem>
          {variants.map((v) => (
            <SelectItem key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
