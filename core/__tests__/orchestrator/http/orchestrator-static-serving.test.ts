import { readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { prepareFrontendHttpHandler } from '../../../orchestrator/server/frontend-http';

test('mesh orchestrator serves the frontend static route before 404', () => {
  const source = readFileSync('core/orchestrator/orchestrator.ts', 'utf8');
  const frontendHttp = readFileSync('core/orchestrator/server/frontend-http.ts', 'utf8');
  const staticAssets = readFileSync('core/api/server/static-assets.ts', 'utf8');
  const staticRoute = "serveStaticApp(request, pathname, './frontend/build')";
  const unhandled = 'Unhandled mesh-control route';

  expect(frontendHttp).toContain("import { serveStaticApp } from '../../api/server/static-assets';");
  expect(source).toContain("prepareFrontendHttpHandler(process.env['XLN_FRONTEND_DEPLOYMENT_ROOT'])");
  expect(staticAssets).toContain("if (pathname === '/runtime.js')");
  expect(staticAssets).toContain("{ error: 'RUNTIME_BUNDLE_MISSING' }");
  expect(staticAssets).toContain('{ status: 503');
  expect(staticAssets).toContain("staticPath === '/index.html' ? null : await serveStatic('/index.html', staticDir)");
  expect(frontendHttp.indexOf(staticRoute)).toBeGreaterThan(0);
  expect(frontendHttp.indexOf(unhandled)).toBeGreaterThan(frontendHttp.indexOf(staticRoute));
  expect(source.indexOf('return await handleFrontendRequest(request, pathname, headers)')).toBeGreaterThan(
    source.indexOf("if (pathname.startsWith('/api/'))"),
  );
});

test('unhandled frontend writes preserve the mesh-control 404 and headers', async () => {
  const handle = await prepareFrontendHttpHandler(undefined);
  const response = await handle(new Request('http://localhost/wallet', { method: 'POST' }), '/wallet', {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  });
  expect(response.status).toBe(404);
  expect(response.headers.get('access-control-allow-origin')).toBe('*');
  expect(await response.json()).toEqual({ error: 'Unhandled mesh-control route: POST /wallet' });
});
