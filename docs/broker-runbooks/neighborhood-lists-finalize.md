# Finalize 19 new neighborhood smart lists, ~20 minutes

The 19 list shells already exist in FUB (created via API). They need three things to be fully functional:

1. The right tag filter on each list (so it shows the right people)
2. "Share with everyone" toggled on (so the lists appear in the collection editor)
3. Added to the Neighborhoods collection (so they group with the other 9)

Two of the 19 I already wired up:

| List | Status |
|---|---|
| Bend - River West | Filter added, 1,312 people (verify the count survived the reload) |
| Bend - Summit West | Filter added, 432 people (verify the count survived the reload) |

The other 17 need filters added.

## The 17 remaining lists

| List name | Tag to add to "Tags include any of" filter |
|---|---|
| Bend - Old Bend | neighborhood:bend-old-bend |
| Bend - Awbrey Butte | neighborhood:bend-awbrey-butte |
| Bend - Mountain View | neighborhood:bend-mountain-view |
| Bend - Old Farm District | neighborhood:bend-old-farm-district |
| Bend - Southwest Bend | neighborhood:bend-southwest-bend |
| Bend - Orchard District | neighborhood:bend-orchard-district |
| Bend - Larkspur | neighborhood:bend-larkspur |
| Bend - Century West | neighborhood:bend-century-west |
| Bend - Southeast Bend | neighborhood:bend-southeast-bend |
| Bend - Southern Crossing | neighborhood:bend-southern-crossing |
| Bend - Boyd Acres | neighborhood:bend-boyd-acres |
| Eagle Crest | neighborhood:eagle-crest |
| Three Rivers | neighborhood:three-rivers |
| Brasada Ranch | neighborhood:brasada-ranch |
| Widgi Creek | neighborhood:widgi-creek |
| Broken Top | neighborhood:broken-top |
| Awbrey Glen | neighborhood:awbrey-glen |

## Per-list flow (~45 seconds each)

1. Click the list in your left sidebar (scroll down to find it).
2. Right panel, click in "Add a filter" textbox.
3. Type `Tags`. Pick `Tags` from the dropdown.
4. Click the blue `+` button.
5. In the search box that opens, type the tag from the table above (for example `neighborhood:bend-old-bend`).
6. Click the matching suggestion.
7. Click `Update List` at top right (and click it once more if it stays blue).

## Set sharing on each new list

The API-created shells default to private. Until you fix this, they won't appear in the Neighborhoods collection editor.

For each of the 19 new lists (including River West and Summit West):

1. Open the list.
2. Click `Edit` next to the list title.
3. Check `Share smart list with` -> `Share with everyone`.
4. Click `Save List`.

## Add all 19 to the Neighborhoods collection

Once they are all shared with everyone:

1. People > Manage.
2. Hover the Neighborhoods collection row, click the `...` menu, pick `Edit Collection`.
3. The modal shows checkboxes for all available lists. Check all 19 of the new ones.
4. Click `Save Collection`.

Result: Neighborhoods collection grows from 9 to 28 lists.

## Why this fell to a runbook

The FUB UI's add-filter flow is timing-sensitive when driven by automation. The clicks have to land in the right modal layer at the right time, and small layout shifts break the script. You can do this faster by hand than I can drive it.

The shells are already created so the cost is just filter + sharing per list, no recreation.
