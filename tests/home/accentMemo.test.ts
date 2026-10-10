import { beforeEach, describe, expect, it } from 'vitest';
import { accentMemo, knownAccent } from '../../src/home/accentMemo';

describe('the accent memo (one for Home and the game page)', () => {
    beforeEach(() => accentMemo.clear());

    it("the page's first frame has the colour Home already knew (it showed Steam's default green until its own lookup answered)", () => {
        accentMemo.set(894020, '#bb8850');
        expect(knownAccent(undefined, 894020)).toBe('#bb8850');
    });

    it('a colour the page looked up itself wins; an unknown game has none yet', () => {
        accentMemo.set(1, '#111111');
        expect(knownAccent('#222222', 1)).toBe('#222222');
        expect(knownAccent(undefined, 2)).toBeUndefined();
    });
});
