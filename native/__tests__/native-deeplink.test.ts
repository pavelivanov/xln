import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolveWalletAppRoute } from '../../frontend/apps/wallet/src/navigation/wallet-navigation-model';
import { normalizeNativeDeepLinkPath } from '../../frontend/packages/browser/src/native/deeplink';

describe('native deep-link routing', () => {
	test('normalizes supported xln links into app routes', () => {
		expect(normalizeNativeDeepLinkPath('xln://pay?amount=1')).toBe('/app#pay?amount=1');
		expect(normalizeNativeDeepLinkPath('xln://invoice?id=abc')).toBe('/app#pay?id=abc');
		const target = `0x${'ab'.repeat(32)}`;
		expect(normalizeNativeDeepLinkPath(`xln://pay/${target}?token=1&amount=5`))
			.toBe(`/app#pay/${encodeURIComponent(`${target}?token=1&amount=5`)}`);
		expect(normalizeNativeDeepLinkPath('xln://runtime?id=hub')).toBe('/app#runtime?id=hub');
		expect(normalizeNativeDeepLinkPath('xln://app/settings?tab=network#hubs')).toBe('/app/settings?tab=network#hubs');
		expect(normalizeNativeDeepLinkPath('xln://swap?pair=1-2')).toBe('/app#swap?pair=1-2');
	});

	test('rejects non-xln links before they reach app history', () => {
		expect(normalizeNativeDeepLinkPath('https://xln.finance/app')).toBeNull();
		expect(normalizeNativeDeepLinkPath('javascript:alert(1)')).toBeNull();
		expect(normalizeNativeDeepLinkPath('not a url')).toBeNull();
	});

	test('routes a targetless native payment link to the React payment surface', () => {
		const path = normalizeNativeDeepLinkPath('xln://pay?amount=1');
		expect(path).toBe('/app#pay?amount=1');
		const location = new URL(String(path), 'https://xln.finance');
		expect(resolveWalletAppRoute(location.search, location.hash)).toEqual({
			view: 'payments',
			tab: 'send',
			invoice: '',
		});
	});

	test('boots Capacitor routing from React and consumes cold-launch URLs', () => {
		const walletBootstrap = readFileSync('frontend/apps/wallet/src/main.tsx', 'utf8');
		const capacitorBoundary = readFileSync('frontend/packages/browser/src/native/capacitor.ts', 'utf8');
		expect(walletBootstrap).toContain('void initializeNativeShell();');
		expect(capacitorBoundary).toContain("App.addListener('appUrlOpen'");
		expect(capacitorBoundary).toContain('App.getLaunchUrl()');
	});
});
