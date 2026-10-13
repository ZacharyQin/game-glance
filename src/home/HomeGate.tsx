import { Component, ReactElement, ReactNode } from 'react';
import { LOG_PREFIX } from '../constants';
import { useSettings } from '../data/settings';
import { homeMode } from './mode';
import { SpotlightHome } from './SpotlightHome';

let logged = false;

// On any throw inside Spotlight Home, render Steam's original Home instead and log the reason once.
class HomeErrorBoundary extends Component<{ fallback: ReactElement; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: unknown) {
        if (logged) return;
        logged = true;
        console.error(`${LOG_PREFIX} Spotlight Home render failed; showing Steam's Home`, error);
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

/**
 * Mounted by the Home route patch in place of what Steam's Home renders; `children` is Steam's own Home tree.
 * Reads the setting live, so toggling in Quick Access swaps Home without a restart.
 */
export function HomeGate({ children: fallback }: { children: ReactElement }) {
    const settings = useSettings();
    if (!homeMode(settings).home) return fallback;
    return (
        <HomeErrorBoundary fallback={fallback}>
            <SpotlightHome />
        </HomeErrorBoundary>
    );
}
