---
title: Put a lead on an automated follow-up
area: CRM
routes:
  - /admin/crm
  - /admin/crm/workflows
summary: Enroll a lead in a sequence so the follow-up runs on its own, and approve the touches that matter.
---

A sequence, also called a workflow, is a timed series of steps that runs for a lead: send an email, send a text, wait, create a task, change a stage, or add a tag. Set it once and it runs on its own.

## New website and ad leads enroll themselves

Leads that come in from the website or an ad are enrolled into the right master workflow automatically, based on their tags. This is why correct tagging matters: the tag is what the rule matches on. A manually added contact is the exception. It gets a new-lead alert but is not drip-enrolled, so you enroll it by hand when you want to.

## Enroll a lead by hand

1. Open the lead.
2. Use the **Automations** chip near the top, or open the workflow board under **Settings, then Workflows**.
3. Pick the sequence and enroll them. The first step goes out on the next send, and every later step follows in order.

## How it behaves

- **Sending windows.** Emails go out between 7am and 7pm, texts between 8am and 9pm Pacific.
- **Stops on reply.** The moment the lead replies, the sequence pauses so you take over the conversation.
- **Steps that need your approval** wait in the **Approvals** queue (and in the Needs Action count on your dashboard) until you send, edit, skip, or dismiss them.
