import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer as createSecureServer } from 'node:https';
import { createConnection, type Socket } from 'node:net';
import { connect as createTlsConnection } from 'node:tls';

import { createProxyServer } from 'http-proxy-3';

import { safeStringify } from '../../../core/protocol/serialization';
import {
  createDevelopmentGatewayTargets,
  parseDevelopmentGatewayPort,
  parseDevelopmentPortOffset,
  resolveDevelopmentGatewayRequest,
  rewriteDevelopmentGatewayUrl,
  type DevelopmentGatewayDecision,
  type GatewayProxyOwner,
} from '../../config/development-gateway';
import { SURFACE_IDS, type SurfaceId } from '../../../packages/frontend-release/surfaces';

type GatewayTargets = Readonly<Record<GatewayProxyOwner, string>>;
type GatewayProxyOwners = Readonly<Partial<Record<SurfaceId, SurfaceId>>>;

export type DevelopmentGatewayOptions = Readonly<{
  runtimeDirectory?: string;
  tls?: Readonly<{ cert: Buffer; key: Buffer }>;
  targets: GatewayTargets;
  proxyOwners?: GatewayProxyOwners;
  edgeWebSocketTarget?: string;
}>;

export const resolveDevelopmentProxyOwner = (
  owner: GatewayProxyOwner,
  proxyOwners: GatewayProxyOwners = {},
): GatewayProxyOwner => owner === 'edge' ? owner : proxyOwners[owner] ?? owner;

const writeLocalResponse = (
  response: ServerResponse,
  status: number,
  body: string,
  headers: Readonly<Record<string, string>>,
): void => {
  response.writeHead(status, headers);
  response.end(body);
};

const writeProxyFailure = (response: ServerResponse, owner: GatewayProxyOwner, error: Error): void => {
  if (response.headersSent) {
    response.destroy(error);
    return;
  }
  writeLocalResponse(
    response,
    502,
    `${safeStringify({ error: 'DEVELOPMENT_GATEWAY_PROXY_FAILED', owner, detail: error.message })}\n`,
    { 'content-type': 'application/json; charset=utf-8' },
  );
};

const rejectUpgrade = (socket: Socket, status: number, message: string): void => {
  if (socket.destroyed) return;
  socket.end(
    `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${message}\n`,
  );
};

export const forwardWebSocketUpgrade = (
  request: IncomingMessage,
  socket: Socket,
  head: Buffer,
  target: string,
): void => {
  // Preserve the browser's original Host and upgrade headers byte-for-byte.
  // The relay/runtime audience is origin-bound, while the target port is only
  // an internal development detail and must not become part of that audience.
  const upstream = new URL(target);
  const secure = upstream.protocol === 'https:' || upstream.protocol === 'wss:';
  if (!secure && upstream.protocol !== 'http:' && upstream.protocol !== 'ws:') {
    rejectUpgrade(socket, 502, `DEVELOPMENT_GATEWAY_WS_PROTOCOL_INVALID:${upstream.protocol}`);
    return;
  }
  const port = Number(upstream.port || (secure ? '443' : '80'));
  const upstreamSocket = secure
    ? createTlsConnection({ host: upstream.hostname, port, servername: upstream.hostname })
    : createConnection({ host: upstream.hostname, port });
  const connectEvent = secure ? 'secureConnect' : 'connect';
  upstreamSocket.once(connectEvent, () => {
    const headers: string[] = [];
    for (let index = 0; index < request.rawHeaders.length; index += 2) {
      headers.push(`${request.rawHeaders[index]}: ${request.rawHeaders[index + 1]}`);
    }
    upstreamSocket.write(
      `${request.method ?? 'GET'} ${request.url ?? '/'} HTTP/${request.httpVersion}\r\n${headers.join('\r\n')}\r\n\r\n`,
    );
    if (head.byteLength > 0) upstreamSocket.write(head);
    socket.pipe(upstreamSocket);
    upstreamSocket.pipe(socket);
    socket.resume();
    upstreamSocket.resume();
  });
  upstreamSocket.once('error', (error) => {
    rejectUpgrade(socket, 502, `DEVELOPMENT_GATEWAY_WS_FAILED:${error.message}`);
  });
  socket.once('error', (error) => upstreamSocket.destroy(error));
  // Closing a preview/dev listener also closes upgraded connections. Propagate
  // that closure to its upstream so the owned process can finish on SIGTERM.
  socket.once('close', () => upstreamSocket.destroy());
  upstreamSocket.once('close', () => socket.destroy());
};

export const resolveLiveRuntimeFilename = (rawUrl: string): string | undefined => {
  const pathname = new URL(rawUrl, 'http://localhost').pathname;
  return /^\/(?:__app\/(?:wallet|ops)\/)?(runtime\.js|account-worker\.js)$/.exec(pathname)?.[1];
};

export const createDevelopmentGateway = ({ targets, tls,
  runtimeDirectory,
  proxyOwners = {}, edgeWebSocketTarget = targets.edge }: DevelopmentGatewayOptions) => {
  const proxy = createProxyServer({ xfwd: true, changeOrigin: false });
  const handleRequest = (request: IncomingMessage, response: ServerResponse): void => {
    const rawUrl = request.url ?? '/';
    let decision: DevelopmentGatewayDecision;
    try {
      decision = resolveDevelopmentGatewayRequest(rawUrl);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      writeLocalResponse(response, 400, `${detail}\n`, { 'content-type': 'text/plain; charset=utf-8' });
      return;
    }
    if (decision.kind === 'redirect') {
      writeLocalResponse(response, decision.status, '', { location: decision.location });
      return;
    }
    if (decision.kind === 'response') {
      writeLocalResponse(response, decision.status, decision.body, decision.headers);
      return;
    }

    // Root dev owns continuously rebuilt browser bundles. Read those exact
    // files on every request; release/standalone app preparation stays immutable.
    const runtimeFile = runtimeDirectory ? resolveLiveRuntimeFilename(rawUrl) : undefined;
    if (runtimeFile && runtimeDirectory) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        writeLocalResponse(response, 405, '', { allow: 'GET, HEAD' });
        return;
      }
      try {
        const bytes = readFileSync(join(runtimeDirectory, runtimeFile));
        response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
        response.end(request.method === 'HEAD' ? undefined : bytes);
      } catch (error) {
        writeProxyFailure(response, 'wallet', error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }

    const proxyOwner = resolveDevelopmentProxyOwner(decision.owner, proxyOwners);
    const routedDecision = proxyOwner === decision.owner ? decision : { ...decision, owner: proxyOwner };
    request.url = rewriteDevelopmentGatewayUrl(rawUrl, routedDecision);
    proxy.web(request, response, { target: targets[proxyOwner], changeOrigin: false }, (error) => {
      writeProxyFailure(response, proxyOwner, error);
    });
  };
  const server = tls ? createSecureServer(tls, handleRequest) : createServer(handleRequest);

  server.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const rawUrl = request.url ?? '/';
    let decision: DevelopmentGatewayDecision;
    try {
      decision = resolveDevelopmentGatewayRequest(rawUrl);
    } catch (error: unknown) {
      rejectUpgrade(socket, 400, error instanceof Error ? error.message : String(error));
      return;
    }
    if (decision.kind !== 'proxy') {
      rejectUpgrade(socket, 400, 'DEVELOPMENT_GATEWAY_UPGRADE_REJECTED');
      return;
    }
    const proxyOwner = resolveDevelopmentProxyOwner(decision.owner, proxyOwners);
    const routedDecision = proxyOwner === decision.owner ? decision : { ...decision, owner: proxyOwner };
    request.url = rewriteDevelopmentGatewayUrl(rawUrl, routedDecision);
    forwardWebSocketUpgrade(request, socket, head, proxyOwner === 'edge' ? edgeWebSocketTarget : targets[proxyOwner]);
  });

  server.on('clientError', (error: Error, socket: Socket) => {
    rejectUpgrade(socket, 400, `DEVELOPMENT_GATEWAY_CLIENT_ERROR:${error.message}`);
  });
  return server;
};

export const readDevelopmentGatewayTls = (
  certPath = process.env['XLN_REACT_GATEWAY_TLS_CERT'],
  keyPath = process.env['XLN_REACT_GATEWAY_TLS_KEY'],
): DevelopmentGatewayOptions['tls'] => {
  if (certPath === undefined && keyPath === undefined) return undefined;
  if (!certPath?.trim() || !keyPath?.trim()) throw new Error('DEVELOPMENT_GATEWAY_TLS_PAIR_REQUIRED');
  return { cert: readFileSync(certPath), key: readFileSync(keyPath) };
};

const run = (): void => {
  const host = process.env['XLN_REACT_GATEWAY_HOST'] ?? '127.0.0.1';
  const defaults = createDevelopmentGatewayTargets(
    process.env['XLN_REACT_EDGE_TARGET'],
    parseDevelopmentPortOffset(process.env['XLN_REACT_PORT_OFFSET']),
  );
  const targets: GatewayTargets = {
    edge: defaults.edge,
    site: process.env['XLN_REACT_SITE_TARGET'] ?? defaults.site,
    docs: process.env['XLN_REACT_DOCS_TARGET'] ?? defaults.docs,
    wallet: process.env['XLN_REACT_WALLET_TARGET'] ?? defaults.wallet,
    ops: process.env['XLN_REACT_OPS_TARGET'] ?? defaults.ops,
  };
  const docsProxyOwnerRaw = process.env['XLN_REACT_DOCS_PROXY_OWNER'];
  const docsProxyOwner = docsProxyOwnerRaw === undefined
    ? undefined
    : SURFACE_IDS.find((surfaceId) => surfaceId === docsProxyOwnerRaw);
  if (docsProxyOwnerRaw !== undefined && docsProxyOwner === undefined) {
    throw new Error(`DEVELOPMENT_GATEWAY_DOCS_PROXY_OWNER_INVALID:${docsProxyOwnerRaw}`);
  }
  const walletProxyOwnerRaw = process.env['XLN_REACT_WALLET_PROXY_OWNER'];
  const walletProxyOwner = walletProxyOwnerRaw === undefined
    ? undefined
    : SURFACE_IDS.find((surfaceId) => surfaceId === walletProxyOwnerRaw);
  if (walletProxyOwnerRaw !== undefined && walletProxyOwner === undefined) {
    throw new Error(`DEVELOPMENT_GATEWAY_WALLET_PROXY_OWNER_INVALID:${walletProxyOwnerRaw}`);
  }
  const tls = readDevelopmentGatewayTls();
  const server = createDevelopmentGateway({
    targets,
    ...(tls ? { tls } : {}),
    ...(process.env['XLN_REACT_LIVE_RUNTIME_DIRECTORY']
      ? { runtimeDirectory: process.env['XLN_REACT_LIVE_RUNTIME_DIRECTORY'] }
      : {}),
    ...(process.env['XLN_REACT_EDGE_WEBSOCKET_TARGET'] ? { edgeWebSocketTarget: process.env['XLN_REACT_EDGE_WEBSOCKET_TARGET'] } : {}),
    proxyOwners: {
      ...(docsProxyOwner === undefined ? {} : { docs: docsProxyOwner }),
      ...(walletProxyOwner === undefined ? {} : { wallet: walletProxyOwner }),
    },
  });
  server.listen(parseDevelopmentGatewayPort(process.env['XLN_REACT_GATEWAY_PORT']), host, () => {
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('DEVELOPMENT_GATEWAY_ADDRESS_INVALID');
    console.info(`FRONTEND_GATEWAY_READY origin=${tls ? 'https' : 'http'}://${host}:${address.port}`);
  });
  const connections = new Set<Socket>();
  server.on('connection', socket => {
    connections.add(socket);
    socket.once('close', () => connections.delete(socket));
  });
  let closing = false;
  const close = (): void => {
    if (closing) return;
    closing = true;
    server.close((error?: Error) => {
      if (error !== undefined) throw error;
    });
    for (const socket of connections) socket.destroy();
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
};

if (import.meta.main) {
  try {
    run();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
