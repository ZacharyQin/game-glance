import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOpenTransition, OpenDeps } from '../../src/home/openTransition';

/** Fake deps that log every call with the fake clock's time. */
function setup(over: Partial<OpenDeps> = {}) {
    const log: string[] = [];
    const at = (what: string) => log.push(`${what}@${Date.now()}`);
    let ready: (() => void) | null = null;
    const bridge = { fadeOut: vi.fn((ms: number) => at(`fadeOut(${ms})`)), remove: vi.fn(() => at('remove')) };
    const undo = vi.fn(() => at('undoHome'));
    const deps: OpenDeps = {
        navigate: vi.fn((path: string) => at(`navigate ${path}`)),
        startHome: vi.fn(() => (at('startHome'), undo)),
        mountBridge: vi.fn(() => (at('mountBridge'), bridge)),
        markOpen: vi.fn(() => at('markOpen')),
        onReady: vi.fn((cb: () => void) => {
            ready = cb;
            return () => {
                ready = null;
            };
        }),
        setTimer: (fn, ms) => setTimeout(fn, ms),
        clearTimer: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
        ...over,
    };
    return { t: createOpenTransition(deps), deps, log, bridge, undo, fireReady: () => ready?.() };
}

describe('openTransition', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('morph: Home moves at once; at 360 the bridge goes up, the intent is marked, then the page opens', () => {
        const { t, log } = setup();
        t.open(620, 'morph');
        expect(log).toEqual(['startHome@0']);
        vi.advanceTimersByTime(359);
        expect(log).toHaveLength(1);
        vi.advanceTimersByTime(1);
        expect(log).toEqual(['startHome@0', 'mountBridge@360', 'markOpen@360', 'navigate /library/app/620@360']);
    });

    it('the hand-over comes at 300 for a feed card (heroFade) and 220 for a plain fade', () => {
        const a = setup();
        a.t.open(1, 'heroFade');
        vi.advanceTimersByTime(300);
        expect(a.log).toContain('navigate /library/app/1@300');
        const b = setup();
        b.t.open(2, 'fade');
        vi.advanceTimersByTime(220);
        expect(b.log).toContain('navigate /library/app/2@520');
    });

    it('ready before the cap fades the bridge at once, then removes it', () => {
        const { t, log, fireReady } = setup();
        t.open(620, 'morph');
        vi.advanceTimersByTime(400);
        fireReady();
        expect(log).toContain('fadeOut(120)@400');
        vi.advanceTimersByTime(120);
        expect(log).toContain('remove@520');
    });

    it("once the bridge is gone Home's opening state is undone (Steam may keep Home, or bring it back on B: it was left mid-open)", () => {
        const { t, undo, fireReady } = setup();
        t.open(620, 'morph');
        vi.advanceTimersByTime(400);
        fireReady();
        expect(undo).not.toHaveBeenCalled();
        vi.advanceTimersByTime(120);
        expect(undo).toHaveBeenCalledTimes(1);
    });

    it('no ready: the bridge leaves at the cap (500 ms after the hand-over)', () => {
        const { t, log } = setup();
        t.open(620, 'morph');
        vi.advanceTimersByTime(859);
        expect(log.some((l) => l.startsWith('fadeOut'))).toBe(false);
        vi.advanceTimersByTime(1);
        expect(log).toContain('fadeOut(120)@860');
        vi.advanceTimersByTime(120);
        expect(log).toContain('remove@980');
    });

    it('Home cannot be measured: the page opens at once, nothing mounted', () => {
        const { t, deps, log } = setup({ startHome: vi.fn(() => null) });
        t.open(620, 'morph');
        expect(log).toEqual(['navigate /library/app/620@0']);
        vi.advanceTimersByTime(2000);
        expect(deps.mountBridge).not.toHaveBeenCalled();
    });

    it('a bridge that cannot be mounted still lets the page open at the hand-over', () => {
        const { t, log } = setup({ mountBridge: vi.fn(() => { throw new Error('no body'); }) });
        t.open(620, 'morph');
        vi.advanceTimersByTime(360);
        expect(log).toContain('navigate /library/app/620@360');
    });

    it('a second open while one runs is ignored', () => {
        const { t, deps } = setup();
        t.open(620, 'morph');
        t.open(700, 'morph');
        vi.advanceTimersByTime(2000);
        expect(deps.navigate).toHaveBeenCalledTimes(1);
        expect(deps.navigate).toHaveBeenCalledWith('/library/app/620');
    });

    it('cancel before the hand-over undoes Home and never opens the page', () => {
        const { t, deps, undo } = setup();
        t.open(620, 'morph');
        vi.advanceTimersByTime(200);
        t.cancel();
        vi.advanceTimersByTime(2000);
        expect(undo).toHaveBeenCalledTimes(1);
        expect(deps.navigate).not.toHaveBeenCalled();
        expect(deps.mountBridge).not.toHaveBeenCalled();
    });

    it('cancel after the hand-over removes the bridge and restores Home; a later ready does nothing', () => {
        const { t, bridge, undo, fireReady } = setup();
        t.open(620, 'morph');
        vi.advanceTimersByTime(400);
        t.cancel();
        expect(bridge.remove).toHaveBeenCalledTimes(1);
        expect(undo).toHaveBeenCalledTimes(1);
        fireReady();
        vi.advanceTimersByTime(2000);
        expect(bridge.fadeOut).not.toHaveBeenCalled();
        expect(bridge.remove).toHaveBeenCalledTimes(1);
    });

    it('after it finishes, a new open runs', () => {
        const { t, deps } = setup();
        t.open(620, 'morph');
        vi.advanceTimersByTime(2000);
        t.open(700, 'fade');
        vi.advanceTimersByTime(2000);
        expect(deps.navigate).toHaveBeenCalledTimes(2);
    });
});
