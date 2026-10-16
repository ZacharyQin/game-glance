/**
 * Touch on Home's rows (the games row, the feed rows): the maths behind a drag. A tap is the browser's own click (a
 * finger that moves past Chromium's touch slop never makes one); a sideways drag steps the selection like a held stick,
 * one card per card pitch the finger moves (useRowDrag), and a vertical one raises or lowers the feed sheet. All
 * distances are logical px (Home's canvas), velocities logical px per ms. Pure.
 */
export type Axis = 'x' | 'y';

/** How far a finger moves before the drag picks an axis. */
export const DRAG_SLOP = 10;
/** A vertical swipe this long raises the feed sheet (up) or lowers it (down). */
export const SWIPE_SHEET = 60;
/** The slowest release that still flicks on. */
export const FLICK_MIN = 0.5;
/** A flick's steps: its speed times this many ms, in cards. */
const FLICK_MS = 160;
const FLICK_MAX_STEPS = 8;
const FLICK_FIRST_DELAY = 60;
const FLICK_DELAY_GROWTH = 1.35;

/** The axis a drag moves along, once it has passed `slop`; null before. A tie goes to the row (x). */
export function axisLock(dx: number, dy: number, slop = DRAG_SLOP): Axis | null {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < slop) return null;
    return Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
}

/** Whole cards to move for a drag of `dx`, to the nearest card: a finger moving left (dx < 0) selects later cards. */
export function dragSteps(dx: number, step: number): number {
    if (step <= 0) return 0;
    const steps = Math.round(-dx / step);
    return steps === 0 ? 0 : steps; // never -0
}

/** The card `steps` from `start`, clamped to the games and the Library card (0..count); a drag never wraps. */
export function dragTarget(start: number, steps: number, count: number): { index: number; overscroll: number } {
    const wanted = start + steps;
    const index = Math.min(Math.max(wanted, 0), Math.max(count, 0));
    const overscroll = wanted - index;
    return { index, overscroll: overscroll === 0 ? 0 : overscroll };
}

export interface Sample {
    t: number;
    x: number;
}

/** The finger's speed at release: a least-squares slope over the samples of the last `windowMs`; 0 without two. */
export function releaseVelocity(samples: Sample[], windowMs = 100): number {
    if (samples.length < 2) return 0;
    const last = samples[samples.length - 1].t;
    const recent = samples.filter((s) => last - s.t <= windowMs);
    if (recent.length < 2) return 0;
    const n = recent.length;
    const mt = recent.reduce((sum, s) => sum + s.t, 0) / n;
    const mx = recent.reduce((sum, s) => sum + s.x, 0) / n;
    let num = 0;
    let den = 0;
    for (const s of recent) {
        num += (s.t - mt) * (s.x - mx);
        den += (s.t - mt) ** 2;
    }
    return den === 0 ? 0 : num / den;
}

/** A flick's extra steps after release, as the delay before each (they grow, so the run slows down); none when slow. */
export function flickRun(velocity: number, step: number): number[] {
    const speed = Math.abs(velocity);
    if (speed < FLICK_MIN || step <= 0) return [];
    const steps = Math.min(FLICK_MAX_STEPS, Math.round((speed * FLICK_MS) / step));
    return Array.from({ length: steps }, (_, i) => FLICK_FIRST_DELAY * FLICK_DELAY_GROWTH ** i);
}

/** How far the row gives past its ends for an overscroll of `overscroll` px: ever slower, never reaching `limit`. */
export function rubberBand(overscroll: number, limit: number): number {
    if (overscroll === 0 || limit <= 0) return 0;
    return Math.sign(overscroll) * limit * (1 - 1 / (1 + Math.abs(overscroll) / limit));
}

/** A tap on card `index` with `focused` selected: the selected card opens, any other is selected. */
export function cardTap(index: number, focused: number): 'select' | 'open' {
    return index === focused ? 'open' : 'select';
}
