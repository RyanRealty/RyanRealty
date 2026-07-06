# Per-screen extraction template (FUB CRM)

For EACH screenshot, produce one block exactly in this structure. Be exhaustive and literal — this feeds a production CRM build, so spell out every detail you can see. If text is too small to read, say "[illegible]" rather than guessing. Infer interactions where the screenshot implies them, and clearly mark inferences with "(inferred)".

## screen-NNN.png
- **Module / area:** (People list | Person detail | Inbox | Tasks | Calendar | Deals/pipeline | Reporting | Admin/Settings | Smart Lists | Action Plans | Templates | Email compose | Texting | Login | Mobile | other — name it)
- **Browser tab title / URL path:** (read from the Chrome tab + address bar if visible, e.g. ryan-realty.followupboss.com/2/people)
- **Purpose:** one sentence
- **Layout regions:** describe each region present (global top nav, left sidebar/rail, main content, right detail rail, modal/overlay, dropdown). Note position.
- **Global navigation:** list every top-nav item visible (People, Inbox, Tasks, Calendar, Deals, Reporting, Admin, Search, etc.) and any account/avatar/notification controls.
- **Primary content:** 
  - If a TABLE/LIST: list every column header, the row data shown, total count / "showing X of Y", pagination, sort indicator, selection checkboxes, bulk-action bar.
  - If a DETAIL view: every section/card, every field label + value, every tab.
  - If a FORM/MODAL: every field (label, type — text/select/date/checkbox/radio/toggle), placeholder, default, required markers, and buttons.
- **Filters / search / sort:** every filter control, saved-filter/smart-list entries, search box behavior.
- **Buttons & actions:** every button/link/icon-action with its label and inferred effect.
- **Statuses / stages / tags / lead score / pills:** enumerate every status, stage, tag, score, badge value visible.
- **Automation / workflow elements:** action plans, automations, drip, tasks auto-created, "started X ago", round-robin, lead routing, anything workflow-related.
- **Data-model implications:** entities + fields + relationships this screen reveals (e.g. Person has fields: name, stage, source, assigned agent, lead score, tags[], phones[], emails[], address, custom fields...).
- **Notable details / edge cases / counts / numbers:** anything else that matters for a faithful rebuild.

End each screen block with a blank line. Cover EVERY screen in your assigned batch.
