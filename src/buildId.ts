/**
 * Build timestamp, injected by Vite. Falls back to "dev" outside a bundle
 * (the test runner imports these modules directly under node).
 */
export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
