# Send-invite line

Category: cta

Ready: implemented in `lib/studio/timeline/hooks.ts` (`sendInviteWindow`), planned by `lib/studio/timeline/plan.ts`, held by `lib/studio/timeline/hooks.test.ts`.

Source: video-skills-research #4 (sends per reach)

## Recipe
End the payoff with a share prompt on its own card before the end card, never on it: `Send this to whoever you're house hunting with.` The voice says the line word for word, so the burned-in captions carry it too; the renderer refuses a share line the voice never says. The card holds at least 2.5 s and the line must ask the viewer to send or share.

## Use
List `send_invite_hook` in brief.techniques and set timeline.json `cta: { "text": "Send this to ...", "start", "end", "kind": "send_invite" }`, with the same line in voice.script. Mandatory spec_rules still apply.
