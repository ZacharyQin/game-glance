import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pageCloudNeeded } from '../data/unifideckCloud';
import { CloudIcon } from '../home/ActionRow';
import { CLOUD_COLOURS } from '../home/cloud';
import { useUnifideckCloud } from '../home/useCloud';
import { PAGE_LAYOUT } from '../styles/themeCss';

/** How long the page is watched for Unifideck's row (it mounts after ours). */
const FIND_FOR_MS = 10_000;

/** Unifideck's round buttons' row (its controller and settings buttons' parent) in `doc`, and a button's classes to wear. */
function findRow(doc: Document): { row: Element; className: string } | null {
    const button = doc.querySelector('.unifideck-icon-btn');
    // Its classes without Steam's focus marks (the button may hold focus as it is read).
    const className = button ? [...button.classList].filter((c) => !c.startsWith('gpfocus')).join(' ') : '';
    return button?.parentElement ? { row: button.parentElement, className } : null;
}

/**
 * A Unifideck game's cloud-save circle on its page where Unifideck draws none (data/unifideckCloud.pageCloudNeeded: a game
 * that is not installed), as Home shows it: the same state, Steam's cloud glyph in the state's colour, after the settings
 * button, wearing Unifideck's own round-button classes so it looks like its neighbours. Display only, as Home's (A does
 * nothing there either). Lives in the page's window (found from a marker element, as UnifideckRowNav).
 */
export function UnifideckCloud({ appId, installed }: { appId: number; installed: boolean | null | undefined }) {
    const marker = useRef<HTMLSpanElement>(null);
    const [row, setRow] = useState<{ row: Element; className: string } | null>(null);
    const wanted = installed === false;
    const cloud = useUnifideckCloud(appId, wanted);
    useEffect(() => {
        if (!wanted) return undefined;
        const doc = marker.current?.ownerDocument;
        if (!doc) return undefined;
        const found = findRow(doc);
        if (found) {
            setRow(found);
            return undefined;
        }
        const started = Date.now();
        const timer = setInterval(() => {
            const next = findRow(doc);
            if (next || Date.now() - started > FIND_FOR_MS) clearInterval(timer);
            if (next) setRow(next);
        }, 100);
        return () => clearInterval(timer);
    }, [appId, wanted]);
    const show = row && cloud && pageCloudNeeded(installed, cloud) && row.row.isConnected;
    return (
        <>
            <span ref={marker} style={{ display: 'none' }} />
            {show &&
                createPortal(
                    <div className={`${row.className} gg-uni-cloud`} aria-label={cloud.label} role="img" style={{ color: CLOUD_COLOURS[cloud.tone], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="gg-uni-cloud-icon" style={{ display: 'flex', fontSize: `calc(${PAGE_LAYOUT.cloudIcon} * var(--gg-d))`, filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,.7))' }}>
                            <CloudIcon cloud={cloud} />
                        </span>
                        {/* Steam's glyph at the page's cloud size, as Home's (PAGE_LAYOUT.cloudIcon). */}
                        <style>{`.gg-uni-cloud-icon svg { width: 1em !important; height: 1em !important; margin: 0 !important; fill: currentColor; }`}</style>
                    </div>,
                    row.row,
                )}
        </>
    );
}
