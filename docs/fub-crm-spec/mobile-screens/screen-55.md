<!-- Mobile per-screen appendix. Original: IMG_6025.PNG | id: mob-55 | tiles: mob-tiles/mob-55_{full,t,m,b}.png -->

# mob-55 — fub-ios — Contact Tags List

## Identity

- **app_source:** fub-ios (native Follow Up Boss iPhone app — confirmed by characteristic dark teal/slate header, white "Edit" right-action, and kebab-free nav bar pattern)
- **module:** Contact Detail (Lead Profile) — Tags sub-screen
- **screen name:** Tags (contact tag manager)
- **how to reach:** People tab → tap a contact row → contact detail screen → tap "Tags" field/section → pushes this screen
- **iOS status bar:** Time 7:44 (left, white, bold), signal bars 2/4 (right), WiFi icon (right), battery 16% with yellow fill and "16" label (far right)
- **URL:** N/A — native iOS app, no browser URL bar

---

## Screen regions (top → bottom, y-bands on 390×844 pt logical screen)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | ~54 pt | #2D4A58 (dark teal/slate, same as nav bar) |
| Nav / header bar | 54–98 | ~44 pt | #2D4A58 (dark teal/slate) |
| "Add tags" sticky action row | 98–144 | ~46 pt | #EEF3F8 (very light blue-gray) |
| Scrollable tag list | 144–844+ | fills remainder | #FFFFFF |
| Bottom tab bar | [NOT VISIBLE — list fills screen; tab bar likely scrolled below crop or hidden on this drill-down] | ~83 pt | — |

The list is long enough that the bottom tab bar is not visible in the screenshot. FUB's standard 5-tab bar (Inbox / Activity / — / People / Deals) is inferred as persistent but obscured.

---

## Nav / header bar (exact)

- **Left control:** `<` back chevron — white, ~22 pt, leftmost tap area; tapping navigates back to the Contact Detail screen
- **Center title:** "Tags" — white, ~17 pt, semibold/bold, centered horizontally
- **Right control:** "Edit" — white text, ~15 pt, regular weight; tapping enters multi-select / delete mode for existing tags

No search icon, no bell, no kebab on this screen.

---

## Bottom tab bar (exact)

Not visible in this screenshot (list extends to bottom edge of captured frame). Based on FUB's universal persistent tab bar, inferred tabs in order:

| # | Icon | Label | Badge | State |
|---|---|---|---|---|
| 1 | Speech-bubble | Inbox | — | inactive |
| 2 | Lightning bolt | Activity | — | inactive |
| 3 | — | (no center FAB on this view) | — | — |
| 4 | Person | People | — | active (this drill-down originates from People) |
| 5 | Dollar sign / handshake | Deals | — | inactive |

[INFERRED from FUB iOS standard shell — not visible in screenshot]

No floating action button visible on this screen.

---

## Content — every element, in order

### "Add tags" action row (sticky, at top of list, y ~98–144 pt)

- **Background:** #EEF3F8 (light ice-blue, distinct from the white list rows below)
- **Left element:** Filled circle icon (~28 pt diameter), medium blue fill (~#4A90D9 / FUB action blue), white "+" glyph centered inside
- **Right of icon:** "Add tags" text label — medium blue (#4A90D9), ~16 pt, regular weight
- **Tap behavior:** Opens a tag search/picker sheet (modal) allowing the user to search existing tags or create a new one
- **Divider below:** 1 pt light gray line (#E0E0E0) separating this row from the list

### Tag list rows (scrollable, white background)

Each row is a simple flat text-only row:
- **Layout:** Tag name text left-aligned, ~16 pt left inset, vertically centered within ~50–52 pt row height
- **No avatar, no right-side chevron, no secondary text, no badge, no icon**
- **Divider:** 1 pt hairline separator (#E8E8E8) between every row, full-width (no inset)
- **Text style:** ~16–17 pt, color dark slate-blue (#2D4A5A / #334455), regular weight (not bold)
- **Tap behavior** [INFERRED]: In normal mode, tapping a tag may navigate to a filtered People list for that tag, OR in Edit mode (after tapping "Edit"), rows gain a red delete circle on the left for removal
- **Swipe action** [INFERRED]: Swipe-left on a row likely reveals a red "Delete" action button

**Verbatim tag names visible (in scroll order, top to bottom):**

1. `Bend`
2. `Buyer`
3. `Client`
4. `Expired`
5. `Expired Listings`
6. `Import`
7. `audience:buyer`
8. `city:bend`
9. `contact:has-phone`
10. `contact:mobile-phone`
11. `geo:local`
12. `geo:out-of-state`
13. `motivated`
14. `neighborhood:bend-boyd-acres`
15. `owner:absentee`

List appears to continue below the visible crop (scrollbar visible at right edge in full image, positioned near bottom indicating list is near its end or at end).

**Sort order:** Alphabetical, case-insensitive (capitalized tags first: Bend, Buyer, Client, Expired, Expired Listings, Import — then lowercase/namespaced tags: audience:*, city:*, contact:*, geo:*, motivated, neighborhood:*, owner:*)

**Scrollbar:** Thin gray pill (~4 pt wide) on the far right edge, visible in full screenshot, indicates scrollable content.

**Empty state:** Not visible (list has content). [INFERRED empty state would show a prompt to add the first tag.]

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / status bar background | #2D4A58 (dark teal-slate, FUB brand) |
| Header title text | #FFFFFF |
| Header back chevron | #FFFFFF |
| Header "Edit" text | #FFFFFF |
| "Add tags" row background | #EEF3F8 (ice-blue tint) |
| "Add tags" circle icon fill | ~#4A90D9 (FUB medium blue) |
| "Add tags" text | ~#4A90D9 (FUB medium blue) |
| Tag row background | #FFFFFF |
| Tag text color | #2D4A5A (dark slate, not pure black — same hue family as header) |
| Row divider | ~#E5E5EA (iOS standard hairline gray) |
| Scrollbar | ~#C7C7CC (iOS standard scroll indicator) |
| Battery indicator | Yellow (#FFD700 approx) at 16% |

**Typography:**
- Header title: SF Pro Display or SF Pro Text, ~17 pt, semibold, white
- "Edit" button: SF Pro Text, ~17 pt, regular, white
- "Add tags" label: SF Pro Text, ~16 pt, regular, #4A90D9
- Tag list items: SF Pro Text, ~16–17 pt, regular, #2D4A5A

**Iconography:**
- Back chevron: standard iOS `<` chevron, ~22×22 pt tap target, white stroke
- Add circle: solid filled circle ~28 pt, white "+" glyph, FUB blue fill — NOT a system SF Symbol style; it is FUB's custom filled-circle add button

**FUB accent color** is the medium blue (~#4A90D9), not the in-house navy #102742 — confirms fub-ios.

---

## Interactions & gestures [INFERRED]

| Gesture | Target | Result |
|---|---|---|
| Tap | Back chevron | Pop back to Contact Detail screen |
| Tap | "Edit" (top-right) | Enter edit mode: red minus circles appear left of each tag row; drag handles may appear right side; "Done" replaces "Edit" |
| Tap | "Add tags" row | Presents modal sheet with tag search field + list of all available tags; user taps a tag to apply it to this contact |
| Tap | Tag row (normal mode) | [INFERRED] Opens filtered contact list for that tag, OR selects tag in edit mode |
| Swipe left | Tag row | Reveals red "Delete" / "Remove" action button to remove tag from contact |
| Pull down | List | Pull-to-refresh — reloads tags from server |
| Tap | Red minus circle (edit mode) | Marks tag for removal; reveals inline "Delete" confirmation button on right |

---

## Build notes (component tree)

```
<MobileShell>

  <IOSStatusBar
    time="7:44"
    signal={2}
    wifi={true}
    battery={16}
    batteryColor="yellow"
    bgColor="#2D4A58"
  />

  <TopBar
    bgColor="#2D4A58"
    leftControl={<BackChevron color="#FFF" onTap={navigateBack} />}
    title="Tags"
    titleColor="#FFF"
    titleWeight="semibold"
    rightControl={<TextButton label="Edit" color="#FFF" onTap={enterEditMode} />}
  />

  <StickyActionRow
    bgColor="#EEF3F8"
    borderBottom="1px solid #E5E5EA"
    height={46}
    paddingX={16}
    onTap={openTagPicker}
  >
    <FilledCircleIcon size={28} fill="#4A90D9" glyph="plus" color="#FFF" />
    <Text style="body" color="#4A90D9" marginLeft={12}>Add tags</Text>
  </StickyActionRow>

  <ScrollView flex={1} bgColor="#FFF" showsScrollIndicator={true}>
    {tags.map(tag => (
      <TagRow
        key={tag.id}
        label={tag.name}           // e.g. "Bend", "audience:buyer"
        height={52}
        paddingLeft={16}
        fontSize={16}
        color="#2D4A5A"
        divider="1px solid #E5E5EA"
        onTap={() => handleTagTap(tag)}
        swipeActions={[
          { label: "Delete", color: "#FF3B30", onTap: () => removeTag(tag) }
        ]}
        editMode={isEditMode}
        // In edit mode: shows red minus circle left, drag handle right
      />
    ))}
  </ScrollView>

  {/* Tag picker modal — rendered on "Add tags" tap */}
  <TagPickerSheet
    visible={pickerOpen}
    onDismiss={closePicker}
    onTagSelected={addTagToContact}
    searchPlaceholder="Search tags..."
    availableTags={allSystemTags}
    allowCreateNew={true}
  />

  <BottomTabBar
    tabs={["Inbox", "Activity", "People*", "Deals"]}
    activeTab="People"
    accentColor="#4A90D9"
  />

</MobileShell>
```

**Data bindings:**
- `tags`: array of `{ id: string, name: string }` for tags currently applied to this contact — fetched from FUB contact endpoint (`/v1/people/{id}` → `tags` field)
- `allSystemTags`: full tag list from `/v1/tags` for the picker sheet
- Edit mode toggles a `isEditMode: boolean` state that changes row rendering
- "Add tags" → POST `/v1/people/{id}/tags` with selected tag name
- Swipe delete / edit-mode delete → DELETE `/v1/people/{id}/tags/{tagName}`

**Spacing/sizing summary:**
- Header bar: 44 pt tall
- "Add tags" sticky row: 46 pt tall, 16 pt left padding
- Tag rows: ~50–52 pt tall, 16 pt left text inset, 1 pt hairline dividers
- Add-circle icon: 28 pt diameter
- Scrollbar: ~4 pt wide, system gray, right edge
- No row right-side chevron or meta text — pure label-only rows
