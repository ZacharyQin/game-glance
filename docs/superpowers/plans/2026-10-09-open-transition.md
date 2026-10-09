# Open Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the low-resolution card zoom with a transition in which Spotlight Home morphs into the game page's layout over a steady hero, then hands over to the real page.

**Architecture:**
- Pure modules compute where the page puts things (`openTargets`), turn Home's measured rectangles into per-element transforms (`openMotion`), and run the timeline (`openTransition`).
- Home applies the motion with CSS custom properties and transform/opacity transitions.
- A frozen copy of Home (`openBridge`) covers the route change.
- A one-shot intent (`openIntent`) puts the game page in an "arriving" state and lets it report when it is ready.

**Tech Stack:** TypeScript, React (Decky `@decky/ui`), vitest (node environment, no DOM), Steam CEF debugging via `scripts/cef-*.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-09-open-transition-design.md`

**Corrections to the spec, from the code:**
- The Clean look's panel also has an Achievements column when the game has achievements (`logic/cleanInfo.ts`). So on every look, a chip moves to the page stat with the same key, and fades only when the page has no such stat.
- Morph only when Home shows the game's full hero art (`HeroBackground` mode `'full'`). With fallback or no art, the hero would not match the page's, so the page-off fade is used instead.

## Global Constraints

- **Timings (ms), one constant `OPEN_TIMINGS` in `src/home/motion.ts`:**
  - `leave: 220`, `infoFade: 180`, `morph: 360`
  - `feedHero: 300`, `feedUi: 220`
  - `bridgeFade: 120`, `readyCap: 500`, `revealDelay: 60`, `reveal: 200`
  - `leaveDrop: 70` (canvas px), `feedRise: 14` (css px)
- **Easing:** morph `cubic-bezier(.2,.8,.2,1)` (`SLIDE_EASE`'s family; a new `MORPH_EASE`). Leave uses `cubic-bezier(.4,0,1,1)`, fades use `ease`.
- **Animated properties:** Home's moving elements animate **only `transform` and `opacity`**. Never width, height, top, left, font-size or an inherited custom property (`motion.ts`: an animated inherited property cost 7–17 ms per frame on the Ally).
- **Positions:** every target position derives from constants exported by `src/styles/themeCss.ts`. The theme's CSS output must stay byte-identical (`tests/styles/themeCss.test.ts` snapshots).
- **Failure behaviour:** anything that can't be measured, mounted or scheduled still opens the page at once; a press during a transition is ignored; `cancelOpen()` removes every trace.
- **Commits:**
  - identity from env vars `GIT_AUTHOR_NAME/EMAIL` and `GIT_COMMITTER_NAME/EMAIL` = `Michael Palma <18511803+michpalm@users.noreply.github.com>` (the clone's own git config has a personal address)
  - every message ends with both `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Co-Authored-By: Michael Palma <18511803+michpalm@users.noreply.github.com>`
- **Builds:** no zip and no push unless Michael asks. Test builds go to the Ally through `scripts/package.sh` + `scripts/serve.sh`.
- **Captures:** device captures (fixtures, screenshots) must never include the Friends tab, friends' names or Steam IDs.

## Review Focus

1. **A game without full hero art** (fallback blur, or none; many non-Steam shortcuts): no morph; the fade variant runs and the page still opens. Pinned in Task 6.
2. **A page that is slow or never reports ready** (cold cache, a shortcut with no header art): the bridge leaves by `readyCap` (500 ms) and the page's new parts still fade in. Pinned in Tasks 7 and 8.
3. **Stats that differ between Home and the page:**
   - a Unifideck size column the page adds
   - no achievements
   - Home's "Added" chip for a new game, which has no page stat

   Each chip moves only to a same-key stat; the rest fade. Pinned in Task 3.
4. **Logo option on, or a three-line text title:** the title block moves by its bottom-left corner, so a taller title still lands with its bottom where the page has it. Pinned in Task 6.
5. **Plugin unload, or a second press, mid-transition:** `cancelOpen()` removes the bridge and Home's opening state and clears the intent; a second `open()` is ignored. Pinned in Task 8.

---

### Task 1: Device check on the Ally (crop, real page layout, frame timing)

No product code. This answers the spec's open questions and records the page's real layout as test fixtures.

**Files:**
- Create: `scripts/cef-layout.mjs` (dumps the rectangles below as JSON; same CDP plumbing as `scripts/cef-eval.mjs`)
- Create: `tests/home/fixtures/openLayout/{spotlight,clean}-{828x466,1500x844}.json` (page) and `home-{828x466,1500x844}.json` (Home)
- Create: `docs/superpowers/specs/2026-10-09-open-transition-device-notes.md`
- Throwaway, in the scratchpad (never committed): the morph spike script.

**Interfaces:**
- Produces: the fixture JSON shape `{ screen: {width, height}, rects: Record<string, {x, y, w, h}>, texts: Record<string, string>, headerImg?: {src, objectFit, objectPosition} }`, with the rect keys listed in Step 2. Tasks 3 and 5 read these.

- [ ] **Step 1: Open the CEF tunnel and confirm the target**

Run: `ssh -f -N -L 18080:127.0.0.1:8080 ally && curl -s http://127.0.0.1:18080/json | grep -c title`
Expected: a number ≥ 1. The Big Picture target is titled "Steam Big Picture Mode", or the Spanish title ("Modo Big Picture de Steam") when Steam is in Spanish.

- [ ] **Step 2: Write `scripts/cef-layout.mjs <home|page> <out.json>`**

It runs in SharedJSContext, reads `SteamUIStore.GetFocusedWindowInstance().BrowserWindow.document` and writes `getBoundingClientRect()` for these keys (missing elements are left out):
- **Page:** `header` and its `img` (plus `headerImg` with computed `objectFit` and `objectPosition`), `titleblock`, `title` (`.gg-title` or `.gg-logo`), `eyebrow`, `play` (Steam's Play button container), `circle0..3` (Steam's MenuButton circles and cloud, in order), `store` (`.gg-pill`), `family`, `card0`, `card1` (`.gg-card`), `clean` (`.gg-clean-info`), and per stat `stat:<key>:label` / `stat:<key>:value` (keys `size|played|achievements|main|mainExtras|completionist|hltb`, from the `data-stat` attributes Task 7 adds; until then by column order) with `texts` for each.
- **Home:** `titleSlot`, `eyebrow`, `chip:<key>`, `chip:<key>:label`, `chip:<key>:value`, `chip:<key>:bar`, `pill`, `circle0..3`, `store`, `recents`, `heroFull` (+ its computed `backgroundPosition`).

- [ ] **Step 3: Capture the fixtures**

With Michael:
- Death's Door selected on Home, captured docked (1500×844) and handheld (828×466).
- Its page with the Spotlight look and then the Clean look, at both sizes.

Michael switches the look in Quick Access and docks or undocks. Save the six files to `tests/home/fixtures/openLayout/`.
Expected: the fixtures hold no names other than the game's, and no Steam IDs (check with `grep -i steamid`).

- [ ] **Step 4: Answer the crop question**

Compare the page's `headerImg.objectPosition` (and the image's rect against the screen) with Home's `heroFull` `backgroundPosition: 50% 30%`. Write the answer in the notes: "same", or "page needs `object-position: 50% 30%`" (Task 7 then adds that rule).

- [ ] **Step 5: Frame-timing spike**

A throwaway script injects, on the live Home, the opening state of the title block and action row (translate only), plus a chip glass grown into the info card in two variants:
- (a) `transform: scale()` on a `::before` layer
- (b) `clip-path: inset()` on a card-sized layer

It records `requestAnimationFrame` deltas over 600 ms, 5 runs each, docked (120 Hz) and handheld.
Expected: per variant, the max and the 95th-percentile frame time.
Decision rule:
- pick the variant whose max is ≤ 16.7 ms (if both pass, the lower p95)
- if neither passes, stop and ask Michael

- [ ] **Step 6: Write the notes and commit**

The notes record: the crop answer, the shell decision with the numbers, and any difference from the spec's assumptions.

```bash
git add scripts/cef-layout.mjs tests/home/fixtures/openLayout docs/superpowers/specs/2026-10-09-open-transition-device-notes.md
git commit -m "Open transition: device notes and page layout fixtures"
```

### Task 2: The page's layout constants, exported

**Files:**
- Modify: `src/styles/themeCss.ts` (the restyle layout values in `restyleRules` and `buildCleanCss`, about lines 280–490)
- Test: `tests/styles/themeCss.test.ts`

**Interfaces:**
- Produces:

```ts
export const PAGE_LAYOUT: {
    canvas: { wide: 1440; deck: 1280; deckMaxAspect: 1.7 };      // --gg-d = 100vw / canvas
    tvQuery: { minWidth: 1408; minHeight: 793 };                   // the TV media query (css px)
    side: { base: 56; tv: 24 };                                    // d units
    playW: 340; icon: 60; gap: 14; rowH: 96;                       // d units
    playTop: { spotlight: 386; tvCards: 178; tvGap: 24 };          // H - 386d; TV: H - legend - (rowH + tvCards + tvGap)d
    clean: { bottom: 36; minBelowRow: 61; gap: 28 };               // CLEAN_BOTTOM, CLEAN_MIN_BELOW_ROW (px), CLEAN_GAP
    titleGap: 36;                                                  // title block bottom above the Play row (Spotlight)
    cards: { gridGap: 18; padX: 24; padY: 20; colGap: 12; split: [1.1, 1] };
    stats: { label: 11; value: 30; colGapInfo: 40; colGapHltb: 36; rowGap: 4; hltbGap: 10 };
    cleanInfo: { padX: 24; padY: 14; colGap: 28; value: 22 };
    storePillTop: 82;                                              // .gg-pill top: -82d above .gg-hero (Spotlight)
};
```

Also `STEAM_LEGEND_PX` (already exported), `PAGE_SCRIMS: string` (the restyled `::after` background list, already built from `HANDOFF_SCRIM_*` and `SCRIM_*`), and `pageDUnit(width: number, height: number): number`.

- [ ] **Step 1: Write the failing test** `pageDUnit follows --gg-d`:
  - `expect(pageDUnit(1500, 844)).toBeCloseTo(1500 / 1440)`
  - `expect(pageDUnit(1280, 800)).toBeCloseTo(1)`
  - `expect(pageDUnit(828, 466)).toBeCloseTo(828 / 1440)`
- [ ] **Step 2: Run** `pnpm vitest run tests/styles/themeCss.test.ts`. Expected: FAIL (`pageDUnit` not exported).
- [ ] **Step 3: Implement.** Replace the literals in `restyleRules`/`buildCleanCss` with `PAGE_LAYOUT` fields (no value changes), export `PAGE_SCRIMS` and `pageDUnit`. Aspect rule: `width / height > deckMaxAspect` gives `wide`, the same rule as `home/scale.ts homeCanvas`.
- [ ] **Step 4: Run** `pnpm vitest run tests/styles`. Expected: PASS, and the existing CSS snapshots unchanged (no `-u`).
- [ ] **Step 5: Commit** "Theme: export the page's layout constants".

### Task 3: `openTargets`: where the page puts things

**Files:**
- Create: `src/home/openTargets.ts`
- Test: `tests/home/openTargets.test.ts`

**Interfaces:**
- Consumes: `PAGE_LAYOUT`, `STEAM_LEGEND_PX`, `pageDUnit` (Task 2); `LOGO_BOX` (`src/styles/logoBox.ts`); the Task 1 fixtures.
- Produces:

```ts
export type PageLook = 'spotlight' | 'clean';
export interface Box { x: number; y: number; w: number; h: number }          // css px, Big Picture viewport
export type StatKey = 'size' | 'played' | 'achievements' | 'hltb';
export interface PageStat { key: StatKey; label: string; value: string }
export interface PageTargets {
    titleBottomLeft: { x: number; y: number };   // the title block's bottom-left corner (it grows upward)
    play: Box; circles: Box[];                   // Play pill, then circle slots 0..3
    store: Box;                                  // right-aligned; width = the Home pill's own (only its x/y matter)
    shells: Box[];                               // Spotlight: [info card, HLTB card]; Clean: [panel]
    stats: Partial<Record<StatKey, { label: Box; value: Box }>>;
}
export type Measure = (text: string, fontPx: number, weight: number, letterSpacingEm: number) => number;
export function pageTargets(look: PageLook, screen: { width: number; height: number }, stats: PageStat[], measure: Measure, storeWidth: number): PageTargets;
```

The `stats` input lists the page's stats in page order:
- **Spotlight:** the info card holds `size?`, `played`, `achievements?`; the HLTB card's Main column is key `hltb`.
- **Clean:** `cleanStats()` order.

Stat columns are laid out as the page's flex rows lay them out: column width = max of the measured label and value widths; gaps `colGapInfo`/`colGapHltb`/`cleanInfo.colGap`. The Clean panel is right-aligned at `width - side` and vertically centred on the Play pill.

- [ ] **Step 1: Write the failing tests:**
  - `matches the measured Spotlight page at 1500x844 within 2 px`: load `fixtures/openLayout/spotlight-1500x844.json`; with `measure` returning the fixture's own label and value widths, every produced box equals the fixture rect within 2 px (`play`, `circle0..2`, `card0/card1` → `shells`, `stat:*`, the title block's bottom-left).
  - The same test for `spotlight-828x466`, `clean-1500x844` and `clean-828x466`.
  - `a stat the page lacks has no target`: with stats `[played, hltb]`, `targets.stats.achievements` is `undefined`.
  - `a Unifideck size column shifts the others right`: with `[size, played, hltb]` on Clean, `stats.played.label.x > stats.size.label.x`, and the panel width grows by the size column plus one gap.
- [ ] **Step 2: Run** `pnpm vitest run tests/home/openTargets.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `pageTargets`.** The formulas come from `PAGE_LAYOUT` and Task 1's notes, never from fixture numbers; the fixtures only check them. `H` = screen height; legend = `STEAM_LEGEND_PX`; `d = pageDUnit(...)`; TV = the `tvQuery` test.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** "Open transition: the page's target layout".

### Task 4: `openIntent`: Home tells the page it is arriving

**Files:**
- Create: `src/data/openIntent.ts` (modelled on `src/data/launchIntent.ts`)
- Test: `tests/data/openIntent.test.ts`

**Interfaces:**
- Produces:

```ts
export const OPEN_INTENT_MS = 3000;
export type ArriveMode = 'parts' | 'all';   // morph: only the page's new parts arrive; heroFade/fade: the whole page does
export interface OpenIntent { look: PageLook | 'steam'; mode: ArriveMode }
export function markOpen(appId: number, intent: OpenIntent, now?: number): void;
export function openPending(appId: number, now?: number): OpenIntent | null;
export function onOpenReady(listener: (appId: number) => void): () => void;   // returns unsubscribe
export function reportOpenReady(appId: number): void;                          // calls listeners once, then clears
export function clearOpen(): void;
```

- [ ] **Step 1: Write the failing tests:**
  - `pending for its game only, within OPEN_INTENT_MS`: `markOpen(10, {look:'clean', mode:'parts'}, 0)`; `openPending(10, 2999)` equals `{look:'clean', mode:'parts'}`, `openPending(10, 3000)` is `null`, and `openPending(11, 5)` is `null`.
  - `ready reaches listeners once and clears`: a listener gets `10` once; a second `reportOpenReady(10)` calls nothing; `openPending(10)` is `null` afterwards.
  - `invalid ids are ignored`: `markOpen(0, {look:'clean', mode:'parts'})` then `openPending(0)` is `null`.
- [ ] **Step 2: Run** `pnpm vitest run tests/data/openIntent.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Module state, never stored; a listener that throws is caught and does not stop the others.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** "Open transition: the open intent".

### Task 5: `openMotion`: Home's rectangles to transforms

**Files:**
- Create: `src/home/openMotion.ts`
- Modify: `src/home/motion.ts` (add `OPEN_TIMINGS`, `MORPH_EASE`; remove nothing yet)
- Test: `tests/home/openMotion.test.ts`

**Interfaces:**
- Consumes: `PageTargets`, `Box` (Task 3); the Task 1 `home-*.json` fixtures.
- Produces:

```ts
export interface HomeRects {                       // css px, measured with getBoundingClientRect
    titleSlot: Box; eyebrow: Box; play: Box; circles: Box[]; store: Box | null;
    chips: Array<{ key: string; shell: Box; label: Box; value: Box; bar: Box | null }>;
    infoCircle: number | null;                     // index in circles of the info button (it fades)
}
export interface MotionVar { name: string; value: string }   // a CSS custom property set on .gh-root
export function openMotion(home: HomeRects, page: PageTargets, look: PageLook, canvasScale: number): MotionVar[];
```

Variables (all transforms in canvas px, divided by `canvasScale`, with `transform-origin: 0 0` semantics):
- `--gho-title`, `--gho-play`, `--gho-play-bg` (the pill's background layer: translate plus a non-uniform scale to the page pill), `--gho-play-fg` (content: translate only)
- `--gho-circle-<i>` (translate plus a uniform scale), `--gho-store` (translate only)
- `--gho-chip-<i>-shell`, `--gho-chip-<i>-label`, `--gho-chip-<i>-value` (translate plus a uniform scale to the page's type size)
- `--gho-chip-<i>-o` (0 when the chip has no page stat, or merges into a shell already taken by an earlier chip)
- `--gho-bar-<i>` (to the Clean bar, or opacity 0)

The shell transform depends on Task 1's decision:
- scale variant: a `scale(sx, sy)` string
- clip-path variant: an `inset(...)` start value

- [ ] **Step 1: Write the failing tests:**
  - `title block moves by its bottom-left corner`: with `home-1500x844.json` and the Spotlight targets, the `--gho-title` translate equals `(target.bottomLeft - home.titleSlot.bottomLeft) / canvasScale` within 0.5.
  - `a taller title still lands at the same bottom` (Review Focus 4): growing `titleSlot.h` by 80 and moving `y` up by 80 gives the same translate.
  - `chips merge into one shell per card`: on Spotlight, `played` and `achievements` share card 0, so chip 1's `-o` is `0` and chip 0's shell scale maps its box onto card 0.
  - `a chip without a page stat fades`: an `added` chip gets `-o` = `0` and no label or value transform.
  - `info circle fades, the others map in order`: with `infoCircle: 2` on a three-circle row, circle 2 gets no target transform, and circles 0 and 1 map to page circles 0 and 1.
- [ ] **Step 2: Run** `pnpm vitest run tests/home/openMotion.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Round to 0.01 px; the output order is stable (sorted by name) so it can be compared in tests.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** "Open transition: Home's motion from the page's targets".

### Task 6: Home's opening state (DOM hooks and CSS)

**Files:**
- Modify:
  - `src/home/TitleBlock.tsx` (`data-chip={chip.key}` on each `.gh-chip`)
  - `src/home/ActionRow.tsx` (`data-action="play|controller|menu|info|cloud"` on each `ActionButton`; the pill's content wrapped in `.gh-btn-fg`)
  - `src/home/SpotlightHome.tsx` (a `.gh-scrim gh-scrim-page` element after the other scrims)
  - `src/home/homeCss.ts` (opening rules)
- Create: `src/home/openHome.ts` (`measureHome`, `openVariant`, `applyOpening`)
- Test: `tests/home/openHome.test.ts`, `tests/home/homeCss.test.ts`

**Interfaces:**
- Consumes: `openMotion`, `MotionVar` (Task 5); `pageTargets`, `Measure` (Task 3); `PAGE_SCRIMS` (Task 2); `OPEN_TIMINGS`, `MORPH_EASE` (Task 5).
- Produces:

```ts
export type OpenVariant = 'morph' | 'heroFade' | 'fade';
export function openVariant(o: { sameGame: boolean; heroMode: 'full' | 'fallback' | 'none'; pageRestyled: boolean }): OpenVariant;
export function measureHome(root: Element): HomeRects | null;        // null when anything required is missing
export function applyOpening(root: HTMLElement, variant: OpenVariant, vars: MotionVar[], heroUrl: string | null): () => void; // sets data-gh-opening, returns undo
```

- [ ] **Step 1: Write the failing tests:**
  - `openVariant` (Review Focus 1):
    - `{sameGame:true, heroMode:'full', pageRestyled:true}` gives `'morph'`
    - with `heroMode:'fallback'` or `'none'` it gives `'fade'`
    - `{sameGame:false, …}` gives `'heroFade'`
    - `pageRestyled:false` gives `'fade'`
  - `homeCss` opening rules:
    - the CSS contains `.gh-root[data-gh-opening="morph"] .gh-title-slot` with `transform: var(--gho-title)`
    - every opening rule's `transition` lists only `transform` and `opacity` (regex over the opening block)
    - `.gh-scrim-page`'s background equals `PAGE_SCRIMS`
- [ ] **Step 2: Run** `pnpm vitest run tests/home/openHome.test.ts tests/home/homeCss.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **CSS:** `homeCss` gains `openingRules()` with these phases (times from `OPEN_TIMINGS`):
    - leave: `.gh-recents`, `.gh-tabs` and the more hint `translateY(leaveDrop)` + opacity 0, `leave` ms; `[data-action=info]` opacity 0, `infoFade` ms
    - morph: everything listed in Task 5, `morph` ms, `MORPH_EASE`; Home scrims to 0 and `.gh-scrim-page` to 1
    - heroFade: a `.gh-hero-open` layer gets `heroUrl` and fades in over `feedHero`; the UI fades over `feedUi`
    - fade: the UI fades over `feedUi`
  - **Chip glass:** during opening the chip's own background moves to a `::before` (or a card-sized `::after` for clip-path), so its text isn't scaled with it.
  - **DOM:** `measureHome` reads the rectangles listed in `HomeRects` by `data-chip` and `data-action`.
  - **Text measuring:** the `Measure` passed to `pageTargets` uses a 2D canvas `measureText` with the page's font family (`getComputedStyle(root).fontFamily`).
- [ ] **Step 4: Run** `pnpm vitest run tests/home`. Expected: PASS (existing Home tests unchanged).
- [ ] **Step 5: Commit** "Home: the opening state for the open transition".

### Task 7: The game page arrives

**Files:**
- Modify:
  - `src/components/InfoCard.tsx`, `src/components/HltbCard.tsx`, `src/components/CleanInfo.tsx` (`data-stat` on each stat column: `size|played|achievements|main|mainExtras|completionist|hltb`)
  - `src/components/GameHero.tsx` (arriving state and ready report)
  - `src/styles/themeCss.ts` (`buildArrivingCss`; the header crop rule, only if Task 1 says so)
- Create: `src/styles/pageReady.ts`
- Test: `tests/styles/pageReady.test.ts`, `tests/styles/themeCss.test.ts`

**Interfaces:**
- Consumes: `openPending`, `reportOpenReady`, `clearOpen` (Task 4).
- Produces:

```ts
export function buildArrivingCss(classes: ThemeClasses, look: PageLook, mode: ArriveMode): string;   // 'parts': the page's new parts; 'all': every page element with text (as launchTargets' hide list); '' without the layout classes
export function pageReady(doc: { querySelector(s: string): { complete?: boolean; naturalWidth?: number; getClientRects(): { length: number } } | null } | null, sel: { headerImg: string | null; titleblock: string; play: string | null }): boolean;
```

- [ ] **Step 1: Write the failing tests:**
  - `pageReady`:
    - true only when the header image is `complete` with `naturalWidth > 0`, and the title block and Play row have client rects
    - false when the image isn't loaded, and false for a null doc
  - `buildArrivingCss(classes, 'spotlight', 'parts')` hides these, each with `opacity: 0`:
    - `.gg-desc`
    - `.gg-hltb > .gg-label`
    - `.gg-hltb [data-stat=mainExtras]`, `[data-stat=completionist]`
    - `.gg-caption`, `.gg-muted`, `.gg-hltb .gg-bar`
    - `.gg-family`, the cloud circle, `[data-stat=size]`
  - `buildArrivingCss('clean', 'parts')` hides `[data-stat=size]`, `.gg-family` and the cloud circle.
  - `buildArrivingCss(classes, 'spotlight', 'all')` hides the title block, Steam's Play section and `.gg-hero` with `opacity: 0` and `transform: translateY(14px)` (`feedRise`), and its reveal style returns them to `opacity: 1; transform: none` over `reveal` ms.
  - `buildArrivingCss` is `''` when the layout classes are missing.
- [ ] **Step 2: Run** `pnpm vitest run tests/styles`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `GameHero` reads `openPending(appId)` in its first render; with look `'steam'` (Game Glance page off) GameHero renders nothing, so for that case `openBridge` reports ready itself once Steam's header image is loaded (same `pageReady` check, run from the bridge) (state initialiser, like `useLaunchOverlay`). While pending, it renders `<style>{arrivingCss}</style>`.
  - It polls `pageReady` every animation frame (stopping after `readyCap`), then calls `reportOpenReady(appId)`.
  - After `revealDelay`, it swaps the arriving style for one with `transition: opacity ${reveal}ms ease` and `opacity: 1`, removes it after the fade, and finally calls `clearOpen()`.
  - The crop rule, if needed: `${topCapsule} img { object-position: 50% 30% !important; }`, layout only.
- [ ] **Step 4: Run** `pnpm vitest run`. Expected: PASS, and the 1.1.1 snapshot still identical (the arriving CSS is a separate stylesheet).
- [ ] **Step 5: Commit** "Game page: arrive after the open transition".

### Task 8: Timeline, bridge and wiring

**Files:**
- Modify: `src/home/openTransition.ts` (rewrite the controller), `src/home/homeNav.ts` (`openGame`, `cancelOpen`), `src/patches/homePage.tsx` (unchanged call, check only)
- Create: `src/home/openBridge.ts`
- Delete: `src/home/OpenOverlay.tsx`, `openOverlayCss` and the `data-gh-leaving` rule in `src/home/homeCss.ts`, and `gameOpenArt` plus the art plumbing only it uses
- Test: `tests/home/openTransition.test.ts` (rewritten)

**Interfaces:**
- Consumes: Tasks 3 to 7.
- Produces:

```ts
export interface OpenDeps {
    navigate(path: string): void;
    startHome(): (() => void) | null;          // applyOpening; null = could not measure (open at once)
    mountBridge(): { fadeOut(ms: number): void; remove(): void } | null;
    markOpen(): void;                          // openIntent.markOpen with the look, mode 'parts' for morph, 'all' otherwise
    onReady(cb: () => void): () => void;       // openIntent.onOpenReady filtered to this appId
    setTimer(fn: () => void, ms: number): unknown; clearTimer(id: unknown): void;
    warn?(message: string, error: unknown): void;
}
export function createOpenTransition(deps: OpenDeps): { open(appId: number, variant: OpenVariant): void; cancel(): void };
```

The hand-over happens at `morph` (morph), `feedHero` (heroFade) or `feedUi` (fade). At the hand-over: `mountBridge`, then `markOpen`, then `navigate`. Then the first of ready or `readyCap` starts `fadeOut(bridgeFade)`, and `remove` follows after `bridgeFade`. Undoing Home's opening state isn't needed after navigating (Steam unmounts Home), but `cancel()` before the hand-over calls it.

`openBridge.mountOpenBridge(root)`:
- clones `.gh-root` into the body at Home's measured box
- adds class `gh-bridge` to the clone (CSS `.gh-bridge, .gh-bridge * { animation: none !important; transition: none !important; pointer-events: none }`), so the hero layer's fade-in doesn't replay
- fades with an inline opacity transition

- [ ] **Step 1: Write the failing tests** (fake timers, fake deps):
  - `morph: hand-over at 360, then navigate after the bridge is up`: the calls are in order `startHome`, then `mountBridge`, `markOpen`, `navigate` (at 360 ms).
  - `ready before the cap fades the bridge at once`: `onReady` fires at 400, so `fadeOut(120)` happens at 400 and `remove` at 520.
  - `no ready: the bridge leaves at readyCap` (Review Focus 2): `fadeOut` happens at 360 + 500.
  - `cannot measure Home: navigate at once` (`startHome` returns null): `navigate` at 0, nothing mounted.
  - `bridge fails: still navigates at the hand-over`.
  - `second open while running is ignored`, and `cancel() before the hand-over undoes Home and never navigates` (Review Focus 5).
  - `cancel() after the hand-over removes the bridge`.
- [ ] **Step 2: Run** `pnpm vitest run tests/home/openTransition.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the controller, `openBridge` and `openGame(appId, source)`.**
  - `openGame` works out `sameGame` (the source is the selected card or the info button, not a feed card), the hero mode (from `HeroBackground`'s current art for that app), `pageRestyled` (`homeMode(settings).restyleDetails`) and the look (`cleanDetails` gives `clean`).
  - It then calls `openVariant` and opens.
  - Callers: `ActionRow` (info button), `SpotlightHome.onRecentsActivate`, `FeedCards` (for those, `sameGame` is false unless the card's app is the selected one).
- [ ] **Step 4: Run** `pnpm vitest run && pnpm tsc --noEmit -p .`. Expected: all PASS, typecheck clean, and no references left to `OpenOverlay`, `openOverlayCss` or `gameOpenArt` (`grep -rn` returns nothing).
- [ ] **Step 5: Commit** "Open transition: morph, hand-over and reveal".

### Task 9: On the Ally, then docs

**Files:**
- Modify: `docs/device-checklist.md` (new rows), `README.md` (its mention of the open transition, if any)

- [ ] **Step 1: Build and serve a test zip.** Only when Michael asks; the rule is no zip until told.
  Run: `scripts/package.sh && cp out/game-glance.zip out/game-glance-test-$(git rev-parse --short HEAD).zip`. The server on port 8765 serves `out/`.
  Expected: Decky installs from `http://192.168.1.11:8765/game-glance.zip`.
- [ ] **Step 2: Frame timing on the real build.** Rerun Task 1's rAF measurement on a real open (docked and handheld).
  Expected: max frame ≤ 16.7 ms during the morph, and the bridge gone within 500 ms of the hand-over.
- [ ] **Step 3: Michael's pass:**
  - Spotlight, Clean, and the Game Glance page off
  - opening from the cards (A), the info button and a feed card
  - a game with no hero art
  - a Unifideck game
  - logo on and off
  - handheld and docked
  - a double press, and reinstalling the plugin during a transition

  Expected: the hero never jumps, there's no visible step at the hand-over, and it feels at least as quick as today.
- [ ] **Step 4: Record results** as checklist rows (one per item above, PASS or the finding) and update the README line.
- [ ] **Step 5: Commit** "Checklist and README: the new open transition".
