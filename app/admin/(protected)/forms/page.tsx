// @no-parity — internal admin tool (TC forms library browser), no public mockup contract
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getTcFormLibraries } from '@/app/actions/tc-forms'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ q?: string; lib?: string }> }

// Default forms shown per library before "See all" — curate, never dump.
const PREVIEW_COUNT = 6

export default async function TcFormsPage({ searchParams }: Props) {
  const { q, lib: expanded } = await searchParams
  const libraries = await getTcFormLibraries(q)

  const populated = libraries.filter((l) => l.forms.length > 0)
  const total = libraries.reduce((s, l) => s + l.forms.length, 0)
  const sampleCount = libraries.reduce((s, l) => s + l.forms.filter((f) => f.isSample).length, 0)
  const productionCount = total - sampleCount

  const buildLibHref = (code: string | null) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (code) sp.set('lib', code)
    const qs = sp.toString()
    return `/admin/forms${qs ? `?${qs}` : ''}`
  }

  return (
    <main className="space-y-4 sm:space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Forms library</h1>
        <p className="text-sm text-muted-foreground">
          Verified TC templates. Envelopes are composed from these blanks only.
        </p>
      </header>

      {/* Glanceable summary — summary before detail */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-0.5 p-4 tabular-nums">
            <p className="text-2xl font-bold text-foreground">{total}</p>
            <p className="text-xs text-muted-foreground">form versions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-0.5 p-4 tabular-nums">
            <p className="text-2xl font-bold text-success">{productionCount}</p>
            <p className="text-xs text-muted-foreground">production</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-0.5 p-4 tabular-nums">
            <p className="text-2xl font-bold text-foreground">{sampleCount}</p>
            <p className="text-xs text-muted-foreground">OREF samples</p>
          </CardContent>
        </Card>
      </div>

      <form method="GET" className="flex max-w-md gap-2">
        <Input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search form number or name…"
          aria-label="Search forms"
          className="h-11"
        />
        <Button type="submit" variant="secondary" className="h-11 px-5">
          Search
        </Button>
      </form>

      {populated.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <p className="text-base font-medium text-foreground">
              {q ? 'No forms match that search' : 'No forms loaded yet'}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {q
                ? 'Try a different form number or name.'
                : 'Verified blanks appear here once the TC library is loaded.'}
            </p>
            {q ? (
              <Button asChild variant="secondary" className="mt-1 h-11 px-5">
                <Link href="/admin/forms">Clear search</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        populated.map((library) => {
          const isExpanded = expanded === library.code
          const visible = isExpanded ? library.forms : library.forms.slice(0, PREVIEW_COUNT)
          const hiddenCount = library.forms.length - visible.length

          return (
            <Card key={library.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-baseline gap-2 text-base">
                  {library.code}
                  <span className="text-sm font-normal text-muted-foreground">
                    {library.name} ·{' '}
                    <span className="tabular-nums">{library.forms.length}</span> forms
                  </span>
                </CardTitle>
                {library.license_note ? (
                  <p className="text-xs text-muted-foreground">{library.license_note}</p>
                ) : null}
              </CardHeader>
              <CardContent>
                {/* Form cards — phones (one tap to open the blank) */}
                <div className="space-y-2 md:hidden">
                  {visible.map((f) => (
                    <div key={f.id} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium tabular-nums text-foreground">
                            {f.form_number ?? '—'}
                          </div>
                          <p className="truncate text-sm text-muted-foreground" title={f.name}>
                            {f.name.replace(/\s*\(SAMPLE.*\)$/i, '')}
                          </p>
                        </div>
                        {f.isSample ? (
                          <Badge className="shrink-0 bg-warning/20 text-foreground hover:bg-warning/20">
                            Sample
                          </Badge>
                        ) : (
                          <Badge className="shrink-0 bg-success/15 text-success hover:bg-success/15">
                            Production
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="tabular-nums">{f.page_count ?? '—'} pages</span>
                        <span className="tabular-nums">
                          {f.fieldCount > 0
                            ? `${f.fieldCount} fields (${f.signatureFieldCount} sig)`
                            : 'not mapped yet'}
                        </span>
                        {f.signer_profile ? (
                          <Badge variant="outline">
                            {f.signer_profile === 'single_party' ? 'One side' : 'Both sides'}
                          </Badge>
                        ) : null}
                      </div>
                      {f.blankUrl ? (
                        <Button asChild variant="secondary" className="mt-3 h-11 w-full">
                          <a href={f.blankUrl} target="_blank" rel="noopener noreferrer">
                            Open blank
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  ))}

                  {hiddenCount > 0 ? (
                    <Button asChild variant="ghost" className="h-11 w-full">
                      <Link href={buildLibHref(library.code)}>
                        See all {library.forms.length} forms →
                      </Link>
                    </Button>
                  ) : isExpanded && library.forms.length > PREVIEW_COUNT ? (
                    <Button asChild variant="ghost" className="h-11 w-full">
                      <Link href={buildLibHref(null)}>Show less</Link>
                    </Button>
                  ) : null}
                </div>

                {/* Form table — desktop */}
                <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Form #</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-20">Pages</TableHead>
                        <TableHead className="w-32">Fields</TableHead>
                        <TableHead className="w-28">Signers</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead className="w-28 text-right">Blank</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium tabular-nums text-foreground">
                            {f.form_number ?? '—'}
                          </TableCell>
                          <TableCell className="max-w-md">
                            <p className="truncate" title={f.name}>
                              {f.name.replace(/\s*\(SAMPLE.*\)$/i, '')}
                            </p>
                          </TableCell>
                          <TableCell className="tabular-nums">{f.page_count ?? '—'}</TableCell>
                          <TableCell className="tabular-nums">
                            {f.fieldCount > 0
                              ? `${f.fieldCount} (${f.signatureFieldCount} sig)`
                              : 'not mapped yet'}
                          </TableCell>
                          <TableCell>
                            {f.signer_profile ? (
                              <Badge variant="outline">
                                {f.signer_profile === 'single_party' ? 'One side' : 'Both sides'}
                              </Badge>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            {f.isSample ? (
                              <Badge className="bg-warning/20 text-foreground hover:bg-warning/20">
                                Sample
                              </Badge>
                            ) : (
                              <Badge className="bg-success/15 text-success hover:bg-success/15">
                                Production
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {f.blankUrl ? (
                              <a
                                href={f.blankUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm underline underline-offset-2"
                              >
                                Open
                              </a>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {hiddenCount > 0 ? (
                    <div className="border-t border-border bg-muted/30 px-3 py-2 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={buildLibHref(library.code)}>
                          See all {library.forms.length} forms →
                        </Link>
                      </Button>
                    </div>
                  ) : isExpanded && library.forms.length > PREVIEW_COUNT ? (
                    <div className="border-t border-border bg-muted/30 px-3 py-2 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={buildLibHref(null)}>Show less</Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )
        })
      )}

      <p className="text-xs text-muted-foreground">
        Field maps (data bindings + signature spots with signer roles) get placed once per form
        version and QA&apos;d — envelopes never invent field positions. Composer ships next; see
        docs/TC_SYSTEM.md.
      </p>
    </main>
  )
}
