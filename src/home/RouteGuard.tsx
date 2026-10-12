import { callable } from '@decky/api';
import { Component, ReactElement, ReactNode } from 'react';
import { LOG_PREFIX } from '../constants';
import { homeErrorEntry } from './homeError';

const logHomeError = callable<[entry: string], void>('log_home_error');

/**
 * Wraps the whole Home route: Steam's element and ours. An error that gets past Spotlight Home's own boundary (for
 * example in Decky's router wrapper) shows Steam's Home instead of a broken screen, and is written to the plugin's log
 * folder, where a bug report can pick it up (issue #18). Stays on the fallback until Home is left and opened again.
 */
export class RouteGuard extends Component<{ fallback: ReactElement; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
        console.error(`${LOG_PREFIX} Home recovered from an error; showing Steam's Home`, error);
        try {
            logHomeError(homeErrorEntry(error, info?.componentStack)).catch(() => undefined);
        } catch {
            // the log is only for a report: a failure to write it never changes the screen
        }
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}
