/**
 * Lightweight dev-only logger. No-ops in production builds so log statements
 * don't ship in the JS bundle's hot path.
 */

/* eslint-disable no-console */

export function logInfo(...args: unknown[]): void {
  if (__DEV__) {
    console.log('[vyro]', ...args);
  }
}

export function logWarn(...args: unknown[]): void {
  if (__DEV__) {
    console.warn('[vyro]', ...args);
  }
}

export function logError(...args: unknown[]): void {
  if (__DEV__) {
    console.error('[vyro]', ...args);
  }
}
