import { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Axis, axisLock, dragTarget, dragView, flickRun, releaseVelocity, Sample } from './rowDrag';

export interface RowDragOptions {
    /** The selected card, and the last one (the games row: the Library card). */
    index: number;
    count: number;
    /** The card pitch, logical px. */
    step: number;
    /** Screen px per logical px (Home's canvas, as drawn). */
    scale(): number;
    onSelect(next: number): void;
    /** A drag (and its flick) is a run, like a held stick: the hero holds until it ends (home/fastCycle). */
    onRun(running: boolean): void;
    /** False stops a flick between steps (a game opening, the row gone): no selection moves under the transition. */
    canStep?(): boolean;
}

interface Gesture {
    id: number;
    x0: number;
    y0: number;
    axis: Axis | null;
    start: number;
    last: number;
    /** The card pitch when the drag began: a feed row's cards differ in width, and the step must not change mid-drag. */
    step: number;
    samples: Sample[];
}

type Handler = (event: ReactPointerEvent<HTMLElement>) => void;

/**
 * A row under a finger (rowDrag): a sideways drag steps the selection one card per `step` px; the row's `offset` is the
 * finger's movement beyond the selected card's place (rubber-banded past the ends), so the layout carries the row and a
 * release only settles that remainder. On release a flick runs on a few cards, slowing down, and stops at the row's end.
 * A sideways drag never ends in a click (a short quick slide can pass Chromium's tap slop): it is swallowed. A vertical
 * swipe is left to bubble up (SpotlightHome raises or lowers the feed sheet). One finger only (the primary pointer);
 * Steam taking the touch (pointercancel) ends the run.
 */
export function useRowDrag(options: RowDragOptions): {
    offset: number;
    dragging: boolean;
    handlers: { onPointerDown: Handler; onPointerMove: Handler; onPointerUp: Handler; onPointerCancel: Handler; onClickCapture(event: ReactMouseEvent): void };
} {
    const opts = useRef(options);
    opts.current = options;
    const [state, setState] = useState({ dragging: false, offset: 0 });
    const gesture = useRef<Gesture | null>(null);
    // The last gesture was a sideways drag: the click it may still produce is not a tap.
    const dragged = useRef(false);
    const flick = useRef<Array<ReturnType<typeof setTimeout>>>([]);
    const stopFlick = () => {
        if (flick.current.length === 0) return;
        flick.current.forEach(clearTimeout);
        flick.current = [];
        opts.current.onRun(false);
    };
    useEffect(() => () => flick.current.forEach(clearTimeout), []);
    const logical = (px: number) => px / (opts.current.scale() || 1);

    const onPointerDown: Handler = (event) => {
        if (!event.isPrimary) return;
        stopFlick();
        dragged.current = false;
        gesture.current = { id: event.pointerId, x0: event.clientX, y0: event.clientY, axis: null, start: opts.current.index, last: opts.current.index, step: opts.current.step, samples: [] };
    };
    const onPointerMove: Handler = (event) => {
        const g = gesture.current;
        if (!g || event.pointerId !== g.id) return;
        if (g.axis === null) {
            g.axis = axisLock(logical(event.clientX - g.x0), logical(event.clientY - g.y0));
            if (g.axis !== 'x') return;
            // The row follows from here: no jump by the slop.
            g.x0 = event.clientX;
            dragged.current = true;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            opts.current.onRun(true);
        }
        if (g.axis !== 'x') return;
        const native = event.nativeEvent as PointerEvent;
        const points = native.getCoalescedEvents?.() ?? [];
        for (const p of points.length > 0 ? points : [native]) g.samples.push({ t: p.timeStamp, x: logical(p.clientX) });
        if (g.samples.length > 64) g.samples.splice(0, g.samples.length - 64);
        const view = dragView(logical(event.clientX - g.x0), g.start, opts.current.count, g.step);
        if (view.index !== g.last) {
            g.last = view.index;
            opts.current.onSelect(view.index);
        }
        setState({ dragging: true, offset: view.offset });
    };
    const onPointerUp: Handler = (event) => {
        const g = gesture.current;
        if (!g || event.pointerId !== g.id) return;
        gesture.current = null;
        if (g.axis !== 'x') return;
        setState({ dragging: false, offset: 0 });
        const velocity = releaseVelocity(g.samples);
        const delays = flickRun(velocity, g.step);
        if (delays.length === 0) {
            opts.current.onRun(false);
            return;
        }
        // A finger moving left (velocity < 0) runs on to later cards.
        const direction = velocity < 0 ? 1 : -1;
        let at = g.last;
        let when = 0;
        const steps = delays.map((delay) => {
            when += delay;
            return setTimeout(() => {
                const next = dragTarget(at, direction, opts.current.count).index;
                // At the row's end (or with a game opening) the flick is over: the art catches up at once.
                if (next === at || opts.current.canStep?.() === false) {
                    stopFlick();
                    return;
                }
                at = next;
                opts.current.onSelect(at);
            }, when);
        });
        // After the last step the run ends.
        flick.current = [...steps, setTimeout(stopFlick, when + 1)];
    };
    const onPointerCancel: Handler = (event) => {
        const g = gesture.current;
        if (!g || event.pointerId !== g.id) return;
        gesture.current = null;
        if (g.axis !== 'x') return;
        setState({ dragging: false, offset: 0 });
        opts.current.onRun(false);
    };
    const onClickCapture = (event: ReactMouseEvent) => {
        if (!dragged.current) return;
        dragged.current = false;
        event.stopPropagation();
        event.preventDefault();
    };
    return { offset: state.offset, dragging: state.dragging, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture } };
}
