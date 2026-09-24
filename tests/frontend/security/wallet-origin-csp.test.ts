import { expect, test } from 'bun:test';
import { CONTENT_SECURITY_POLICY_DIRECTIVES } from '../../../frontend/config/security/content-security-policy.js';
import { getReactContentSecurityPolicy } from '../../../frontend/config/create-react-app-config';
import { runtimeHttpOriginFromWsUrl } from '../../../frontend/packages/runtime-client/src/runtime/ws-url';
import { readFileSync } from 'node:fs';

const source = (path: string): string => readFileSync(path, 'utf8');

test('wallet origin ships no third-party executable code and enforces hashed scripts', () => {
  const reactWalletHtml = source('frontend/apps/wallet/index.html');
  const routeMode = source('frontend/static/route-mode.js');
  const css = source('frontend/apps/wallet/src/styles/app-shell.css');

  expect(reactWalletHtml).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
  expect(reactWalletHtml).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
  expect(reactWalletHtml).toContain('<script vite-ignore src="/route-mode.js"></script>');
  expect(reactWalletHtml).toContain('<link rel="manifest" href="/site.webmanifest" />');
  expect(reactWalletHtml).toContain('href="/apple-touch-icon.png"');
  expect(routeMode).toContain("setAttribute('data-xln-route-mode'");
  expect(reactWalletHtml).not.toContain('plausible.io');
  expect(css).not.toContain('fonts.googleapis.com');
  expect(getReactContentSecurityPolicy('wallet')).toContain("script-src 'self'");
  expect(getReactContentSecurityPolicy('site')).toBeNull();
  expect(CONTENT_SECURITY_POLICY_DIRECTIVES['script-src']).toEqual(['self']);
  expect(CONTENT_SECURITY_POLICY_DIRECTIVES['script-src-attr']).toEqual(['none']);
  expect(CONTENT_SECURITY_POLICY_DIRECTIVES['object-src']).toEqual(['none']);
  expect(CONTENT_SECURITY_POLICY_DIRECTIVES['media-src']).toEqual(['self', 'blob:']);
});

test('selected remote Runtime WebSocket pins same-origin HTTP reads', () => {
  expect(runtimeHttpOriginFromWsUrl('wss://runtime.example/api/core/ws?ignored=1'))
    .toBe('https://runtime.example');
  expect(runtimeHttpOriginFromWsUrl('ws://127.0.0.1:8080/api/core/ws'))
    .toBe('http://127.0.0.1:8080');
  expect(() => runtimeHttpOriginFromWsUrl('https://runtime.example'))
    .toThrow('REMOTE_RUNTIME_WS_URL_INVALID');
});
