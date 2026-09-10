export const resolveWalletEntryPath = (pathname: string, protocol: string): string =>
  protocol === 'chrome-extension:' && pathname === '/app.html' ? '/app' : pathname;

export const resolveWalletEntryHref = (href: string, protocol: string): string =>
  protocol === 'chrome-extension:' && /^\/app(?:[?#]|$)/u.test(href) ? href.replace(/^\/app/u, '/app.html') : href;

// Keep the physical extension document in links and history so reload and
// opening a link in another tab load the same verified packaged entry.
export const walletBrowserHref = (href: string): string =>
  resolveWalletEntryHref(href, typeof window === 'undefined' ? 'https:' : window.location.protocol);
