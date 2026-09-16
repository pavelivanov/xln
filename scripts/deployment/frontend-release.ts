#!/usr/bin/env bun
import { resolve } from 'node:path';
import { safeStringify } from '../../core/protocol/serialization';
import {
  activateDeploymentCandidate,
  rollbackDeploymentCandidate,
  stageDeploymentCandidateRelease,
  verifyDeploymentCandidateState,
  resolveDeploymentRoot,
} from '../../packages/frontend-release/deployment';
import { requestedReleasePath } from '../../packages/frontend-release/serve';
import { verifyCandidateReleaseDirectory } from '../../packages/frontend-release/verify';

const exactId = (value: string | undefined): string => {
  if (!value || !/^sha256-[0-9a-f]{64}$/.test(value)) throw new Error('FRONTEND_DEPLOYMENT_EXPECTED_ID_REQUIRED');
  return value;
};

export const verifyLiveFrontend = async (root: string, origin: string, expectedId: string): Promise<void> => {
  const url = new URL(origin);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('FRONTEND_DEPLOYMENT_ORIGIN_INVALID');
  }
  const selected = await verifyDeploymentCandidateState(root);
  if (selected.state.activeReleaseId !== exactId(expectedId)) throw new Error('DEPLOYMENT_CANDIDATE_ACTIVE_CHANGED');
  const manifest = await verifyCandidateReleaseDirectory(selected.activeDirectory);
  for (const route of ['/', '/docs', '/app', '/health', '/runtime.js', '/account-worker.js']) {
    const path = requestedReleasePath(route, manifest);
    const file = manifest.files.find(file => file.path === path);
    if (!file) throw new Error(`FRONTEND_DEPLOYMENT_PROBE_ASSET_MISSING:${route}`);
    const response = await fetch(new URL(route, url), {
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const bytes = await response.arrayBuffer();
    const actual = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
    if (
      response.status !== 200 ||
      response.headers.get('x-xln-deployment-release') !== expectedId ||
      actual !== file.sha256
    ) {
      throw new Error(`FRONTEND_DEPLOYMENT_LIVE_MISMATCH:${route}:status=${response.status}`);
    }
  }
};

const switchLiveFrontend = async (root: string, source: string | null, expected: string, origin?: string) => {
  if (origin) await verifyLiveFrontend(root, origin, expected);
  const selected =
    source === null
      ? await rollbackDeploymentCandidate(root, expected)
      : await activateDeploymentCandidate(source, root, expected);
  if (origin) {
    try {
      await verifyLiveFrontend(root, origin, selected.state.activeReleaseId);
    } catch (cause) {
      await rollbackDeploymentCandidate(root, selected.state.activeReleaseId);
      await verifyLiveFrontend(root, origin, expected);
      throw new Error('FRONTEND_DEPLOYMENT_LIVE_FAILED_ROLLED_BACK', { cause });
    }
  }
  return selected;
};

const main = async (): Promise<void> => {
  const [command, rootArg, ...args] = Bun.argv.slice(2);
  if (!command || !rootArg) throw new Error('FRONTEND_DEPLOYMENT_ARGUMENTS_INVALID');
  if (command === 'check') {
    if (args.length) throw new Error('FRONTEND_DEPLOYMENT_ARGUMENTS_INVALID');
    const manifest = await verifyCandidateReleaseDirectory(resolve(rootArg));
    console.info(safeStringify({ releaseId: manifest.releaseId, files: manifest.files.length }));
    return;
  }
  const root = resolveDeploymentRoot(rootArg);
  if (command === 'verify-live') {
    if (args.length !== 2) throw new Error('FRONTEND_DEPLOYMENT_ARGUMENTS_INVALID');
    await verifyLiveFrontend(root, args[0]!, exactId(args[1]));
    console.info('FRONTEND_DEPLOYMENT_LIVE_OK');
    return;
  }
  if (command === 'verify') {
    if (args.length) throw new Error('FRONTEND_DEPLOYMENT_ARGUMENTS_INVALID');
    console.info(safeStringify(await verifyDeploymentCandidateState(root)));
    return;
  }
  if (command === 'rollback') {
    if (args.length < 1 || args.length > 2) throw new Error('FRONTEND_DEPLOYMENT_ARGUMENTS_INVALID');
    console.info(safeStringify(await switchLiveFrontend(root, null, exactId(args[0]), args[1])));
    return;
  }
  if (
    !['stage', 'initialize', 'activate'].includes(command) ||
    !args[0] ||
    (command === 'activate' ? args.length < 2 || args.length > 3 : args.length !== 1)
  ) {
    throw new Error('FRONTEND_DEPLOYMENT_ARGUMENTS_INVALID');
  }
  const source = resolve(args[0]);
  const selected =
    command === 'stage'
      ? await stageDeploymentCandidateRelease(source, root)
      : command === 'initialize'
        ? await activateDeploymentCandidate(source, root, null)
        : await switchLiveFrontend(root, source, exactId(args[1]), args[2]);
  console.info(safeStringify(selected));
};

if (import.meta.main)
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
