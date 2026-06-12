/**
 * Stage badge with semantic color — one glance tells temperature:
 * red = act now, yellow = active/working, green = won/healthy,
 * neutral = parked or administrative.
 */
import { Badge } from '@/components/ui/badge'

const STAGE_CLASS: Record<string, string> = {
  'Lead': 'border-warning/50 bg-warning/15 text-foreground',
  'Seller Prospect': 'border-warning/50 bg-warning/15 text-foreground',
  'A - Hot 1-3 Months': 'border-destructive/40 bg-destructive/10 text-destructive',
  'B - Warm 3-6 Months': 'border-warning/50 bg-warning/15 text-foreground',
  'C - Cold 6+ Months': 'border-border bg-muted text-muted-foreground',
  'Renter - future buyer': 'border-border bg-muted text-muted-foreground',
  'Active Client': 'border-success/40 bg-success/10 text-success',
  'Pending': 'border-warning/50 bg-warning/15 text-foreground',
  'Past Client': 'border-success/30 bg-success/5 text-muted-foreground',
  'Sphere': 'border-border bg-muted text-muted-foreground',
  'Nurture': 'border-border bg-muted text-muted-foreground',
  'Closed': 'border-success/40 bg-success/10 text-success',
  'Archive': 'border-border bg-muted text-muted-foreground',
  'Real Estate Agent': 'border-border bg-muted text-muted-foreground',
  'Vendor': 'border-border bg-muted text-muted-foreground',
  'Trash': 'border-border bg-muted text-muted-foreground',
}

export default function StageBadge({ stage, className }: { stage: string; className?: string }) {
  return (
    <Badge variant="outline" className={`${STAGE_CLASS[stage] ?? 'border-border bg-muted text-muted-foreground'} ${className ?? ''}`}>
      {stage}
    </Badge>
  )
}
