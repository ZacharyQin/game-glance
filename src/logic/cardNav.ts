/**
 * The controller on the game page's cards (#24). The cards sit under the Play row on screen, but in Steam's focus tree
 * they come before its Play section (they live in the page's header; probed on the Ally), so Steam's own Up and Down
 * ran the wrong way: Up from Play into the cards, Down from them back to Play. Home routes these four presses itself,
 * in the screen's order: Play row, cards, the page's tabs (where Down from Play went). Pure.
 */

/** Steam's d-pad button numbers in its vgp_onbuttondown events (probed on the Ally; 11 and 12 are Left and Right). */
export const DPAD_UP = 9;
export const DPAD_DOWN = 10;

/** The class on a card the controller can select. */
export const CARD_NAV = 'gg-card-nav';

/** Where focus is, for these presses: the Play row (Play, its arrow, the circles, the cloud), a card, the page's tabs. */
export type CardZone = 'play' | 'cards' | 'tabs';

/** Where `button` pressed in `zone` goes; null: Steam's own move (also when no card can be selected). */
export function cardNavTarget(zone: CardZone | null, button: number, hasCards: boolean): CardZone | null {
    if (!hasCards) return null;
    if (zone === 'play' && button === DPAD_DOWN) return 'cards';
    if (zone === 'cards') return button === DPAD_UP ? 'play' : button === DPAD_DOWN ? 'tabs' : null;
    if (zone === 'tabs' && button === DPAD_UP) return 'cards';
    return null;
}

/** The zone of `el` (the press's target): `play` is Steam's Play row's selectors, null when its classes are unknown. */
export function cardZoneOf(el: Element | null, sel: { play: string | null; tabs: string }): CardZone | null {
    if (!el) return null;
    if (el.closest(`.${CARD_NAV}`)) return 'cards';
    if (sel.play && el.closest(sel.play)) return 'play';
    if (el.closest(sel.tabs)) return 'tabs';
    return null;
}
