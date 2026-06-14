// @no-parity — internal admin tool (TC forms library browser), no public mockup contract
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

type Props = { searchParams: Promise<{ q?: string }> }

export default async function TcFormsPage({ searchParams }: Props) {
  const { q } = await searchParams
  const libraries = await getTcFormLibraries(q)
  const total = libraries.reduce((s, l) => s + l.forms.length, 0)
  const sampleCount = libraries.reduce((s, l) => s + l.forms.filter((f) => f.isSample).length, 0)

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Forms library</h1>
        <p className="text-sm text-muted-foreground">
          {total} form versions across {libraries.filter((l) => l.forms.length).length} libraries.
          {sampleCount > 0
            ? ` ${sampleCount} are OREF review samples — production blanks supersede them automatically when loaded.`
            : null}{' '}
          Envelopes are composed from these verified templates only.
        </p>
      </header>

      <form method="GET" className="flex max-w-md gap-2">
        <Input name="q" defaultValue={q ?? ''} placeholder="Search form number or name…" aria-label="Search forms" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {libraries
        .filter((l) => l.forms.length > 0)
        .map((lib) => (
          <Card key={lib.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-baseline gap-2 text-base">
                {lib.code}
                <span className="text-sm font-normal text-muted-foreground">
                  {lib.name} · {lib.forms.length} forms
                </span>
              </CardTitle>
              {lib.license_note ? (
                <p className="text-xs text-muted-foreground">{lib.license_note}</p>
              ) : null}
            </CardHeader>
            <CardContent>
              {/* Form cards — phones (one tap to open the blank) */}
              <div className="space-y-2 md:hidden">
                {lib.forms.map((f) => (
                  <div key={f.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium tabular-nums text-foreground">{f.form_number ?? '—'}</div>
                        <p className="truncate text-sm text-muted-foreground" title={f.name}>
                          {f.name.replace(/\s*\(SAMPLE.*\)$/i, '')}
                        </p>
                      </div>
                      {f.isSample ? (
                        <Badge className="shrink-0 bg-warning/20 text-foreground hover:bg-warning/20">Sample</Badge>
                      ) : (
                        <Badge className="shrink-0 bg-success/15 text-success hover:bg-success/15">Production</Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="tabular-nums">{f.page_count ?? '—'} pages</span>
                      <span className="tabular-nums">
                        {f.fieldCount > 0 ? `${f.fieldCount} fields (${f.signatureFieldCount} sig)` : 'not mapped yet'}
                      </span>
                      {f.signer_profile ? (
                        <Badge variant="outline">{f.signer_profile === 'single_party' ? 'One side' : 'Both sides'}</Badge>
                      ) : null}
                    </div>
                    {f.blankUrl ? (
                      <a
                        href={f.blankUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-sm underline underline-offset-2"
                      >
                        Open blank
                      </a>
                    ) : null}
                  </div>
                ))}
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
                    {lib.forms.map((f) => (
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
                          {f.fieldCount > 0 ? `${f.fieldCount} (${f.signatureFieldCount} sig)` : 'not mapped yet'}
                        </TableCell>
                        <TableCell>
                          {f.signer_profile ? (
                            <Badge variant="outline">{f.signer_profile === 'single_party' ? 'One side' : 'Both sides'}</Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {f.isSample ? (
                            <Badge className="bg-warning/20 text-foreground hover:bg-warning/20">Sample</Badge>
                          ) : (
                            <Badge className="bg-success/15 text-success hover:bg-success/15">Production</Badge>
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
              </div>
            </CardContent>
          </Card>
        ))}

      <p className="text-xs text-muted-foreground">
        Field maps (data bindings + signature spots with signer roles) get placed once per form version and
        QA&apos;d — envelopes never invent field positions. Composer ships next; see docs/TC_SYSTEM.md.
      </p>
    </main>
  )
}
