import { readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { prepareFrontendHttpHandler } from '../../../orchestrator/server/frontend-http';

test('mesh orchestrator serves only a verified React deployment before 404', () => {
  const source = readFileSync('core/orchestrator/orchestrator.ts', 'utf8');
  const frontendHttp = readFileSync('core/orchestrator/server/frontend-http.ts', 'utf8');
  const verifiedRoute = 'deployedFrontend ? await deployedFrontend.serve(request) : null';
  const unhandled = 'Unhandled mesh-control route';

  expect(frontendHttp).not.toContain('serveStaticApp');
  expect(source).toContain("prepareFrontendHttpHandler(process.env['XLN_FRONTEND_DEPLOYMENT_ROOT'])");
  expect(frontendHttp.indexOf(verifiedRoute)).toBeGreaterThan(0);
  expect(frontendHttp.indexOf(unhandled)).toBeGreaterThan(frontendHttp.indexOf(verifiedRoute));
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
