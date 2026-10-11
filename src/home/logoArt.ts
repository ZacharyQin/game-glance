import { displayInfo, loadDecoded, logoCopy, makeCopy } from './artShrink';
import { browserStores, logoUrls } from './artwork';
import { alphaBounds, isBlankLogo, knownLogo, LogoChoice, LogoTrim, measureSize, rememberLogo, scaleTrim } from './logo';

/**
 * Game logos, resolved the way HeroBackground resolves hero art: once per game (the urls tried in order, the first that
 * loads is decoded and measured), shared by everyone asking at the same time, remembered for the session (home/logo),
 * and pre-loaded for the games either side of the selection, so L1/R1 draw the next logo on the very step.
 */

/** Lookups in flight, by game and url list, so a pre-load and the selection share one load. */
const inFlight = new Map<string, Promise<LogoChoice | null>>();

/** The url list for a game's logo and its memo key. */
export function logoList(appId: number): { urls: string[]; key: string } {
    const urls = appId > 0 ? logoUrls(appId, browserStores) : [];
    return { urls, key: urls.join('|') };
}

/** Loads and decodes `url` (readable pixels: Steam's own files are the page's origin, its image server allows any). */
function loadImage(url: string): Promise<HTMLImageElement | null> {
    return loadDecoded(url, true);
}

/**
 * The visible part of a loaded logo, read from a smaller copy of its pixels (`trim`; null when nothing shows), and whether
 * the pixels could be read at all (`readable`; when not, the trim is null and the file is drawn whole).
 */
function measure(img: HTMLImageElement): { readable: boolean; trim: LogoTrim | null } {
    try {
        const natural = { width: img.naturalWidth, height: img.naturalHeight };
        const size = measureSize(natural);
        if (!size) return { readable: false, trim: null };
        const canvas = document.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return { readable: false, trim: null };
        ctx.drawImage(img, 0, 0, size.width, size.height);
        const pixels = ctx.getImageData(0, 0, size.width, size.height).data;
        return { readable: true, trim: scaleTrim(alphaBounds(pixels, size.width, size.height), size.scale, natural) };
    } catch {
        return { readable: false, trim: null };
    }
}

async function lookup(appId: number, urls: string[], key: string): Promise<LogoChoice | null> {
    for (const url of urls) {
        const img = await loadImage(url);
        if (!img || !(img.naturalWidth > 0)) continue;
        const seen = measure(img);
        // A blank file (Steam's local logo can be fully transparent) is no logo: the next source, else the name.
        if (isBlankLogo(seen.readable, seen.trim)) continue;
        const file: LogoChoice = { url, trim: seen.trim, natural: { width: img.naturalWidth, height: img.naturalHeight } };
        // A logo far bigger than it is drawn (custom art: 3841x5405) is drawn from a smaller copy (home/artShrink).
        const copy = logoCopy(file, displayInfo().perCanvas);
        const src = copy ? await makeCopy(url, copy.natural, 'image/png') : null;
        const choice: LogoChoice = copy && src ? { ...copy, src } : file;
        rememberLogo(appId, key, choice);
        return choice;
    }
    rememberLogo(appId, key, null);
    return null;
}

/** The game's logo (null: show the name). Remembered answers return at once; never rejects. */
export function resolveLogo(appId: number, list = logoList(appId)): Promise<LogoChoice | null> {
    const known = knownLogo(appId, list.key);
    if (known !== undefined) return Promise.resolve(known);
    if (list.urls.length === 0) return Promise.resolve(null);
    const id = `${appId}|${list.key}`;
    const pending = inFlight.get(id);
    if (pending) return pending;
    const run = lookup(appId, list.urls, list.key)
        .catch(() => null)
        .finally(() => inFlight.delete(id));
    inFlight.set(id, run);
    return run;
}

/** Resolves the logos of `appIds` ahead (the games either side of the selection), one after another. */
export function preloadLogos(appIds: readonly number[]) {
    void (async () => {
        for (const appId of appIds) await resolveLogo(appId);
    })();
}
