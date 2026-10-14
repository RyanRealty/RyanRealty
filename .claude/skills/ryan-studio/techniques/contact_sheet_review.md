# Contact-sheet self review

Source: video-skills-research #5 (claude-motion)
Category: process

Ready: implemented in `lib/studio/qa/contact.ts`, held by `lib/studio/qa/contact.test.ts`.

## Recipe
`npm run video:check -- <film.mp4>` writes `<name>.contact.png`: frame 0, every beat's start and middle, the hook limit, the end card's call, the last frame, each labelled with its time. Look for collisions, clipping, dead holds and the end card text before anyone else sees it; a separate reviewer signs `<name>.review.json` for `--final`.

## Use
List `contact_sheet_review` in brief.techniques.
