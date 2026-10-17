import { PAGE_LAYOUT, PAGE_TYPE, pillFocusScale, TypeRole } from '../styles/themeCss';
import { HOME_PILL, TITLE_BLOCK } from './homeCss';
import { HOME_CHIP_FONTS, HomeRects } from './openMotion';
import type { Box, PageLook, PageStat, PageTargets, StatKey } from './openTargets';

/**
 * The open transition's text twins (spec docs/superpowers/specs/2026-10-17-open-text-twins-design.md): each moving text
 * is drawn again at the page's own size and type (themeCss.PAGE_TYPE), in Home's unscaled extras layer, where the page
 * puts it. It starts transformed onto Home's text and ends untransformed, so at the hand-over it is the page's text as
 * the page draws it (Home's text scaled up never was: text does not scale linearly). Positions are root px. Pure.
 */

/** The point of a twin that is placed and scaled about: top-left, bottom-left, or the left end of its centre line. */
export type TwinOrigin = 'top' | 'base' | 'midline';

export interface TwinSpec {
    name: string;
    role: TypeRole;
    text: string;
    /** The origin point's place, root px. */
    x: number;
    y: number;
    origin: TwinOrigin;
    /** Transforms about the origin: onto Home's text at the start, and the end (none, or the focused pill's scale). */
    from: string;
    to: string;
    /** Drawn in the accent (Spotlight's HowLongToBeat time). */
    accent: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const anchor = (b: Box, origin: TwinOrigin) => ({ x: b.x, y: origin === 'top' ? b.y : origin === 'base' ? b.y + b.h : b.y + b.h / 2 });

/** The transform that puts a twin anchored at `at` onto Home's `home` box (the same origin point), scaled by `scale`. */
export function twinFrom(home: Box, at: { x: number; y: number }, scale: number, origin: TwinOrigin): string {
    const a = anchor(home, origin);
    return `translate(${r2(a.x - at.x)}px, ${r2(a.y - at.y)}px) scale(${r4(scale)})`;
}

/**
 * The twins for an open: the title (null `texts.title`: a logo, none), the eyebrow, the Play label, and each chip that
 * becomes a page column, its label and value in the page's own words (`stats`). Spotlight's HowLongToBeat column has no
 * label twin (the page names it in its card) and its value is in the accent. `focused`: the page will show Play focused.
 * `canvasScale`: Home's canvas scale, which is also the page's d unit.
 */
export function twinSpecs(home: HomeRects, page: PageTargets, texts: { title: string | null; eyebrow: string; play: string }, stats: PageStat[], look: PageLook, focused: boolean, canvasScale: number): TwinSpec[] {
    const ox = home.root?.x ?? 0;
    const oy = home.root?.y ?? 0;
    const local = (b: Box): Box => ({ x: b.x - ox, y: b.y - oy, w: b.w, h: b.h });
    const out: TwinSpec[] = [];
    const add = (name: string, role: TypeRole, text: string, homeBox: Box, at: { x: number; y: number }, origin: TwinOrigin, homeFont: number, extra: Partial<TwinSpec> = {}) => {
        const where = { x: r2(at.x - ox), y: r2(at.y - oy) };
        out.push({ name, role, text, ...where, origin, from: twinFrom(local(homeBox), where, homeFont / PAGE_TYPE[role].size, origin), to: 'none', accent: false, ...extra });
    };

    if (texts.title !== null && home.titleText !== false) add('title', 'title', texts.title, home.titleSlot, page.titleBottomLeft, 'base', TITLE_BLOCK.titleSize);
    add('eyebrow', 'eyebrow', texts.eyebrow, home.eyebrow, page.eyebrowBottomLeft, 'base', PAGE_TYPE.eyebrow.size);

    // The Play label: Home's sits after its border, inset and glyph, on the pill's centre line (as openMotion places it).
    // Home's canvas and the page share one scale (openMotion: d = s).
    const s = canvasScale;
    const homeLabel: Box = { x: home.play.x + (HOME_PILL.border + HOME_PILL.padX + HOME_PILL.icon + HOME_PILL.gap) * s, y: home.play.y, w: 0, h: home.play.h };
    const pill = PAGE_LAYOUT.pill;
    const playAt = { x: page.play.x + (pill.padX + pill.icon + pill.iconGap) * s, y: page.play.y + page.play.h / 2 };
    let playTo = 'none';
    if (focused) {
        // The focused pill grows about its centre: the label lands where the page's, inside it, does.
        const pf = pillFocusScale(PAGE_LAYOUT.playW, PAGE_LAYOUT.icon);
        const cx = page.play.x + page.play.w / 2;
        playTo = `translate(${r2((cx - playAt.x) * (1 - pf.x))}px, 0px) scale(${pf.x}, ${pf.y})`;
    }
    add('play', 'playLabel', texts.play, homeLabel, playAt, 'midline', HOME_PILL.font, { to: playTo });

    const words = new Map(stats.map((st) => [st.key, st]));
    for (const chip of home.chips) {
        const key = chip.key as StatKey;
        const to = Object.prototype.hasOwnProperty.call(page.stats, key) ? page.stats[key] : undefined;
        const st = words.get(key);
        if (!to || !st) continue;
        const spotlightHltb = look === 'spotlight' && key === 'hltb';
        if (!spotlightHltb) add(`label-${key}`, 'label', st.label, chip.label, anchor(to.label, 'midline'), 'midline', HOME_CHIP_FONTS.label);
        add(`value-${key}`, look === 'clean' ? 'cleanValue' : 'value', st.value, chip.value, anchor(to.value, 'midline'), 'midline', HOME_CHIP_FONTS.value, { accent: spotlightHltb });
    }
    return out;
}
