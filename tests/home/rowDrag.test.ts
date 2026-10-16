import { describe, expect, it } from 'vitest';
import { CARD_SCALE_DOCKED, recentsGeometry } from '../../src/home/recentsLayout';
import { axisLock, cardTap, dragSteps, dragTarget, flickRun, releaseVelocity, rubberBand, Sample, sheetSwipe, dragView } from '../../src/home/rowDrag';

describe('rowDrag', () => {
    it('axisLock waits for the slop, then picks the larger axis (a tie goes to the row)', () => {
        expect(axisLock(3, 4)).toBeNull();
        expect(axisLock(12, 3)).toBe('x');
        expect(axisLock(-2, -15)).toBe('y');
        expect(axisLock(10, 10)).toBe('x');
    });
    it('dragSteps rounds to the nearest card, a finger moving left stepping to the next one', () => {
        expect(dragSteps(-170, 168)).toBe(1);
        expect(dragSteps(250, 168)).toBe(-1);
        expect(dragSteps(-90, 168)).toBe(1);
        expect(dragSteps(-80, 168)).toBe(0);
        expect(dragSteps(0, 168)).toBe(0);
        // The docked card pitch: the same cases, scaled.
        const step = recentsGeometry(CARD_SCALE_DOCKED).step;
        const k = step / 168;
        expect(dragSteps(-170 * k, step)).toBe(1);
        expect(dragSteps(250 * k, step)).toBe(-1);
        expect(dragSteps(-90 * k, step)).toBe(1);
        expect(dragSteps(-80 * k, step)).toBe(0);
    });
    it('dragTarget clamps to the games and the Library card, never wrapping, and reports the overscroll', () => {
        expect(dragTarget(2, 3, 10)).toEqual({ index: 5, overscroll: 0 });
        expect(dragTarget(1, -4, 10)).toEqual({ index: 0, overscroll: -3 });
        expect(dragTarget(9, 3, 10)).toEqual({ index: 10, overscroll: 2 });
        // No games (the Library card only) and one game.
        expect(dragTarget(0, 2, 0)).toEqual({ index: 0, overscroll: 2 });
        expect(dragTarget(0, -1, 1)).toEqual({ index: 0, overscroll: -1 });
    });
    it('releaseVelocity fits the last 100 ms of samples, even unevenly spaced', () => {
        const line = (ts: number[]): Sample[] => ts.map((t) => ({ t, x: 500 - 2 * t }));
        expect(releaseVelocity(line([0, 16, 32, 48, 64]))).toBeCloseTo(-2, 6);
        expect(releaseVelocity(line([0, 5, 27, 31, 70, 74]))).toBeCloseTo(-2, 6);
        // Older samples (a slow start) don't count: only the last 100 ms.
        const slowThenFast: Sample[] = [{ t: 0, x: 900 }, { t: 100, x: 899 }, { t: 200, x: 898 }, ...line([300, 320, 340, 360, 380])];
        expect(releaseVelocity(slowThenFast)).toBeCloseTo(-2, 6);
        expect(releaseVelocity([{ t: 10, x: 3 }])).toBe(0);
        expect(releaseVelocity([])).toBe(0);
    });
    it('flickRun gives growing delays for the extra steps, none for a slow release, at most 8', () => {
        expect(flickRun(0.3, 168)).toEqual([]);
        expect(flickRun(0, 168)).toEqual([]);
        expect(flickRun(2, 168).map(Math.round)).toEqual([60, 81]);
        expect(flickRun(-2, 168).map(Math.round)).toEqual([60, 81]);
        expect(flickRun(20, 168)).toHaveLength(8);
    });
    it('rubberBand grows ever more slowly and never reaches its limit', () => {
        expect(rubberBand(0, 40)).toBe(0);
        expect(rubberBand(40, 40)).toBeCloseTo(20, 6);
        expect(rubberBand(1e9, 40)).toBeLessThan(40);
        expect(rubberBand(-40, 40)).toBeCloseTo(-20, 6);
    });
    it('dragView gives the card under the finger and only the leftover as the row\'s offset (no spring back on release)', () => {
        // Within the row: the nearest card, and the part of a card still under the finger.
        expect(dragView(-170, 2, 10, 168)).toEqual({ index: 3, offset: -2 });
        expect(dragView(90, 2, 10, 168)).toEqual({ index: 1, offset: -78 });
        expect(dragView(0, 2, 10, 168)).toEqual({ index: 2, offset: 0 });
        // Past the last card (the Library card) or the first game, the leftover is rubber-banded, never more than half a card.
        const end = dragView(-400, 9, 10, 168);
        expect(end.index).toBe(10);
        expect(end.offset).toBeLessThan(0);
        expect(end.offset).toBeGreaterThan(-84);
        expect(end.offset).toBeCloseTo(-rubberBand(232, 84), 6);
        const start = dragView(300, 0, 10, 168);
        expect(start.index).toBe(0);
        expect(start.offset).toBeCloseTo(rubberBand(300, 84), 6);
        // A leftover pulling back from the end is not banded.
        expect(dragView(-140, 9, 10, 168)).toEqual({ index: 10, offset: 28 });
    });
    it('sheetSwipe raises the sheet on a long enough swipe up, lowers it on one down, and ignores sideways or short ones', () => {
        expect(sheetSwipe(4, -70, false)).toBe('raise');
        expect(sheetSwipe(4, -50, false)).toBeNull();
        expect(sheetSwipe(-3, 65, true)).toBe('lower');
        // Already where the swipe would take it: nothing.
        expect(sheetSwipe(0, -80, true)).toBeNull();
        expect(sheetSwipe(0, 80, false)).toBeNull();
        // A sideways drag (the row's) that also moved down a lot is not a sheet swipe.
        expect(sheetSwipe(-200, 70, true)).toBeNull();
    });
    it('cardTap opens the selected card (or the selected Library card) and selects any other', () => {
        expect(cardTap(3, 3)).toBe('open');
        expect(cardTap(2, 3)).toBe('select');
        expect(cardTap(10, 10)).toBe('open');
    });
});
