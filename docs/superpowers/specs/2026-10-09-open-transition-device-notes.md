# Open transition: device notes (Task 1)

Measured on the ROG Xbox Ally, 2026-10-09:
- docked at 1500×844 CSS px, 120 Hz
- handheld at 828×466 CSS px; Home's canvas scale 0.575

Both modes render 1920×1080 physical pixels. The game used is Metro 2033 Redux (286690): full hero art, all three chips, the cloud button.

## Fixtures

`tests/home/fixtures/openLayout/` holds `home-`, `spotlight-` and `clean-` at `1500x844` and `828x466`, captured with `scripts/cef-layout.mjs`.
- Rectangles are CSS px of the Big Picture window.
- They contain only the game's own texts.
- The page's stat columns were captured before `data-stat` existed:
  - the info card's columns are `col0`, `col1`
  - the HowLongToBeat card's are `hltb`, `mainExtras`, `completionist`
  - the Clean panel's are `col0..2`

  Tests map them by order.

A check of the theme's formula, docked Spotlight: the Play row top is predicted at
`844 − 41 − (96 + 178 + 24) × 1500/1440 = 492.6`, and measured at 493.1.

## Hero crop

- The game page's header shows `library_hero.jpg` at `object-fit: cover; object-position: 50% 50%`.
- Home's hero is `background-size: cover; background-position: 50% 30%`.
- For Steam's standard 1920×620 heroes the result is identical: the image is wider than the screen, so it fills the height and the vertical position does nothing. Art with a taller shape would differ.
- **Task 7 pins the page's hero to `object-position: 50% 30%`.**
- While loading, the header also shows `library_hero_blur.jpg` (192×62, stretched) under the hero. So the page's "ready" check must wait for the hero image itself, not the blurred one.

## Frame timing

A throwaway script on the live Home played the morph on Home's real elements (translate and opacity on the title block, action row, store pill and chip texts; the cards row leaving; the scrims fading). It recorded `requestAnimationFrame` deltas over 600 ms, with runs interleaved and 1.5 s pauses between them.

A single missed frame at 120 Hz reads as 16.6–17.4 ms because of timer jitter; 25 ms or more means two or more in a row.

| Variant | Docked, worst frame | Handheld, worst frame |
|---|---|---|
| Moves only (title, buttons, chip text) | 15.7–16.8 | 16.6–20 (38 on a cold first run) |
| Glass of each chip grows (scaled `::before`, blur) | 16.6–17.4 | 32–43 |
| Same, no blur while moving | 15.8–16.8 | 25–31 |
| Glass grows by `clip-path` (blur) | 16.6–25 | 21–26 |
| Scale + `will-change` | 16.6–32.6 | not run (worse docked) |
| Two card panels fade in, no blur | not run | 17.5–20.5 |
| Two card panels fade in, blur | not run | 18–21 (53 cold) |
| **Two card panels grow, no blur** | not run (expected below the 3-chip numbers) | **22–23, steady** |

**Decision (Michael):** two panels grow. One glass panel per page target:
- Spotlight: the info card and the HowLongToBeat card
- Clean: the panel

Each panel is grown by `transform: scale` from the box around the chips that map into it.
- No backdrop blur while moving; instead a more opaque fill, `rgba(12,16,22,.55)`.
- The chips' own glass fades out.
- The page's real, blurred cards take over at the hand-over.
- No `will-change`.

The moving title, buttons and texts stay as specified.

## Differences from the spec

- **Clean has an Achievements column** when the game has achievements, so on every look a chip moves to the page stat with the same key, and fades only when there is none.
- **The HowLongToBeat Main column is tagged `data-stat="hltb"`**, the same key as Clean's stat and Home's chip.
- **The shells are per card, not per chip** (the decision above).
