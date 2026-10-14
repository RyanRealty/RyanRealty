# Question + secret hook

Category: hook

Ready: implemented in `lib/studio/timeline/hooks.ts` (`questionTurnWindows`), planned by `lib/studio/timeline/plan.ts`, held by `lib/studio/timeline/hooks.test.ts`.

Source: r5 hook pattern #1

## Recipe
Open with a buyer question card, then the turn ("what most buyers miss") on a second card under it. The question lands by 0.5 s and holds through the hook; the turn lands once the question has been read (1.2 s), or once the voice has said it when the warm conversational VO speaks the question. Both cards hold at least 2.5 s, so the hook beat runs at least about 4 s. The question must end with a question mark. No "top team" wording.

## Use
List `question_secret_hook` in brief.techniques; the hook beat's cards are `{ "kind": "question", "text": "...?" }` then `{ "kind": "turn", "text": "..." }`. Mandatory spec_rules still apply.
