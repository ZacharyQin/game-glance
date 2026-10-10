import { describe, expect, it } from 'vitest';
import { FAST_CYCLE_MS, settleCycle, startCycle, stepCycle } from '../../src/home/fastCycle';
import { BUMPER_REPEAT_MS } from '../../src/home/focusZones';

describe('FAST_CYCLE_MS', () => {
    it("is longer than a held bumper's repeat (holding L1/R1 is one run) and short enough to feel at once", () => {
        expect(FAST_CYCLE_MS).toBeGreaterThan(BUMPER_REPEAT_MS);
        expect(FAST_CYCLE_MS).toBeLessThanOrEqual(300);
    });
});

describe('stepCycle', () => {
    it('a step from rest is shown at once', () => {
        const s = stepCycle(startCycle(0, 0), 1, 1000);
        expect(s).toEqual({ shown: 1, at: 1, last: 1000, cycling: false });
    });
    it('a step soon after the last one starts a run: the screen holds what it shows, only the selection moves', () => {
        let s = stepCycle(startCycle(0, 0), 1, 1000);
        s = stepCycle(s, 2, 1000 + FAST_CYCLE_MS - 1);
        expect(s).toMatchObject({ shown: 1, at: 2, cycling: true });
        s = stepCycle(s, 3, 1000 + 2 * FAST_CYCLE_MS - 2);
        expect(s).toMatchObject({ shown: 1, at: 3, cycling: true });
    });
    it('each step of a run restarts the wait (a held bumper never settles on the games it passes)', () => {
        let s = stepCycle(startCycle(0, 0), 1, 1000);
        s = stepCycle(s, 2, 1100);
        expect(s.last).toBe(1100);
    });
    it('a step after the screen has rested is shown at once again', () => {
        let s = stepCycle(startCycle(0, 0), 1, 1000);
        s = stepCycle(s, 2, 1000 + FAST_CYCLE_MS);
        expect(s).toEqual({ shown: 2, at: 2, last: 1000 + FAST_CYCLE_MS, cycling: false });
    });
    it('the same selection again is no step, at rest or in a run (Home re-renders for other reasons): the very same state', () => {
        const rest = startCycle(4, 0);
        expect(stepCycle(rest, 4, 10)).toBe(rest);
        let run = stepCycle(startCycle(0, 0), 1, 1000);
        run = stepCycle(run, 2, 1050);
        expect(stepCycle(run, 2, 1100)).toBe(run);
    });
});

describe('settleCycle', () => {
    it('ends a run on the selection: shown at once', () => {
        let s = stepCycle(startCycle(0, 0), 1, 1000);
        s = stepCycle(s, 5, 1100);
        expect(settleCycle(s)).toEqual({ shown: 5, at: 5, last: 1100, cycling: false });
    });
    it('outside a run it is the same state', () => {
        const s = startCycle(3, 0);
        expect(settleCycle(s)).toBe(s);
    });
});
