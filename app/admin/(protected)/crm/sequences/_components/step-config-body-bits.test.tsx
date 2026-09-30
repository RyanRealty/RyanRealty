import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StepChannelBody } from './step-config-body-bits'

// The text step card names the hours texts actually go out: Oregon's 8am to
// 8pm (ORS 646.563, lib/crm/quiet-hours). It said 9pm after the rule moved.
describe('StepChannelBody, text step', () => {
  it('says texts send between 8:00 am and 8:00 pm PT', () => {
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
    expect(html).toContain('between 8:00 am and 8:00 pm PT')
    expect(html).not.toContain('9:00 pm')
  })
})
