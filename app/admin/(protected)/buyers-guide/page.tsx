/**
 * Admin queue for buyer's-guide PDFs.
 *
 * Lists every community guide currently registered under
 * `public/guides/<slug>/` with its last-generated timestamp, file size,
 * and freshness status. Superuser-only.
 *
 * Spec: marketing_brain_skills/producers/buyers-guide/SKILL.md §4.3 Step 6.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { redirect } from 'next/navigation'

import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import type { BuyersGuideManifest } from '@/lib/buyers-guide/types'

export const dynamic = 'force-dynamic'

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

type GuideEntry = {
  slug: string
  pdfPath: string | null
  sizeBytes: number | null
  pages?: number
  generatedAt: string | null
  stale: boolean
}

async function listGuides(): Promise<GuideEntry[]> {
  const dir = path.join(process.cwd(), 'public', 'guides')
  let slugs: string[]
  try {
    const dirents = await readdir(dir, { withFileTypes: true })
    slugs = dirents.filter((d) => d.isDirectory()).map((d) => d.name)
  } catch {
    return []
  }
  const out: GuideEntry[] = []
  for (const slug of slugs) {
    const pdfPath = path.join(dir, slug, `${slug}-buyers-guide.pdf`)
    const manifestPath = path.join(dir, slug, 'manifest.json')

    let sizeBytes: number | null = null
    let pdfExists = false
    try {
      const s = await stat(pdfPath)
      sizeBytes = s.size
      pdfExists = true
    } catch {
      pdfExists = false
    }

    let manifest: BuyersGuideManifest | null = null
    try {
      const raw = await readFile(manifestPath, 'utf8')
      manifest = JSON.parse(raw) as BuyersGuideManifest
    } catch {
      manifest = null
    }

    const generatedAt = manifest?.generatedAt ?? null
    const generatedMs = generatedAt ? Date.parse(generatedAt) : NaN
    const stale = !Number.isFinite(generatedMs) || Date.now() - generatedMs > STALE_THRESHOLD_MS

    out.push({
      slug,
      pdfPath: pdfExists ? `/guides/${slug}/${slug}-buyers-guide.pdf` : null,
      sizeBytes,
      pages: manifest?.pages,
      generatedAt,
      stale,
    })
  }
  return out
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function formatBytes(n: number | null): string {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export default async function BuyersGuideAdminPage() {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (adminRole?.role !== 'superuser') {
    redirect('/admin/access-denied')
  }

  const guides = await listGuides()
  const total = guides.length
  const fresh = guides.filter((g) => g.pdfPath && !g.stale).length
  const staleCount = guides.filter((g) => g.pdfPath && g.stale).length
  const missing = guides.filter((g) => !g.pdfPath).length

  return (
    <main className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Buyers&apos; guides</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-community PDF guides. Web version at{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/lp/&lt;community&gt;/buyers-guide/</code>{' '}
          ISR-revalidates every 6h; PDF regenerates weekly via cron
          (Sunday 3am PT) or on-demand when a visitor requests a stale guide.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total guides
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Fresh (≤ 7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{fresh}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Stale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{staleCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Missing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{missing}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Community</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead className="text-right tabular-nums">Size</TableHead>
                <TableHead className="text-right tabular-nums">Pages</TableHead>
                <TableHead className="text-right tabular-nums">Generated at</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guides.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No guides yet. Run the PDF generator: <code>node scripts/buyers-guide/generate-pdf.mjs --community &lt;slug&gt;</code>
                  </TableCell>
                </TableRow>
              ) : (
                guides.map((g) => (
                  <TableRow key={g.slug}>
                    <TableCell className="font-medium">{g.slug}</TableCell>
                    <TableCell>
                      {g.pdfPath ? (
                        <a href={g.pdfPath} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                          {g.slug}-buyers-guide.pdf
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Not generated</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatBytes(g.sizeBytes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {g.pages ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatDate(g.generatedAt)}
                    </TableCell>
                    <TableCell>
                      {!g.pdfPath ? (
                        <Badge variant="outline">Missing</Badge>
                      ) : g.stale ? (
                        <Badge className="bg-warning text-warning-foreground">Stale</Badge>
                      ) : (
                        <Badge className="bg-success text-success-foreground">Fresh</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  )
}
