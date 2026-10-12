import { describe, expect, it } from 'vitest';
import { formatBytes } from '../../src/logic/format';
import { sizeStat, steamSpaceStat } from '../../src/logic/sizeStat';

const GB = 1024 ** 3;

describe('formatBytes', () => {
    it('uses binary units, one decimal under 100, like Unifideck', () => {
        expect(formatBytes(3.2 * GB, 'en-US')).toBe('3.2 GB');
        expect(formatBytes(512 * 1024 ** 2, 'en-US')).toBe('512 MB');
        expect(formatBytes(1536, 'en-US')).toBe('1.5 KB');
        expect(formatBytes(150 * GB, 'en-US')).toBe('150 GB');
        expect(formatBytes(2 * 1024 ** 4, 'en-US')).toBe('2.0 TB');
    });
    it('follows the locale’s decimal mark', () => {
        expect(formatBytes(3.2 * GB, 'de-DE')).toBe('3,2 GB');
    });
    it('is null when unknown, never 0 B', () => {
        for (const bad of [0, -5, NaN, Infinity, null, undefined, '5']) expect(formatBytes(bad, 'en-US')).toBeNull();
    });
});

describe('sizeStat', () => {
    it('labels Installed size when installed and Install size when not', () => {
        expect(sizeStat(3.2 * GB, true, 'en-US')).toEqual({ key: 'size', label: 'Installed size', value: '3.2 GB' });
        expect(sizeStat(3.2 * GB, false, 'en-US')).toEqual({ key: 'size', label: 'Install size', value: '3.2 GB' });
    });
    it('is null with no known size', () => {
        expect(sizeStat(null, true, 'en-US')).toBeNull();
        expect(sizeStat(undefined, false, 'en-US')).toBeNull();
        expect(sizeStat(0, true, 'en-US')).toBeNull();
    });
});

describe("a Steam game that is not installed: its space required", () => {
    it("shows the install size when Steam reports no size on disk (the page's wording for a game that is not installed)", () => {
        expect(steamSpaceStat({ appid: 1455840 }, 691079517, 'en')).toEqual({ key: 'size', label: 'Install size', value: formatBytes(691079517, 'en') });
        expect(steamSpaceStat({ size_on_disk: 0 }, 691079517, 'en')?.label).toBe('Install size');
    });

    it('shows nothing for an installed game, or when the space is not known', () => {
        expect(steamSpaceStat({ size_on_disk: '11058189790' }, 691079517, 'en')).toBeNull();
        expect(steamSpaceStat({ appid: 1455840 }, undefined, 'en')).toBeNull();
        expect(steamSpaceStat({ appid: 1455840 }, null, 'en')).toBeNull();
    });
});
