import { createServer } from 'node:http';
import type { Socket } from 'node:net';
import { createProxyServer } from 'http-proxy-3';

import { forwardWebSocketUpgrade } from '../dev/dev-gateway';
import { serveVerifiedReleaseRequest } from '../../../packages/frontend-release/http';
import { verifyCandidateReleaseDirectory } from '../../../packages/frontend-release/verify';

export type VerifiedReleaseServerOptions = Readonly<{
  directory: string;
  target: string;
  relayTarget: string;
  identityPath?: string;
  sourceSha?: string;
}>;

export const createVerifiedReleaseServer = async ({
  directory,
  target,
  relayTarget,
  identityPath = '/__xln-release/identity',
  sourceSha,
}: VerifiedReleaseServerOptions) => {
  const manifest = await verifyCandidateReleaseDirectory(directory);
  const proxy = createProxyServer({ xfwd: true, changeOrigin: false });
  const server = createServer(async (request, response) => {
    try {
      const rawUrl = request.url ?? '/';
      const url = new URL(rawUrl, 'http://127.0.0.1');
      if (url.pathname === identityPath) {
        const checked = await verifyCandidateReleaseDirectory(directory);
        if (checked.releaseId !== manifest.releaseId) throw new Error('VERIFIED_RELEASE_CHANGED');
        response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        response.end(
          JSON.stringify({
            releaseId: checked.releaseId,
            files: checked.files.length,
            sourceSha,
          }),
        );
        return;
      }
      // Use a metadata-only Request: proxying retains the original stream and
      // origin/auth headers instead of consuming or reconstructing its body.
      const file = await serveVerifiedReleaseRequest(
        directory,
        manifest,
        new Request(url, { method: request.method ?? 'GET' }),
      );
      if (file) {
        response.writeHead(file.status, Object.fromEntries(file.headers));
        response.end(request.method === 'HEAD' ? undefined : Buffer.from(await file.arrayBuffer()));
      } else {
        proxy.web(request, response, { target, changeOrigin: false }, error => {
          console.error(`VERIFIED_RELEASE_PROXY_FAILED:${error.message}`);
          if (response.headersSent) response.destroy(error);
          else {
            response.writeHead(502);
            response.end('VERIFIED_RELEASE_PROXY_FAILED');
          }
        });
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
    forwardWebSocketUpgrade(request, socket, head, pathname === '/relay' ? relayTarget : target);
  });
  const connections = new Set<Socket>();
  server.on('connection', socket => {
    connections.add(socket);
    socket.once('close', () => connections.delete(socket));
  });
  const close = (): Promise<void> =>
    new Promise((resolve, reject) => {
      proxy.close();
      server.close(error => (error ? reject(error) : resolve()));
      for (const socket of connections) socket.destroy();
    });
  return { server, manifest, close };
};
