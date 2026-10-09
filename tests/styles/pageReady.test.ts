import { describe, expect, it } from 'vitest';
import { pageReady } from '../../src/styles/pageReady';

type Found = { complete?: boolean; naturalWidth?: number; getClientRects(): { length: number } };
const shown = (extra: Partial<Found> = {}): Found => ({ getClientRects: () => ({ length: 1 }), ...extra });
const hidden: Found = { getClientRects: () => ({ length: 0 }) };
const doc = (map: Record<string, Found | null>) => ({ querySelector: (s: string) => map[s] ?? null });
const sel = { headerImg: '.cap img:not([src*="_blur"])', titleblock: '.gg-titleblock', play: '.play' };

describe('pageReady', () => {
    it('is ready once the hero image has loaded and the title block and Play row are laid out', () => {
        expect(pageReady(doc({ [sel.headerImg]: shown({ complete: true, naturalWidth: 1920 }), '.gg-titleblock': shown(), '.play': shown() }), sel)).toBe(true);
    });
    it('is not ready while the hero image loads, or with nothing laid out', () => {
        expect(pageReady(doc({ [sel.headerImg]: shown({ complete: false, naturalWidth: 0 }), '.gg-titleblock': shown(), '.play': shown() }), sel)).toBe(false);
        expect(pageReady(doc({ [sel.headerImg]: shown({ complete: true, naturalWidth: 0 }), '.gg-titleblock': shown(), '.play': shown() }), sel)).toBe(false);
        expect(pageReady(doc({ [sel.headerImg]: shown({ complete: true, naturalWidth: 1920 }), '.gg-titleblock': hidden, '.play': shown() }), sel)).toBe(false);
        expect(pageReady(doc({}), sel)).toBe(false);
    });
    it('is never ready without a document or without the hero selector (an unknown Steam class)', () => {
        expect(pageReady(null, sel)).toBe(false);
        expect(pageReady(doc({ '.gg-titleblock': shown(), '.play': shown() }), { ...sel, headerImg: null })).toBe(false);
    });
});
