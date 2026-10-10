import { RefObject, useEffect, useState } from 'react';
import { clearOpen, OpenIntent, openPending, reportOpenReady } from '../data/openIntent';
import { OPEN_TIMINGS } from '../home/motion';
import { pageReady } from '../styles/pageReady';
import { pageArrivalSelectors } from '../styles/theme';
import { ARRIVE_BLUR_MS } from '../styles/themeCss';

type Phase = 'hidden' | 'revealing' | 'done';

/**
 * The game page's side of Spotlight Home's open transition (data/openIntent). Read on the page's first render, so its
 * very first frame is already in the arriving state: until the page is ready (styles/pageReady, checked every frame)
 * its new parts (or, mode 'all', the whole page but its art) stay hidden; then it tells Home (which lets its frozen
 * copy fade), waits OPEN_TIMINGS.revealDelay, and fades them in over OPEN_TIMINGS.reveal. A page that is not ready
 * within OPEN_TIMINGS.readyCap is revealed anyway (Home's copy has left by then). Null when there is no open to
 * arrive from (or it is over): the page is as always.
 */
/**
 * How long the page stays in its arriving state once revealed: until its new parts have faded in and its glass has
 * grown its blur (the stylesheet carries that transition; dropping it mid-way would cancel it, the blur jumping in).
 */
export function arrivalHoldMs(): number {
    return Math.max(OPEN_TIMINGS.reveal, ARRIVE_BLUR_MS);
}

export function useOpenArrival(ref: RefObject<HTMLElement | null>, appId: number): { intent: OpenIntent; revealed: boolean } | null {
    const [intent] = useState(() => openPending(appId));
    const [phase, setPhase] = useState<Phase>(() => (intent && intent.look !== 'steam' ? 'hidden' : 'done'));

    useEffect(() => {
        if (phase !== 'hidden') return undefined;
        const win = ref.current?.ownerDocument?.defaultView ?? window;
        // Home drew the description as it opened: the page's must be there before Home's copy fades onto it.
        const sel = { ...pageArrivalSelectors(), desc: intent?.homeDesc ? '.gg-desc' : null };
        const started = Date.now();
        let alive = true;
        let frame = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const reveal = () => {
            if (!alive) return;
            setPhase('revealing');
            timer = setTimeout(() => {
                if (!alive) return;
                setPhase('done');
                clearOpen();
            }, arrivalHoldMs());
        };
        const check = () => {
            if (!alive) return;
            if (pageReady(ref.current?.ownerDocument as unknown as Parameters<typeof pageReady>[0], sel)) {
                reportOpenReady(appId);
                timer = setTimeout(reveal, OPEN_TIMINGS.revealDelay);
                return;
            }
            if (Date.now() - started >= OPEN_TIMINGS.readyCap) return reveal();
            frame = win.requestAnimationFrame(check);
        };
        check();
        return () => {
            alive = false;
            win.cancelAnimationFrame(frame);
            if (timer !== undefined) clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, appId]);

    if (!intent || intent.look === 'steam' || phase === 'done') return null;
    return { intent, revealed: phase === 'revealing' };
}
