#!/usr/bin/env bun

import { join } from 'node:path';

import { safeStringify } from '../../../core/protocol/serialization';

import { readLifecycleReleaseInputs } from '../release/lifecycle-release-inputs';
import {
  createPwaCandidatePlan,
  PWA_CANDIDATE_RELEASE_PATH,
  PWA_CANDIDATE_WORKER_PATH,
  type PwaCandidatePlan,
} from './pwa-candidate';

type ServedRelease = Readonly<{
  directory: string;
  plan: PwaCandidatePlan;
  paths: ReadonlySet<string>;
  walletEntrySha256: string;
}>;

const HOST = process.env['XLN_PWA_SMOKE_HOST'] ?? '127.0.0.1';
const PORT = Number(process.env['XLN_PWA_SMOKE_PORT'] ?? '19091');

const assertPort = (): void => {
  if (!Number.isSafeInteger(PORT) || PORT < 1 || PORT > 65_535) throw new Error('PWA_SMOKE_PORT_INVALID');
};

const servedRelease = async (directory: string): Promise<ServedRelease> => {
  const plan = await createPwaCandidatePlan(directory);
  const entry = plan.files.find(({ path }) => path === 'apps/wallet/index.html');
  if (!entry) throw new Error('PWA_SMOKE_WALLET_ENTRY_MISSING');
  return {
    directory,
    plan,
    paths: new Set(plan.files.map(({ path }) => path)),
    walletEntrySha256: entry.sha256,
  };
};

const decodeReleasePath = (encoded: string): string | null => {
  try {
    return encoded.split('/').map(decodeURIComponent).join('/');
  } catch {
    return null;
  }
};

const responseHeaders = { 'cache-control': 'no-store' } as const;
const textResponse = (body: string, status = 200): Response =>
  new Response(body, {
    status,
    headers: { ...responseHeaders, 'content-type': 'text/plain; charset=utf-8' },
  });

const main = async (): Promise<void> => {
  assertPort();
  const inputs = await readLifecycleReleaseInputs();
  const [installRelease, updateRelease] = await Promise.all([
    servedRelease(inputs.install.directory),
    servedRelease(inputs.update.directory),
  ]);
  if (installRelease.plan.releaseId === updateRelease.plan.releaseId) {
    throw new Error('PWA_SMOKE_RELEASE_IDENTITIES_EQUAL');
  }
  const releases = [installRelease, updateRelease] as const;
  const releaseMap = new Map<string, ServedRelease>(releases.map(release => [release.plan.releaseId, release]));
  let activeRelease: ServedRelease = installRelease;
  let releaseNetworkOnline = true;

  const state = () => ({
    activeReleaseId: activeRelease.plan.releaseId,
    releaseNetworkOnline,
    releases: releases.map(({ plan, walletEntrySha256 }) => ({
      releaseId: plan.releaseId,
      cacheName: plan.cacheName,
      fileCount: plan.files.length,
      serviceWorkerSha256: plan.serviceWorkerSha256,
      walletEntrySha256,
    })),
  });

  const server = Bun.serve({
    hostname: HOST,
    port: PORT,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/__xln-pwa/state') {
        return new Response(`${safeStringify(state(), 2)}\n`, {
          headers: { ...responseHeaders, 'content-type': 'application/json' },
        });
      }
      if (request.method === 'GET' && url.pathname === '/__xln-pwa/harness') {
        return new Response('<!doctype html><meta charset="utf-8"><title>xln PWA lifecycle smoke</title>', {
          headers: { ...responseHeaders, 'content-type': 'text/html; charset=utf-8' },
        });
      }
      if (request.method === 'GET' && url.pathname === PWA_CANDIDATE_WORKER_PATH) {
        return new Response(activeRelease.plan.serviceWorkerSource, {
          headers: {
            ...responseHeaders,
            'content-type': 'application/javascript; charset=utf-8',
            'service-worker-allowed': '/',
          },
        });
      }
      if (request.method === 'POST' && url.pathname === '/__xln-pwa/active') {
        const requested = await request.text();
        const selected = releaseMap.get(requested);
        if (!selected) return textResponse('PWA_SMOKE_RELEASE_UNKNOWN', 400);
        activeRelease = selected;
        return textResponse('PWA_SMOKE_ACTIVE_OK');
      }
      if (request.method === 'POST' && url.pathname === '/__xln-pwa/release-network') {
        const requested = await request.text();
        if (requested !== 'online' && requested !== 'offline') {
          return textResponse('PWA_SMOKE_NETWORK_STATE_INVALID', 400);
        }
        releaseNetworkOnline = requested === 'online';
        return textResponse('PWA_SMOKE_NETWORK_OK');
      }
      for (const release of releases) {
        const prefix = `${PWA_CANDIDATE_RELEASE_PATH}/${release.plan.releaseId}/`;
        if (request.method !== 'GET' || !url.pathname.startsWith(prefix)) continue;
        if (!releaseNetworkOnline) return textResponse('PWA_SMOKE_RELEASE_NETWORK_OFFLINE', 503);
        const path = decodeReleasePath(url.pathname.slice(prefix.length));
        if (path === null || !release.paths.has(path)) return textResponse('PWA_SMOKE_FILE_UNKNOWN', 404);
        return new Response(Bun.file(join(release.directory, path)), {
          headers: { 'cache-control': 'public, max-age=31536000, immutable' },
        });
      }
      return textResponse('PWA_SMOKE_ROUTE_UNKNOWN', 404);
    },
  });

  let stopping = false;
  const stop = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    server.stop();
    process.exit(0);
  };
  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());
  console.info(
    `PWA_SMOKE_SERVER_OK url=http://${HOST}:${PORT} install=${installRelease.plan.releaseId} ` +
      `update=${updateRelease.plan.releaseId} files=${installRelease.plan.files.length}`,
  );
};

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
