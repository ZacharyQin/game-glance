import type { HltbResult } from '../data/hltb';
import { HLTB_TITLE, hltbFoundView } from '../logic/hltbCardView';
import { extrasParts } from './openHome';

interface Props {
    description: string | null;
    hltb: HltbResult | undefined;
    playedMinutes: number;
    locale: string;
}

/**
 * The page's parts Spotlight Home draws as it turns into the page's Spotlight look (the open transition): the description
 * and the HowLongToBeat card's title, columns, bar and caption, as the page's card shows them (logic/hltbCardView).
 * Hidden until opening (homeCss.openingRules); openMotion places it; the page then shows the same at once (intent).
 */
export function OpenExtras({ description, hltb, playedMinutes, locale }: Props) {
    const parts = extrasParts(description, hltb);
    const view = parts.includes('hltb') && hltb?.status === 'found' ? hltbFoundView(hltb.times, playedMinutes, locale, true) : null;
    return (
        <div className="gh-open-extras" data-parts={parts}>
            {parts.includes('desc') && <p className="gh-x-desc">{description}</p>}
            {view && (
                <div className="gh-x-hltb">
                    <div className="gh-x-label">{HLTB_TITLE}</div>
                    <div className="gh-x-stats">
                        {view.columns.map((c) => (
                            <div key={c.key}>
                                <div className="gh-x-label">{c.label}</div>
                                <div className="gh-x-value">{c.value}</div>
                            </div>
                        ))}
                    </div>
                    {view.bar !== null && <div className="gh-x-bar"><div style={{ width: `${view.bar}%` }} /></div>}
                    {view.caption !== null && <div className="gh-x-caption">{view.caption}</div>}
                </div>
            )}
        </div>
    );
}
