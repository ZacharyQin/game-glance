import { useEffect, useState } from 'react';
import { BUMPER_REPEAT_MS } from './focusZones';

/**
 * Fast cycling (a quick run of L1/R1 or Left/Right through the games). The first step from rest is shown at once; a step
 * that follows the last one within FAST_CYCLE_MS starts a run, during which the screen holds what it showed (hero art,
 * accent, the wide card) and only the selection moves along the narrow cards. FAST_CYCLE_MS after the last step the run
 * ends on the selection, shown at once. Each shown game otherwise cost a restyle of the whole of Home (the accent) and its
 * images' decodes on every step (probed on the Ally: 20-60 ms a step, freezes of up to 600 ms).
 */

/** Longer than a held bumper's repeat, so holding L1/R1 is one run. */
export const FAST_CYCLE_MS = Math.max(250, BUMPER_REPEAT_MS + 50);

export interface CycleState {
    /** The selection the screen shows. */
    shown: number;
    /** The selection itself (where the last step went). */
    at: number;
    /** When the selection last changed (ms). */
    last: number;
    /** In a run: the screen holds `shown` while the selection moves on. */
    cycling: boolean;
}

export function startCycle(index: number, now: number): CycleState {
    return { shown: index, at: index, last: now, cycling: false };
}

/** The state after the selection becomes `index` at `now`; the same state when it already is. Pure. */
export function stepCycle(state: CycleState, index: number, now: number): CycleState {
    if (index === state.at) return state;
    if (now - state.last < FAST_CYCLE_MS) return { shown: state.shown, at: index, last: now, cycling: true };
    return { shown: index, at: index, last: now, cycling: false };
}

/** A run ends on the selection (its wait is over, or something needs the screen to match it now). Pure. */
export function settleCycle(state: CycleState): CycleState {
    return state.cycling || state.shown !== state.at ? { ...state, shown: state.at, cycling: false } : state;
}

/**
 * The selection the screen shows for `index`, whether a run is on, and `settle()` to end a run at once (opening the
 * selected game: the screen must show it). React glue for stepCycle/settleCycle.
 */
export function useFastCycle(index: number): { shown: number; cycling: boolean; settle(): void } {
    const [state, setState] = useState(() => startCycle(index, 0));
    const current = stepCycle(state, index, Date.now());
    // Applied during render (React's "adjust state when a prop changes"): the step's first frame already holds or shows.
    if (current !== state) setState(current);
    useEffect(() => {
        if (!state.cycling) return undefined;
        const timer = setTimeout(() => setState(settleCycle), FAST_CYCLE_MS);
        return () => clearTimeout(timer);
    }, [state.cycling, state.last]);
    return { shown: current.shown, cycling: current.cycling, settle: () => setState(settleCycle) };
}
