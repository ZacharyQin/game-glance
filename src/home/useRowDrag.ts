import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Axis, axisLock, dragSteps, dragTarget, flickRun, releaseVelocity, rubberBand, Sample } from './rowDrag';

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
 * A row under a finger (rowDrag): a sideways drag steps the selection one card per `step` px, the row following the
 * finger (`dx`, rubber-banded past the ends); on release a flick runs on a few cards, slowing down. A vertical swipe is
 * left to bubble up (SpotlightHome raises or lowers the feed sheet). One finger only (the primary pointer); Steam taking the touch (pointercancel) ends the run.
 */
export function useRowDrag(options: RowDragOptions): { dx: number; dragging: boolean; handlers: { onPointerDown: Handler; onPointerMove: Handler; onPointerUp: Handler; onPointerCancel: Handler } } {
    const opts = useRef(options);
    opts.current = options;
    const [state, setState] = useState({ dragging: false, dx: 0 });
    const gesture = useRef<Gesture | null>(null);
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
            event.currentTarget.setPointerCapture?.(event.pointerId);
            opts.current.onRun(true);
        }
        if (g.axis !== 'x') return;
        const native = event.nativeEvent as PointerEvent;
        const points = native.getCoalescedEvents?.() ?? [];
        for (const p of points.length > 0 ? points : [native]) g.samples.push({ t: p.timeStamp, x: logical(p.clientX) });
        if (g.samples.length > 64) g.samples.splice(0, g.samples.length - 64);
        const { step } = g;
        const { count } = opts.current;
        const dx = logical(event.clientX - g.x0);
        const target = dragTarget(g.start, dragSteps(dx, step), count);
        if (target.index !== g.last) {
            g.last = target.index;
            opts.current.onSelect(target.index);
        }
        // Past the first or last card the row gives ever less (finger left: dx < 0 reaches later cards).
        const minDx = -(count - g.start) * step;
        const maxDx = g.start * step;
        const shown = dx < minDx ? minDx + rubberBand(dx - minDx, step * 0.5) : dx > maxDx ? maxDx + rubberBand(dx - maxDx, step * 0.5) : dx;
        setState({ dragging: true, dx: shown });
    };
    const onPointerUp: Handler = (event) => {
        const g = gesture.current;
        if (!g || event.pointerId !== g.id) return;
        gesture.current = null;
        if (g.axis !== 'x') return;
        setState({ dragging: false, dx: 0 });
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
        flick.current = delays.map((delay, i) => {
            when += delay;
            return setTimeout(() => {
                const next = dragTarget(at, direction, opts.current.count).index;
                if (next !== at) {
                    at = next;
                    opts.current.onSelect(at);
                }
                if (i === delays.length - 1) {
                    flick.current = [];
                    opts.current.onRun(false);
                }
            }, when);
        });
    };
    const onPointerCancel: Handler = (event) => {
        const g = gesture.current;
        if (!g || event.pointerId !== g.id) return;
        gesture.current = null;
        if (g.axis !== 'x') return;
        setState({ dragging: false, dx: 0 });
        opts.current.onRun(false);
    };
    return { dx: state.dx, dragging: state.dragging, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
