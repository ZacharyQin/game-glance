import { formatBytes } from './format';

/** A size item for our info card (a Unifideck game's install or download size), shaped like the other stats. */
export interface SizeStat {
    key: 'size';
    label: string;
    value: string;
}

/**
 * The size item: labelled with Unifideck's own word for it when known (`nativeLabel`, read from its row: translated by Unifideck),
 * else our English: "Installed size" for an installed game, "Install size" for one that is not. Null when the size is unknown
 * (never "0 B"). Pure.
 */
export function sizeStat(bytes: number | null | undefined, installed: boolean, locale: string, nativeLabel: string | null = null): SizeStat | null {
    const value = formatBytes(bytes, locale);
    return value === null ? null : { key: 'size', label: nativeLabel || (installed ? 'Installed size' : 'Install size'), value };
}

/**
 * A Steam game's "Space Required" item on its page (`label`: Steam's own word, in its language): shown only for a game Steam
 * reports as not installed (no size on disk), from the space Steam says it needs. Null when installed or unknown. Pure.
 */
export function steamSpaceStat(overview: unknown, spaceBytes: number | null | undefined, locale: string, label: string): SizeStat | null {
    const onDisk = Number((overview as { size_on_disk?: unknown } | null | undefined)?.size_on_disk ?? 0);
    if (onDisk > 0) return null;
    return sizeStat(spaceBytes ?? null, false, locale, label);
}
