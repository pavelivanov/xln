import { expect, test } from 'bun:test';

import { developmentFrontendRoles, readDevFrontend } from '../../../scripts/dev/supervise-dev';
import { readDevelopmentGatewayTls, resolveLiveRuntimeFilename } from '../../../frontend/scripts/dev/dev-gateway';

test('React root development replaces both public Vite listeners and retains readiness/UI roles', () => {
  expect(developmentFrontendRoles(readDevFrontend('react'))).toEqual(['react', 'ui', 'ready']);
  expect(developmentFrontendRoles(readDevFrontend('svelte'))).toEqual(['vite', 'vite-http', 'ui', 'ready']);
  expect(() => readDevFrontend('')).toThrow('DEV_FRONTEND_INVALID');
  expect(() => readDevFrontend('unknown')).toThrow('DEV_FRONTEND_INVALID');
});

test('a configured TLS listener requires a readable certificate and key without HTTP fallback', () => {
  expect(() => readDevelopmentGatewayTls('', '')).toThrow('DEVELOPMENT_GATEWAY_TLS_PAIR_REQUIRED');
  expect(() => readDevelopmentGatewayTls('/missing/xln-cert.pem', '')).toThrow('DEVELOPMENT_GATEWAY_TLS_PAIR_REQUIRED');
  expect(() => readDevelopmentGatewayTls('/missing/xln-cert.pem', '/missing/xln-key.pem')).toThrow('ENOENT');
});

test('live Runtime reads stay limited to the two generated bundles and their app namespaces', () => {
  expect(resolveLiveRuntimeFilename('/runtime.js?reload=1')).toBe('runtime.js');
  expect(resolveLiveRuntimeFilename('/__app/ops/account-worker.js')).toBe('account-worker.js');
  expect(resolveLiveRuntimeFilename('/__app/wallet/runtime.js')).toBe('runtime.js');
  expect(resolveLiveRuntimeFilename('/__app/site/runtime.js')).toBeUndefined();
  expect(resolveLiveRuntimeFilename('/__app/wallet/%2e%2e/secrets')).toBeUndefined();
  expect(resolveLiveRuntimeFilename('/contracts/Account.json')).toBeUndefined();
});
