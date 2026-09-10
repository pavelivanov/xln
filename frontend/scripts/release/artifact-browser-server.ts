import { createServer } from 'node:http';
import type { Socket } from 'node:net';
import { createProxyServer } from 'http-proxy-3';

import { resolveDevelopmentGatewayRequest } from '../../config/development-gateway';
import { isEdgeRoute } from '../../config/surfaces';
import { forwardWebSocketUpgrade } from '../dev/dev-gateway';
import { requestedReleasePath, serveCandidateReleaseFile } from './candidate-release-serving';
import { verifyCandidateReleaseDirectory } from './candidate-release-verifier';

const directory = process.env['XLN_REACT_ARTIFACT_DIRECTORY'];
if (!directory) throw new Error('ARTIFACT_BROWSER_DIRECTORY_REQUIRED');
const manifest = await verifyCandidateReleaseDirectory(directory);
const port = Number(process.env['PLAYWRIGHT_ARTIFACT_PORT'] ?? '19180');
const fixturePort = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] ?? '19192');
for (const value of [port, fixturePort]) {
  if (!Number.isSafeInteger(value) || value < 1024 || value > 65531) throw new Error('ARTIFACT_BROWSER_PORT_INVALID');
}
const target = `http://127.0.0.1:${fixturePort}`;
const proxy = createProxyServer({ xfwd: true, changeOrigin: false });
const server = createServer(async (request, response) => {
  try {
    const rawUrl = request.url ?? '/';
    const url = new URL(rawUrl, 'http://127.0.0.1');
    if (url.pathname === '/__xln-artifact/identity') {
      const checked = await verifyCandidateReleaseDirectory(directory);
      if (checked.releaseId !== manifest.releaseId) throw new Error('ARTIFACT_BROWSER_RELEASE_CHANGED');
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(
        JSON.stringify({
          releaseId: checked.releaseId,
          files: checked.files.length,
          sourceSha: process.env['XLN_REACT_ARTIFACT_SOURCE_SHA'],
        }),
      );
      return;
    }
    const decision = resolveDevelopmentGatewayRequest(rawUrl);
    if (decision.kind === 'redirect') {
      response.writeHead(decision.status, { location: decision.location });
      response.end();
    } else if (decision.kind === 'response') {
      response.writeHead(decision.status, decision.headers);
      response.end(decision.body);
    } else if (requestedReleasePath(url.pathname, manifest) !== null) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { allow: 'GET, HEAD' });
        response.end();
        return;
      }
      const file = await serveCandidateReleaseFile(directory, manifest, url.pathname);
      response.writeHead(file.status, Object.fromEntries(file.headers));
      response.end(request.method === 'HEAD' ? undefined : Buffer.from(await file.arrayBuffer()));
    } else if (isEdgeRoute(url.pathname) && url.pathname !== '/runtime.js') {
      proxy.web(request, response, { target, changeOrigin: false }, error => {
        console.error(`ARTIFACT_BROWSER_PROXY_FAILED:${error.message}`);
        if (response.headersSent) response.destroy(error);
        else {
          response.writeHead(502);
          response.end('ARTIFACT_BROWSER_PROXY_FAILED');
        }
      });
    } else {
      response.writeHead(404);
      response.end('Not found');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (response.headersSent) response.destroy(new Error(message));
    else {
      response.writeHead(500);
      response.end(message);
    }
  }
});
server.on('upgrade', (request, socket: Socket, head) => {
  const pathname = new URL(request.url ?? '/', target).pathname;
  if (pathname !== '/rpc' && pathname !== '/relay') {
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    return;
  }
  forwardWebSocketUpgrade(
    request,
    socket,
    head,
    pathname === '/relay' ? `http://127.0.0.1:${fixturePort + 3}` : target,
  );
});
server.listen(port, '127.0.0.1', () =>
  console.info(`ARTIFACT_BROWSER_READY release=${manifest.releaseId} port=${port}`),
);
const close = () => {
  proxy.close();
  server.close();
  server.closeAllConnections();
};
process.once('SIGTERM', close);
process.once('SIGINT', close);
