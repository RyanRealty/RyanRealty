'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { submitExpiredLPForm } from './actions'

export default function ExpiredLPForm() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function onSubmit(formData: FormData) {
    const submission = {
      name: formData.get('name')?.toString() ?? '',
      email: formData.get('email')?.toString() ?? '',
      phone: formData.get('phone')?.toString() ?? '',
      address: formData.get('address')?.toString() ?? '',
      contactPath: (formData.get('contactPath')?.toString() || 'audit') as 'audit' | 'phone' | 'walkthrough',
      notes: formData.get('notes')?.toString() ?? '',
    }
    startTransition(async () => {
      const r = await submitExpiredLPForm(submission)
      if (r.success) {
        setResult({
          ok: true,
          msg: "Got it. We'll have the written audit in your inbox within the business day, or a quick call back if you picked that. No pitch coming.",
        })
      } else {
        setResult({ ok: false, msg: r.error })
      }
    })
  }

  if (result?.ok) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-lg font-semibold">Thanks.</p>
        <p className="mt-2 text-muted-foreground">{result.msg}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Or call us right now:{' '}
          <a href="tel:+15417033095" className="text-primary underline">
            (541) 703-3095
          </a>
        </p>
      </div>
    )
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required placeholder="Jane Smith" />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" placeholder="541.xxx.xxxx" />
        </div>
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="you@example.com" />
      </div>
      <div>
        <Label htmlFor="address">Property address that expired</Label>
        <Input id="address" name="address" placeholder="1234 NW Bend Ave, Bend, OR 97703" />
      </div>
      <div>
        <Label htmlFor="contactPath">How would you like us to start?</Label>
        <Select name="contactPath" defaultValue="audit">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="audit">Send me a free written audit of my prior listing</SelectItem>
            <SelectItem value="phone">Call me — 20-minute conversation, no pitch</SelectItem>
            <SelectItem value="walkthrough">Come walk the property with me in person</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="notes">Anything specific you want us to know?</Label>
        <Textarea id="notes" name="notes" rows={3} placeholder="What went wrong, what's changed, what you're considering" />
      </div>
      {result?.ok === false && (
        <p className="text-sm text-destructive">{result.msg}</p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Sending…' : 'Get my audit'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        No commitment. You get the audit either way.
      </p>
    </form>
  )
}
