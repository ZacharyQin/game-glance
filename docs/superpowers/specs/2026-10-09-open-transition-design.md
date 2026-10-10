# Open transition: Home to the game page

Date: 2026-10-09. Status: design agreed with Michael after the interactive prototype
(interactive prototype, shared privately); waiting for spec review.

## Why

Opening a game from Spotlight Home today (A on the game cards, the info button, or a feed card) runs
`openTransition` + `OpenOverlay`. A copy of the selected wide card, with its small capsule art, is scaled up to
full screen over 480 ms while Home fades. The page opens at 520 ms and the copy fades out by about 1 s.
- The art is low resolution and visibly blown up.
- The motion ignores that Home and the game page show **the same hero art**.

## What we want

Home should look as if it *becomes* the game page. The hero art is the anchor and doesn't move. Only what differs
between the two screens animates: Home's own elements leave, and the rest move to where the page has them.
- **Snappy:** the motion is done in about 360 ms; the page's extra parts are in by about 620 ms.
- **Opening only:** going back with B keeps today's behaviour.
- **Spotlight look:** the chips **grow into the page's cards**.
- **Clean look:** the chips slide into the stats panel.

The prototype is the reference for the motion. Its timings and choreography below are the target. The device
decides the details, because being snappy on the ROG Xbox Ally matters more than matching the prototype frame for frame.

## The motion

Times are from the press of A. "Canvas" means Home's scaled canvas (`.gh-canvas`).

### Opening the selected game (the game cards, or the info button)
1. **Leave, 0–220 ms** (ease-in):
   - The game cards row (`.gh-recents`) and the "more" hint slide down 70 canvas px and fade out.
   - The info button fades out over 0–180 ms (the page has no info button).
   - The Library card, if visible, leaves with the row.
2. **Morph, 0–360 ms** (`cubic-bezier(.2,.8,.2,1)`):
   - The **title block** (title or logo, eyebrow) moves down to the page's title place.
   - The **action row** moves to the page's Play row: the Play pill grows to the page's pill width, and the circles grow to the page's size.
   - The **store pill** moves to the page's store pill place.
   - **Home's scrims crossfade to the page's scrims** (`SCRIM_BOTTOM`, `SCRIM_LEFT`, the handoff scrims in `themeCss`).
   - **Chips, Spotlight look:**
     - The Play time and Achievements chips' glass grows into the info card's rectangle; the second chip's glass fades out as it merges.
     - The HLTB chip's glass grows into the HowLongToBeat card.
     - Each chip's label and value move to the card's stat place and grow to the card's type size. The HLTB label changes from "HLTB main" to "Main", and the HLTB value turns the accent text colour.
     - The HLTB chip's bar fades out.
   - **Chips, Clean look:**
     - All three chips' glass grows into the stats panel; the last two fade out as they merge.
     - Play time and HLTB move to their panel columns, and the HLTB bar moves under its value.
     - Achievements fades out, since Clean has no place for it.
3. **Hand-over, at 360 ms:**
   - Home now matches the page's layout. A frozen copy of Home's root (`cloneNode(true)`, about 180 nodes, no pointer events) is placed in the document body, as today's overlay is, and the route changes.
   - The copy covers the moment Steam unmounts Home and draws the page.
4. **Reveal, from 360 ms:**
   - The copy fades out over 120 ms once the page is ready, or after 500 ms at most. "Ready" means the header art has loaded and decoded, and the title block and Play row are laid out.
   - From about 420 ms the page's new parts fade in over 200 ms:
     - the description
     - the HowLongToBeat title, extras and caption
     - the cloud button
     - the family pill
     - the Clean panel's size column

### Opening a game from the feed (a different game from the hero)
There's no morph, since nothing on screen belongs to that game.
- Over 0–300 ms, that game's full-resolution hero fades in over Home's hero, using Home's own hero resolver and crop.
- Home's UI fades out over 0–220 ms, and Home's scrims crossfade to the page's.
- Hand-over at 300 ms.
- The page's elements fade in and rise 14 px over 330–580 ms.

### Game Glance page off (Steam's own page)
Home's UI fades out over 0–220 ms on the steady hero, then the hand-over. The reveal waits only for Steam's page.

### Failures
These keep today's guarantees (`createOpenTransition`):
- If something can't be measured or mounted, the page opens at once without motion.
- A second press while a transition runs is ignored.
- `cancelOpen` (plugin unload) removes everything.
- A page that never reports ready is revealed after 500 ms.

## How it is built

### Constraints
- **Transform and opacity only** on Home's moving elements, so the morph causes no layout or style recalculation per frame. `src/home/motion.ts` records why that matters on the Ally: an animated inherited custom property cost 7–17 ms a frame.
- The prototype animated left, top, width and height and font size; the real version must not.
- **One source of truth for positions.** The page's layout numbers move into exported constants in `src/styles/themeCss.ts` (the Play row offset, row height, card and Clean panel geometry, title block placement, header crop). The theme and the transition's targets both read them, so they can't drift apart.

### Units
- **`src/home/openTargets.ts`** (new, pure): `pageTargets(look, screen, canvasScale)` returns, in Home's canvas coordinates, the page's rectangles for the title block, the Play pill, each circle, the store pill, the card or panel shells, and each stat's label and value place. It works from the theme constants and the page's scale unit for that screen size, converted into Home's canvas scale.
- **`src/home/openMotion.ts`** (new, pure): turns Home's measured rectangles plus `pageTargets` into per-element transforms (translate and scale), opacities and the timings above. Output is plain data, applied as CSS custom properties.
- **`src/home/homeCss.ts`**: rules for `.gh-root[data-gh-opening]` that read those properties, with the transitions per phase. `openOverlayCss` and the old leaving rule are removed.
- **Shell growth.** The chip glass grows into a card either as a scale transform on a shell element (border radius and blur then stretch while moving) or with `clip-path: inset()` on a card-sized element. Task 1 on the device picks one; the other is dropped.
- **`src/home/openTransition.ts`**: the new timeline (morph, hand-over at 360, bridge fade on ready or timeout), still pure with injected timers, router and DOM operations; `TIMINGS` replaced.
- **`src/home/openBridge.ts`** (replaces `OpenOverlay.tsx`): mounts the frozen copy of Home's root in the body; fades and removes it on "ready" or the timeout.
- **`src/data/openIntent.ts`** (new, like `launchIntent`): `markOpen(appId, look)`, `openPending(appId)`, `clearOpen()`. Module state, never stored.
- **The game page** (`src/components/GameHero.tsx`, `src/styles/theme*`):
  - With an open intent for its game, the page starts in an "arriving" state: its new parts have opacity 0 from the first frame, then fade in.
  - It reports "ready" (header image decoded, title block and Play row present) to the bridge through `openIntent`, then clears the intent.
- **`src/home/homeNav.ts`**: `openGame` chooses the morph (the selected game) or the hero-fade variant (a feed card). `gameOpenArt` and the capsule art layers go.
- **The header crop:** Home's hero is `cover` at `50% 30%`. If Steam's page header crops differently, the page's header image is pinned to Home's crop (one rule in the theme), so the hero is identical at the hand-over.

## Testing

- **Unit tests** (vitest, like today's `openTransition.test.ts`):
  - `pageTargets` for both looks at handheld (1280×800, 828×466 css) and TV (1920×1080) sizes
  - `openMotion` output
  - the timeline and every failure path with fake timers
  - `openIntent` timing
  - the bridge's ready and timeout handling
- **On the Ally first (Task 1, before the full build):**
  - read Steam's header crop and the page's real element rectangles over CEF
  - run a minimal morph (title block and action row only) and record frame timing over CEF tracing, docked at 120 Hz and handheld
  - The target is no frame over about 16 ms during the morph, and the first page frame no later than the 500 ms cap.
  - This decides the shell technique (scale or clip-path) and whether 360 ms holds.
- **On the Ally, finished build:**
  - Spotlight look, Clean look, and the Game Glance page off
  - opening from the game cards (A), the info button and a feed card
  - handheld and docked
  - a fast double press, and unloading the plugin mid-transition
  - Expected: the hero never jumps, there's no visible step at the hand-over, and it feels at least as quick as today.
  - Results go into `docs/device-checklist.md`; the README's mention of the transition is updated.

## Out of scope
- The reverse transition (B back to Home).
- Any change to the game page's layout itself.
- The feed sheet's own motion.
