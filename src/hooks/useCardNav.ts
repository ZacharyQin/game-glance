import { useEffect } from 'react';
import { LOG_PREFIX } from '../constants';
import { focusElement } from '../home/homeNav';
import { CARD_NAV, cardNavTarget, cardZoneOf, CardZone } from '../logic/cardNav';
import { playRow } from '../styles/theme';

/** The page's tabs (Steam's What's New, Game Info, ...): where Down from Play goes (probed on the Ally). */
const TABS = '[role="tab"]';

/** Where a routed press lands: the card last selected (or the first), the Play pill, the selected tab (or the first). */
function landing(doc: Document, to: CardZone, play: string, lastCard: HTMLElement | null): HTMLElement | null {
    if (to === 'cards') return lastCard?.isConnected ? lastCard : doc.querySelector<HTMLElement>(`.${CARD_NAV}`);
    if (to === 'play') return doc.querySelector<HTMLElement>(`${play.split(', ')[0]} [role="button"]`);
    return doc.querySelector<HTMLElement>(`${TABS}[aria-selected="true"]`) ?? doc.querySelector<HTMLElement>(TABS);
}

/** Brings `el` into view when it is not, as Steam's own moves scroll the page (focusElement does not scroll). */
function reveal(el: HTMLElement) {
    try {
        const r = el.getBoundingClientRect();
        const h = el.ownerDocument.defaultView?.innerHeight ?? 0;
        if (h > 0 && (r.top < 0 || r.bottom > h)) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {
        // stays where it is
    }
}

/**
 * The controller between the game page's Play row, its cards and its tabs, in the screen's order (logic/cardNav): Steam's
 * own Up and Down ran the wrong way there. Listens for Steam's controller events (vgp_onbuttondown) on the page's
 * document while `active` (the restyled page with a selectable card); a press it routes is not Steam's (preventDefault).
 */
export function useCardNav(doc: Document | null, active: boolean) {
    useEffect(() => {
        const play = playRow();
        if (!doc || !active || !play) return undefined;
        let lastCard: HTMLElement | null = null;
        const onFocus = (e: Event) => {
            const card = (e.target as Element | null)?.closest?.(`.${CARD_NAV}`);
            if (card) lastCard = card as HTMLElement;
        };
        const onButton = (e: Event) => {
            try {
                const button = Number((e as CustomEvent<{ button?: number }>).detail?.button);
                const hasCards = !!doc.querySelector(`.${CARD_NAV}`);
                const to = cardNavTarget(cardZoneOf(e.target as Element | null, { play, tabs: TABS }), button, hasCards);
                if (!to) return;
                const el = landing(doc, to, play, lastCard);
                if (!el) return;
                e.preventDefault();
                e.stopPropagation();
                focusElement(el, `the page's ${to}`);
                reveal(el);
            } catch (error) {
                console.warn(`${LOG_PREFIX} game page: card navigation failed`, error);
            }
        };
        doc.addEventListener('focusin', onFocus, true);
        doc.addEventListener('vgp_onbuttondown', onButton, true);
        return () => {
            doc.removeEventListener('focusin', onFocus, true);
            doc.removeEventListener('vgp_onbuttondown', onButton, true);
        };
    }, [doc, active]);
}
