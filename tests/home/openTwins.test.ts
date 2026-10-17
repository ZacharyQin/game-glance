import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { HomeRects } from '../../src/home/openMotion';
import { HOME_CHIP_FONTS } from '../../src/home/openMotion';
import type { Box, PageStat, PageTargets } from '../../src/home/openTargets';
import { twinFrom, twinSpecs } from '../../src/home/openTwins';
import { OPEN_TIMINGS } from '../../src/home/motion';
import { HOME_PILL, TITLE_BLOCK } from '../../src/home/homeCss';
import { PAGE_LAYOUT, PAGE_TYPE, pillFocusScale } from '../../src/styles/themeCss';

const raw = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/openLayout/home-1500x844.json'), 'utf8')) as { canvasScale: number; rects: Record<string, Box> };
const r = raw.rects;
const s = raw.canvasScale;
const homeRects = (): HomeRects => ({
    canvas: { x: 0, y: 0, w: 1440 * s, h: 810 * s },
    titleSlot: r.titleSlot,
    titleText: true,
    eyebrow: r.eyebrow,
    play: r.pill,
    circles: [r.circle0, r.circle1, r.circle2, r.circle3],
    infoCircle: 2,
    store: r.store,
    chips: [
        { key: 'played', shell: r['chip:chip0'], label: r['chip:chip0:label'], value: r['chip:chip0:value'], bar: null },
        { key: 'achievements', shell: r['chip:chip1'], label: r['chip:chip1:label'], value: r['chip:chip1:value'], bar: r['chip:chip1:bar'] },
        { key: 'hltb', shell: r['chip:chip2'], label: r['chip:chip2:label'], value: r['chip:chip2:value'], bar: r['chip:chip2:bar'] },
        { key: 'added', shell: r['chip:chip2'], label: r['chip:chip2:label'], value: r['chip:chip2:value'], bar: null },
    ],
});
const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const page = (): PageTargets => ({
    titleBottomLeft: { x: 25, y: 426 },
    eyebrowBottomLeft: { x: 25, y: 455.6 },
    play: box(25, 493.1, 354.2, 62.5),
    circles: [],
    store: box(1372.1, 507.7, 102.9, 33.3),
    shells: [],
    stats: {
        played: { label: box(50.8, 614.7, 77.5, 17.2), value: box(50.8, 636.1, 77.5, 37.5) },
        achievements: { label: box(169.9, 614.7, 113.8, 17.2), value: box(169.9, 636.1, 113.8, 37.5) },
        hltb: { label: box(819.2, 642.3, 74.9, 17.2), value: box(819.2, 663.7, 74.9, 37.5) },
    },
});
const stats: PageStat[] = [
    { key: 'played', label: 'Played', value: '12 h' },
    { key: 'achievements', label: 'Achievements', value: '4 / 20' },
    { key: 'hltb', label: 'Main', value: '30 h' },
];
const texts = { title: 'Cronos', eyebrow: 'Last played · Today', play: 'Play' };
/** translate(x, y) scale(k) from a twin's from transform. */
const parse = (t: string) => {
    const m = /^translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\((-?[\d.]+)\)$/.exec(t);
    expect(m, t).not.toBeNull();
    return { tx: Number(m![1]), ty: Number(m![2]), k: Number(m![3]) };
};
const byName = (list: ReturnType<typeof twinSpecs>) => Object.fromEntries(list.map((t) => [t.name, t]));

describe('twinFrom', () => {
    const home = box(100, 200, 80, 20);
    const at = { x: 300, y: 500 };
    it("maps the anchor onto Home's box: top-left, bottom-left or the centre line's left end", () => {
        for (const k of [0.5, 1.6]) {
            expect(parse(twinFrom(home, at, k, 'top'))).toEqual({ tx: -200, ty: -300, k });
            expect(parse(twinFrom(home, at, k, 'base'))).toEqual({ tx: -200, ty: -280, k });
            expect(parse(twinFrom(home, at, k, 'midline'))).toEqual({ tx: -200, ty: -290, k });
        }
    });
});

describe('twinSpecs', () => {
    it('twin specs for spotlight: title, eyebrow, play, and each column\'s label and value', () => {
        const t = byName(twinSpecs(homeRects(), page(), texts, stats, 'spotlight', true, s));
        expect(Object.keys(t).sort()).toEqual(['eyebrow', 'label-achievements', 'label-played', 'play', 'title', 'value-achievements', 'value-hltb', 'value-played']);
        expect(t.title).toMatchObject({ role: 'title', text: 'Cronos', origin: 'base', x: 25, y: 426, to: 'none' });
        expect(parse(t.title.from).k).toBeCloseTo(TITLE_BLOCK.titleSize / PAGE_TYPE.title.size, 4);
        expect(t.eyebrow).toMatchObject({ role: 'eyebrow', origin: 'base', x: 25, y: 455.6 });
        expect(t['label-played']).toMatchObject({ role: 'label', text: 'Played', origin: 'midline', x: 50.8, y: Math.round((614.7 + 17.2 / 2) * 100) / 100 });
        expect(parse(t['label-played'].from).k).toBeCloseTo(HOME_CHIP_FONTS.label / PAGE_TYPE.label.size, 4);
        expect(t['value-played']).toMatchObject({ role: 'value', text: '12 h', accent: false });
        expect(parse(t['value-played'].from).k).toBeCloseTo(HOME_CHIP_FONTS.value / PAGE_TYPE.value.size, 4);
        const home = homeRects().chips[0].label;
        const f = parse(t['label-played'].from);
        expect(f.tx).toBeCloseTo(home.x - 50.8, 1);
        expect(f.ty).toBeCloseTo(home.y + home.h / 2 - (614.7 + 17.2 / 2), 1);
    });
    it('no title twin for a logo', () => {
        expect(byName(twinSpecs(homeRects(), page(), { ...texts, title: null }, stats, 'spotlight', true, s)).title).toBeUndefined();
    });
    it('play twin: at the page label\'s inset on the centre line; ends unscaled when not focused, at the focus scale about the pill\'s centre when focused', () => {
        const p = page().play;
        const d = s;
        const inset = (PAGE_LAYOUT.pill.padX + PAGE_LAYOUT.pill.icon + PAGE_LAYOUT.pill.iconGap) * d;
        const off = byName(twinSpecs(homeRects(), page(), texts, stats, 'spotlight', false, s)).play;
        expect(off).toMatchObject({ role: 'playLabel', text: 'Play', origin: 'midline', to: 'none' });
        expect(off.x).toBeCloseTo(p.x + inset, 2);
        expect(off.y).toBeCloseTo(p.y + p.h / 2, 2);
        expect(parse(off.from).k).toBeCloseTo(HOME_PILL.font / PAGE_TYPE.playLabel.size, 4);
        const on = byName(twinSpecs(homeRects(), page(), texts, stats, 'spotlight', true, s)).play;
        const pf = pillFocusScale(PAGE_LAYOUT.playW, PAGE_LAYOUT.icon);
        const cx = p.x + p.w / 2;
        expect(on.to).toBe(`translate(${Math.round((cx - on.x) * (1 - pf.x) * 100) / 100}px, 0px) scale(${pf.x}, ${pf.y})`);
    });
    it('hltb in spotlight: value twin only, accent', () => {
        const t = byName(twinSpecs(homeRects(), page(), texts, stats, 'spotlight', true, s));
        expect(t['label-hltb']).toBeUndefined();
        expect(t['value-hltb']).toMatchObject({ accent: true, text: '30 h' });
    });
    it('no twin for a chip the page has no column for', () => {
        expect(Object.keys(byName(twinSpecs(homeRects(), page(), texts, stats, 'spotlight', true, s))).some((n) => n.endsWith('added'))).toBe(false);
    });
    it('clean values use cleanValue, and clean keeps the hltb label', () => {
        const t = byName(twinSpecs(homeRects(), page(), texts, stats, 'clean', true, s));
        expect(t['value-played'].role).toBe('cleanValue');
        expect(t['label-hltb']).toBeDefined();
        expect(t['value-hltb'].accent).toBe(false);
    });
    it("the Play label's inset is in the canvas scale given (a 16:10 canvas is 1280 wide, not 1440)", () => {
        const narrow = { ...homeRects(), canvas: { x: 0, y: 0, w: 1280 * s, h: 800 * s } };
        const a = byName(twinSpecs(narrow, page(), texts, stats, 'spotlight', false, s)).play;
        const b = byName(twinSpecs(homeRects(), page(), texts, stats, 'spotlight', false, s)).play;
        expect(a.x).toBeCloseTo(b.x, 5);
        expect(a.from).toBe(b.from);
    });
    it("in the root's px: Home's root offset is taken off", () => {
        const home = { ...homeRects(), root: box(10, 20, 1500, 844) };
        const t = byName(twinSpecs(home, page(), texts, stats, 'spotlight', true, s));
        expect(t.title.x).toBe(15);
        expect(t.title.y).toBe(406);
    });
    it('the timings: the crossfade is the first 40% of the morph, the glide 150 ms', () => {
        expect(OPEN_TIMINGS.twinFade).toBe(180);
        expect(OPEN_TIMINGS.twinFade / OPEN_TIMINGS.morph).toBeCloseTo(0.4, 5);
        expect(OPEN_TIMINGS.settleGlide).toBe(150);
    });
});
