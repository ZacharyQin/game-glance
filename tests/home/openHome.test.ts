import { describe, expect, it, vi } from 'vitest';
import { applyOpening, measureHome, openVariant, pageStatsFromChips } from '../../src/home/openHome';
import { mountOpenBridge } from '../../src/home/openBridge';

describe('openVariant', () => {
    it('morphs only the selected game with its full hero art onto the restyled page', () => {
        expect(openVariant({ sameGame: true, heroMode: 'full', pageRestyled: true })).toBe('morph');
    });
    it('a game without full hero art fades (its art would not match the page header)', () => {
        expect(openVariant({ sameGame: true, heroMode: 'fallback', pageRestyled: true })).toBe('fade');
        expect(openVariant({ sameGame: true, heroMode: 'none', pageRestyled: true })).toBe('fade');
    });
    it('another game (a feed card) crossfades to its hero', () => {
        expect(openVariant({ sameGame: false, heroMode: 'full', pageRestyled: true })).toBe('heroFade');
        expect(openVariant({ sameGame: false, heroMode: 'none', pageRestyled: true })).toBe('heroFade');
    });
    it("Steam's own page (Game Glance page off) fades", () => {
        expect(openVariant({ sameGame: true, heroMode: 'full', pageRestyled: false })).toBe('fade');
    });
});

/** A minimal element: a box, attributes, and children found by selector. */
interface FakeEl {
    getBoundingClientRect(): { left: number; top: number; width: number; height: number };
    getAttribute(name: string): string | null;
    querySelector(sel: string): FakeEl | null;
    querySelectorAll(sel: string): FakeEl[];
}
function el(x: number, y: number, w: number, h: number, attrs: Record<string, string> = {}, one: Record<string, FakeEl> = {}, all: Record<string, FakeEl[]> = {}): FakeEl {
    return {
        getBoundingClientRect: () => ({ left: x, top: y, width: w, height: h }),
        getAttribute: (n) => attrs[n] ?? null,
        querySelector: (s) => one[s] ?? null,
        querySelectorAll: (s) => all[s] ?? [],
    };
}
function chip(key: string | null, x: number, bar: boolean) {
    return el(x, 360, 100, 70, key ? { 'data-chip': key } : {}, {
        '.gh-chip-label': el(x + 15, 373, 70, 12),
        '.gh-chip-value': el(x + 15, 390, 70, 25),
        ...(bar ? { '.gh-chip-bar': el(x + 15, 419, 70, 3) } : {}),
    });
}
function home(withPlay = true) {
    const circles = [el(300, 460, 56, 56, { 'data-action': 'controller' }), el(366, 460, 56, 56, { 'data-action': 'menu' }), el(435, 460, 56, 56, { 'data-action': 'info' })];
    return el(0, 0, 1500, 844, {}, {
        '.gh-canvas': el(0, 0, 1500, 843.75),
        '.gh-title-slot': el(25, 188, 645, 121),
        '.gh-eyebrow': el(25, 328, 645, 15),
        ...(withPlay ? { '.gh-actions .gh-btn[data-action="play"]': el(20, 459, 271, 58) } : {}),
        '.gh-source': el(1377, 472, 103, 33),
    }, {
        '.gh-actions .gh-btn-circle': circles,
        '.gh-chip': [chip('played', 25, false), chip('achievements', 144, true), chip(null, 288, true)],
    });
}

describe('measureHome', () => {
    it("reads Home's boxes: circles in order with the info button's index, chips by data-chip", () => {
        const r = measureHome(home() as unknown as Element);
        expect(r).not.toBeNull();
        expect(r!.play).toEqual({ x: 20, y: 459, w: 271, h: 58 });
        expect(r!.circles).toHaveLength(3);
        expect(r!.infoCircle).toBe(2);
        expect(r!.chips.map((c) => c.key)).toEqual(['played', 'achievements', '']);
        expect(r!.chips[0].bar).toBeNull();
        expect(r!.chips[1].bar).toEqual({ x: 159, y: 419, w: 70, h: 3 });
        expect(r!.canvas.w).toBe(1500);
    });
    it('is null when something required is missing (no Play pill: the Library card)', () => {
        expect(measureHome(home(false) as unknown as Element)).toBeNull();
        expect(measureHome(null)).toBeNull();
    });
});

/** A root that records what applyOpening does, with a frame callback we run by hand. */
function fakeRoot() {
    const props = new Map<string, string>();
    const attrs = new Map<string, string>();
    const frames: Array<() => void> = [];
    const root = {
        style: { setProperty: (n: string, v: string) => props.set(n, v), removeProperty: (n: string) => props.delete(n) },
        setAttribute: (n: string, v: string) => attrs.set(n, v),
        removeAttribute: (n: string) => attrs.delete(n),
        ownerDocument: { defaultView: { requestAnimationFrame: (cb: () => void) => frames.push(cb) } },
    };
    return { root: root as unknown as HTMLElement, props, attrs, frames };
}

describe('applyOpening', () => {
    it('sets the variables and the start frame, then the motion on the next frame', () => {
        const f = fakeRoot();
        applyOpening(f.root, 'morph', [{ name: '--gho-title', value: 'translate(1px, 2px)' }, { name: '--gho-shell-count', value: '2' }], null);
        expect(f.props.get('--gho-title')).toBe('translate(1px, 2px)');
        expect(f.attrs.get('data-gh-opening')).toBe('morph');
        expect(f.attrs.get('data-gh-phase')).toBe('from');
        expect(f.attrs.get('data-gh-shells')).toBe('2');
        f.frames.splice(0).forEach((cb) => cb());
        expect(f.attrs.get('data-gh-phase')).toBe('to');
    });
    it("a feed card's game: its hero art as a variable", () => {
        const f = fakeRoot();
        applyOpening(f.root, 'heroFade', [], 'https://steamloopback.host/assets/10/library_hero.jpg');
        expect(f.props.get('--gho-hero')).toBe('url("https://steamloopback.host/assets/10/library_hero.jpg")');
    });
    it('undo (cancel before the hand-over) removes every trace, and a pending frame then does nothing', () => {
        const f = fakeRoot();
        const undo = applyOpening(f.root, 'morph', [{ name: '--gho-title', value: 'translate(1px, 2px)' }], 'x');
        undo();
        f.frames.splice(0).forEach((cb) => cb());
        expect(f.props.size).toBe(0);
        expect(f.attrs.size).toBe(0);
    });
});

describe('pageStatsFromChips', () => {
    const chips = [
        { key: 'played', label: 'Play Time', value: '1.9 h', bar: false },
        { key: 'achievements', label: 'Achievements', value: '0 / 49', bar: true },
        { key: 'hltb', label: 'HLTB main', value: '9.1 h', bar: true },
    ];
    it("Spotlight: the info card's stats, then HowLongToBeat's Main; achievements written as the card writes them", () => {
        expect(pageStatsFromChips(chips, 'spotlight')).toEqual([
            { key: 'played', label: 'Play Time', value: '1.9 h', bar: false },
            { key: 'achievements', label: 'Achievements', value: '0/49', bar: false },
            { key: 'hltb', label: 'Main', value: '9.1 h', bar: false },
        ]);
    });
    it('Clean: the same order with bars where Home had them', () => {
        expect(pageStatsFromChips(chips, 'clean').map((s) => [s.key, s.label, s.value, s.bar])).toEqual([
            ['played', 'Play Time', '1.9 h', false], ['achievements', 'Achievements', '0 / 49', true], ['hltb', 'HLTB main', '9.1 h', true],
        ]);
    });
    it("a new game's Added chip: the page still shows Play time (0 h), and nothing else of Home's is invented", () => {
        const stats = pageStatsFromChips([{ key: 'added', label: 'Added', value: 'Today', bar: false }, chips[2]], 'clean');
        expect(stats.map((s) => s.key)).toEqual(['played', 'hltb']);
        expect(stats[0].value).toBe('0 h');
    });
});

describe('mountOpenBridge', () => {
    function fakeDom() {
        const appended: Array<{ style: Record<string, string>; children: unknown[]; remove(): void }> = [];
        const make = () => {
            const node = {
                style: {} as Record<string, string>,
                children: [] as unknown[],
                className: '',
                attrs: {} as Record<string, string>,
                setAttribute(n: string, v: string) { node.attrs[n] = v; },
                appendChild(c: unknown) { node.children.push(c); },
                remove: vi.fn(),
            };
            return node;
        };
        const clone = { ...make(), classList: { add: vi.fn() } };
        const doc = { body: { appendChild: (c: never) => appended.push(c) }, createElement: () => make() };
        const root = {
            ownerDocument: doc,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 1500, height: 844 }),
            cloneNode: vi.fn(() => clone),
        };
        return { root: root as unknown as HTMLElement, appended, clone };
    }
    it("puts a frozen copy of Home over Home's box, then fades and removes it", () => {
        const f = fakeDom();
        const bridge = mountOpenBridge(f.root);
        expect(f.appended).toHaveLength(1);
        const box = f.appended[0];
        expect(box.style).toMatchObject({ position: 'fixed', left: '0px', top: '0px', width: '1500px', height: '844px', pointerEvents: 'none' });
        expect(box.children).toEqual([f.clone]);
        expect(f.clone.classList.add).toHaveBeenCalledWith('gh-bridge');
        bridge.fadeOut(120);
        expect(box.style.opacity).toBe('0');
        expect(box.style.transition).toBe('opacity 120ms ease');
        bridge.remove();
        expect(box.remove).toHaveBeenCalled();
    });
    it("carries the given stylesheet while it is up (Steam's page-enter fade switched off)", () => {
        const f = fakeDom();
        mountOpenBridge(f.root, '.x { opacity: 1 }');
        const box = f.appended[0] as unknown as { children: Array<{ textContent?: string }> };
        expect(box.children.some((c) => c.textContent === '.x { opacity: 1 }')).toBe(true);
    });
    it('throws when Home has no usable box (the controller then opens the page without it)', () => {
        const f = fakeDom();
        (f.root as unknown as { getBoundingClientRect: () => unknown }).getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
        expect(() => mountOpenBridge(f.root)).toThrow();
    });
});
