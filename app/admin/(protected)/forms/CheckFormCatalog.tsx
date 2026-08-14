'use client'

// @no-parity — internal admin tool (form-library catalog check)
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, SectionHead, TextAreaField } from '@/components/admin/v2'
import { applyFormCatalogJson } from '@/app/actions/tc-form-catalog'

const tiny = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' } as const

export function CheckFormCatalog({ script }: { script: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [catalogJson, setCatalogJson] = useState('')

  function copyScript() {
    if (!script) return
    startTransition(async () => {
      try {
        await navigator.clipboard.writeText(script)
        toast.success('Check script copied. Paste it in the SkySlope Forms console.')
      } catch {
        toast.error('Could not copy. Select the script and copy it yourself.')
      }
    })
  }

  function apply() {
    const text = catalogJson.trim()
    if (!text) {
      toast.error('Paste the catalog JSON from the check script first.')
      return
    }
    startTransition(async () => {
      const { data, error } = await applyFormCatalogJson(text)
      if (error || !data) {
        toast.error(error ?? 'Could not apply the catalog.')
        return
      }
      const parts = data.libraries.slice(0, 6).map(
        (l) =>
          `${l.libraryCode}: ${l.updated} updated, ${l.new} new, ${l.retired} retired, ${l.current} current`,
      )
      toast.success(parts.join(' · '))
      setCatalogJson('')
      router.refresh()
    })
  }

  return (
    <section aria-label="Check form libraries" style={{ margin: '0 0 20px' }}>
      <SectionHead>Check OREF, Oregon Data Share, and Oregon Realtors</SectionHead>
      <p style={{ ...tiny, margin: '4px 0 10px', maxWidth: 720 }}>
        SkySlope holds the licensed catalogs. This check lists current published
        forms only (no PDF download) and compares them to what we hold. Open
        Forms in the signed-in Mac Mini Chrome, paste the script in the console,
        then paste the copied JSON here. New and revised forms still need the
        blank ingest to become fillable.
      </p>
      <TextAreaField
        label="Check script"
        hint="Runs only on forms.skyslope.com. It never sends a SkySlope token to us."
        value={script}
        readOnly
        rows={6}
        spellCheck={false}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 12px' }}>
        <Button variant="quiet" onClick={copyScript} disabled={pending || !script} touch>
          Copy check script
        </Button>
      </div>
      <TextAreaField
        label="Catalog JSON"
        hint="Paste the script output. One library or all three."
        value={catalogJson}
        onChange={(e) => setCatalogJson(e.target.value)}
        rows={6}
        spellCheck={false}
        placeholder='{"libraries":[{"libraryCode":"OREF","forms":[...]}]}'
      />
      <div style={{ marginTop: 8 }}>
        <Button onClick={apply} disabled={pending || !catalogJson.trim()} touch>
          {pending ? 'Applying…' : 'Apply catalog'}
        </Button>
      </div>
    </section>
  )
}
