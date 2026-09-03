import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3Sheet } from '@/components/site/v3'
import { CONTACT_FIELD_IDS } from './contact-constants'

const ASK_FILE = join(process.cwd(), 'app/contact/_v3/ContactAsk.client.tsx')

describe('contact field locators', () => {
  it('assigns one unique id per contact control', () => {
    const ids = Object.values(CONTACT_FIELD_IDS)
    expect(ids).toEqual(['contact-name', 'contact-email', 'contact-phone', 'contact-message'])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ContactAsk wires each stable id once', () => {
    const src = readFileSync(ASK_FILE, 'utf8')
    for (const key of Object.keys(CONTACT_FIELD_IDS) as (keyof typeof CONTACT_FIELD_IDS)[]) {
      const needle = `id: CONTACT_FIELD_IDS.${key}`
      expect(src.split(needle).length - 1, needle).toBe(1)
    }
    expect(src).not.toContain("id: 'contact-email'")
  })

  it('keeps one-screen V3Ask and pads the consent checkbox on this route', () => {
    const src = readFileSync(ASK_FILE, 'utf8')
    expect(src).toContain('<V3Ask')
    expect(src).toContain('className="contact-ask"')
    expect(src).toContain("from '../actions'")
    expect(src).not.toContain('V3Sheet')
    const css = readFileSync(join(process.cwd(), 'app/contact/_v3/contact-ask.css'), 'utf8')
    expect(css).toContain('var(--v3-tap)')
    expect(css).not.toMatch(/SMS_CONSENT_TEXT|By checking this box/)
  })

  it('V3Sheet honors field.id so #contact-email is unique', () => {
    const markup = renderToStaticMarkup(
      createElement(V3Sheet, {
        heading: 'Send a message',
        steps: [
          {
            id: 'email',
            label: 'Where should the answer go?',
            field: {
              id: CONTACT_FIELD_IDS.email,
              kind: 'email',
              name: 'email',
              label: 'Email',
              required: true,
            },
            advanceLabel: 'Continue',
          },
        ],
      }),
    )
    expect(markup.match(/id="contact-email"/g)).toEqual(['id="contact-email"'])
    expect(markup).toContain('type="email"')
    expect(markup).toMatch(/id="contact-email"[^>]*\brequired\b/)
  })
})
