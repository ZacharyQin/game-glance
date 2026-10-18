import { useEffect, useRef, useState } from 'react';
import { LOG_PREFIX } from '../constants';
import { focusElement } from '../home/homeNav';
import { focusRingClass, needsVisualNav, visualNeighbour } from '../logic/rowNav';
import { playRowControlSelector, versionLinkSelector } from '../styles/theme';

const LEFT = 11;
const RIGHT = 12;

/**
 * Left/Right on the Play row follow the circles' positions. The preferred-version link sits before settings, but
 * Steam steps a row in DOM order (the link is still inside the library line, after settings and before cloud), so
 * Right from the controller would skip it. Only takes over when the picture and the DOM order disagree.
 */
export function PlayRowNav() {
    const marker = useRef<HTMLSpanElement>(null);
    const [doc, setDoc] = useState<Document | null>(null);
    useEffect(() => setDoc(marker.current?.ownerDocument ?? null), []);
    useEffect(() => {
        if (!doc) return undefined;
        const onDirection = (event: Event) => {
            try {
                const button = Number((event as CustomEvent<{ button?: unknown }>).detail?.button);
                if (button !== LEFT && button !== RIGHT) return;
                const selector = playRowControlSelector();
                if (!selector) return;
                const items = [...doc.querySelectorAll<HTMLElement>(selector)].filter((el) => el.getBoundingClientRect().width > 0);
                const xs = items.map((el) => el.getBoundingClientRect().x);
                if (!needsVisualNav(xs)) return;
                const target = event.target as Element | null;
                const gp = doc.querySelector('.gpfocus');
                const from = items.findIndex((el) => el === target || el.contains(target) || el === gp || (gp !== null && el.contains(gp)));
                if (from < 0) return;
                const next = visualNeighbour(xs, from, button === RIGHT ? 'right' : 'left');
                if (next === null) return;
                event.stopPropagation();
                event.preventDefault();
                focusElement(items[next], 'play row control');
            } catch (error) {
                console.warn(`${LOG_PREFIX} play row navigation failed`, error);
            }
        };
        doc.addEventListener('vgp_ondirection', onDirection, true);
        return () => doc.removeEventListener('vgp_ondirection', onDirection, true);
    }, [doc]);
    useEffect(() => {
        if (!doc) return undefined;
        const link = versionLinkSelector();
        if (!link) return undefined;
        let ring = '';
        for (const sheet of doc.styleSheets) {
            let rules: CSSRuleList;
            try {
                rules = sheet.cssRules;
            } catch {
                continue;
            }
            for (const rule of rules) {
                ring = focusRingClass(rule.cssText) ?? '';
                if (ring) break;
            }
            if (ring) break;
        }
        if (!ring) return undefined;
        // The other circles turn white and do not keep Steam's square outline. Hide that outline while this link is focused.
        const style = doc.createElement('style');
        style.textContent = `body:has(${link}.gpfocus) .${ring}, body:has(${link}:focus) .${ring} { outline: none !important; visibility: hidden !important; }`;
        doc.head.appendChild(style);
        return () => style.remove();
    }, [doc]);
    return <span ref={marker} style={{ display: 'none' }} />;
}
