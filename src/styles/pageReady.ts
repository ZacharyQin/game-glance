/**
 * Whether the game page is ready to be seen after the open transition: Steam's hero image itself has loaded (not the
 * blurred placeholder Steam shows under it while loading: the selector excludes `_blur`), and our title block and
 * Steam's Play row are laid out (an element with no boxes is display: none or detached). Never throws; false when the
 * document or the hero selector (an unknown Steam class) is missing, and the transition's cap then reveals the page.
 */

interface Found {
    complete?: boolean;
    naturalWidth?: number;
    getClientRects(): { length: number };
}
interface Doc {
    querySelector(selector: string): Found | null;
}
export interface ReadySelectors {
    /** The hero <img> in Steam's header (themeCss.arrivalSelectors); null when Steam's class is unknown. */
    headerImg: string | null;
    titleblock: string;
    play: string | null;
}

export function pageReady(doc: Doc | null | undefined, sel: ReadySelectors): boolean {
    if (!doc || !sel.headerImg) return false;
    try {
        const img = doc.querySelector(sel.headerImg);
        if (!img || img.complete !== true || !(Number(img.naturalWidth) > 0)) return false;
        const laidOut = (selector: string | null) => {
            const el = selector ? doc.querySelector(selector) : null;
            return !!el && el.getClientRects().length > 0;
        };
        return laidOut(sel.titleblock) && laidOut(sel.play);
    } catch {
        return false;
    }
}
