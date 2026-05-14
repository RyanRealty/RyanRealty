#!/usr/bin/env node
/**
 * End-to-end test of the marketing inbox pipeline against the LIVE
 * marketing@ryan-realty.com mailbox. Calls pollMarketingInbox() with
 * default options, prints the report.
 *
 * Usage:
 *   unset ANTHROPIC_API_KEY  # required if shell has an empty value shadowing
 *   node --env-file=.env.local --experimental-strip-types scripts/marketing-inbox-e2e.mjs
 *
 *   Optional flags via env:
 *     E2E_MAX=10            # max messages per tick (default 5)
 *     E2E_DRY_REPLY=1       # don't send the confirmation reply
 *     E2E_DRY_READ=1        # don't mark gmail-side as read
 */

import { pollMarketingInbox } from '../lib/marketing-brain/inbox-poll.ts'

const maxMessages = parseInt(process.env.E2E_MAX || '5', 10)
const skipReply = process.env.E2E_DRY_REPLY === '1'
const skipMarkAsRead = process.env.E2E_DRY_READ === '1'

console.log(`Running pollMarketingInbox({ maxMessages: ${maxMessages}, skipReply: ${skipReply}, skipMarkAsRead: ${skipMarkAsRead} })`)

const report = await pollMarketingInbox({ maxMessages, skipReply, skipMarkAsRead })
console.log(JSON.stringify(report, null, 2))
