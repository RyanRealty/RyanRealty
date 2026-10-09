import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StepChannelBody } from './step-config-body-bits'

// The text step card names the hours texts actually go out: 8am to the 7:55pm
// pause, inside Oregon's 8am to 8pm (ORS 646.563, lib/crm/quiet-hours). It said
// 9pm after the rule moved, and 8pm before the five-minute pause (2026-09-25).
describe('StepChannelBody, text step', () => {
  it('says texts send between 8:00 am and the 7:55 pm pause PT', () => {
    const html = renderToStaticMarkup(
      <StepChannelBody
        step={{ channel: 'sms' }}
        disabled={false}
        patch={() => {}}
        options={{ templates: [], tags: [], stages: [], brokers: [], sequences: [] }}
        waitField={null}
        templatePicker={null}
        deleteBlock={null}
      />,
    )
    expect(html).toContain('between 8:00 am and 7:55 pm PT')
    expect(html).toContain('before Oregon&#x27;s 8pm cutoff')
    // Matt 2026-10-04, "Both zones": the lead's own zone holds a text too.
    expect(html).toContain('on the lead&#x27;s own clock (their area code&#x27;s time zone)')
    expect(html).not.toContain('9:00 pm')
  })
})
