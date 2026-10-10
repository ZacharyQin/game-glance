import { PAGE_LAYOUT, pageDUnit, STEAM_LEGEND_PX } from '../styles/themeCss';

/**
 * Where the Game Glance page (restyled, Spotlight or Clean look) puts the things Spotlight Home morphs into during the
 * open transition, for a Big Picture window of a given size. Built from the same constants as the page's theme
 * (themeCss.PAGE_LAYOUT), so the two cannot drift apart; checked against layouts measured on the device
 * (tests/home/fixtures/openLayout). CSS px of the Big Picture window. Pure.
 */

export type PageLook = 'spotlight' | 'clean';
export interface Box { x: number; y: number; w: number; h: number }
export type StatKey = 'size' | 'played' | 'achievements' | 'hltb';
/** One of the page's stat columns, in page order; `bar`: the column has a progress bar under its value (Clean). */
export interface PageStat { key: StatKey; label: string; value: string; bar?: boolean }
export interface PageTargets {
    /** The title's bottom-left corner (it grows upward), and the eyebrow's under it. */
    titleBottomLeft: { x: number; y: number };
    eyebrowBottomLeft: { x: number; y: number };
    play: Box;
    /** Circle slots 0..3 after the Play pill. */
    circles: Box[];
    /** The store pill, right-aligned (its size is the given one). */
    store: Box;
    /** Spotlight: [info card, HowLongToBeat card]; Clean: [panel]. */
    shells: Box[];
    /** Each stat's label and value; on Clean, the progress bar under a stat that has one. */
    stats: Partial<Record<StatKey, { label: Box; value: Box; bar?: Box }>>;
}
/** A text's width in CSS px as the page draws it: a stat label (uppercase, its letter spacing), a card value or a Clean value. */
export type Measure = (text: string, role: 'label' | 'value' | 'cleanValue', fontPx: number) => number;

/** The cards' and the Clean panel's border (CSS px, not scaled). */
const BORDER = 1;
/** Line heights: labels inherit Steam's 1.5, values are set to 1.2 (themeCss). */
const LABEL_LINE = 1.5;
const VALUE_LINE = 1.2;
/** The Spotlight cards' height with three description lines (handoff px; the theme's TV_CARDS_H). */
const CARDS_H = PAGE_LAYOUT.playTop.tvCards;

export function pageTargets(look: PageLook, screen: { width: number; height: number }, stats: PageStat[], measure: Measure, storeSize: { w: number; h: number }): PageTargets {
    const L = PAGE_LAYOUT;
    const W = screen.width;
    const H = screen.height;
    const d = pageDUnit(W, H);
    const tv = W >= L.tvQuery.minWidth && H >= L.tvQuery.minHeight;
    const side = (tv ? L.side.tv : L.side.base) * d;
    const playTop = look === 'clean'
        ? H - L.rowH * d - Math.max(L.clean.bottom * d, L.clean.minBelowRow - (L.rowH - L.icon) * d)
        : tv
            ? H - STEAM_LEGEND_PX - (L.rowH + L.playTop.tvCards + L.playTop.tvGap) * d
            : H - L.playTop.spotlight * d;

    const play: Box = { x: side, y: playTop, w: L.playW * d, h: L.icon * d };
    const circles = [0, 1, 2, 3].map((i) => ({ x: side + (L.playW + L.gap + i * (L.icon + L.gap)) * d, y: playTop, w: L.icon * d, h: L.icon * d }));

    const blockBottom = playTop - (look === 'clean' ? L.clean.gap : L.titleGap) * d;
    const eyebrowH = L.titleBlock.eyebrow * VALUE_LINE * d;
    const eyebrowBottomLeft = { x: side, y: blockBottom };
    const titleBottomLeft = { x: side, y: blockBottom - eyebrowH - L.titleBlock.gap * d };

    const labelFont = L.stats.label * d;
    const labelH = labelFont * LABEL_LINE;
    const valueRole = look === 'clean' ? 'cleanValue' : 'value';
    const valueFont = (look === 'clean' ? L.cleanInfo.value : L.stats.value) * d;
    const valueH = valueFont * VALUE_LINE;
    const barW = L.cleanInfo.barW * d;
    const columnWidth = (s: PageStat) => Math.max(measure(s.label, 'label', labelFont), measure(s.value, valueRole, valueFont), look === 'clean' && s.bar ? barW : 0);
    const out: PageTargets['stats'] = {};
    /** Lays `list` out as one flex row of columns from (x, y) with `gap` between them; returns the row's width. */
    const row = (list: PageStat[], x: number, y: number, gap: number): number => {
        let at = x;
        list.forEach((s, i) => {
            const w = columnWidth(s);
            const value: Box = { x: at, y: y + labelH + L.stats.rowGap * d, w, h: valueH };
            out[s.key] = { label: { x: at, y, w, h: labelH }, value };
            // Clean's bar: under the value, after the column's gap and its own margin.
            if (look === 'clean' && s.bar) out[s.key]!.bar = { x: at, y: value.y + valueH + (L.stats.rowGap + L.cleanInfo.barTop) * d, w: barW, h: L.cleanInfo.barH * d };
            at += w + (i < list.length - 1 ? gap : 0);
        });
        return at - x;
    };

    let shells: Box[];
    let store: Box;
    if (look === 'spotlight') {
        const top = playTop + L.rowH * d;
        const inner = W - 2 * side - L.cards.gridGap * d;
        const [a, b] = L.cards.split;
        const info: Box = { x: side, y: top, w: (inner * a) / (a + b), h: CARDS_H * d };
        const hltb: Box = { x: info.x + info.w + L.cards.gridGap * d, y: top, w: (inner * b) / (a + b), h: CARDS_H * d };
        shells = [info, hltb];
        const pad = (card: Box) => ({ x: card.x + BORDER + L.cards.padX * d, y: card.y + BORDER + L.cards.padY * d });
        const i0 = pad(info);
        row(stats.filter((s) => s.key !== 'hltb'), i0.x, i0.y, L.stats.colGapInfo * d);
        const h0 = pad(hltb);
        // The HowLongToBeat card: its title label, then the tiers (Main is the `hltb` stat; the others are the page's own).
        row(stats.filter((s) => s.key === 'hltb'), h0.x, h0.y + labelH + L.cards.hltbGap * d, L.stats.colGapHltb * d);
        store = { x: W - side - storeSize.w, y: top - L.storePillTop * d, w: storeSize.w, h: storeSize.h };
    } else {
        // Measure the row first (at 0, 0), then place the panel right-aligned and centred on the Play pill.
        const width = row(stats, 0, 0, L.cleanInfo.colGap * d);
        const barH = stats.some((s) => s.bar) ? (L.stats.rowGap + L.cleanInfo.barTop + L.cleanInfo.barH) * d : 0;
        const columnH = labelH + L.stats.rowGap * d + valueH + barH;
        const panel: Box = { x: 0, y: 0, w: width + 2 * (L.cleanInfo.padX * d + BORDER), h: columnH + 2 * (L.cleanInfo.padY * d + BORDER) };
        panel.x = W - side - panel.w;
        panel.y = playTop + (L.icon * d) / 2 - panel.h / 2;
        const ox = panel.x + BORDER + L.cleanInfo.padX * d;
        const oy = panel.y + BORDER + L.cleanInfo.padY * d;
        for (const key of Object.keys(out) as StatKey[]) {
            const s = out[key]!;
            s.label = { ...s.label, x: s.label.x + ox, y: s.label.y + oy };
            s.value = { ...s.value, x: s.value.x + ox, y: s.value.y + oy };
            if (s.bar) s.bar = { ...s.bar, x: s.bar.x + ox, y: s.bar.y + oy };
        }
        shells = [panel];
        store = { x: W - side - storeSize.w, y: playTop - L.clean.storeGap * d - storeSize.h, w: storeSize.w, h: storeSize.h };
    }
    return { titleBottomLeft, eyebrowBottomLeft, play, circles, store, shells, stats: out };
}
