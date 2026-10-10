/**
 * Each game's accent colour once known this session, one memo for Spotlight Home (its warm-up and selections) and the
 * game page: the page's first frame then has the colour Home already showed (with its own memo it drew Steam's default
 * green on a game's first open until its lookup answered).
 */
export const accentMemo = new Map<number, string>();

/** The page's accent: the one it looked up itself once that answers, until then the one already known. */
export function knownAccent(loaded: string | undefined, appId: number): string | undefined {
    return loaded ?? accentMemo.get(appId);
}
