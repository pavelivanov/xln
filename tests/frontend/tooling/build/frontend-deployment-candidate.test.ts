import { prepareVerifiedDeployment } from '../../../../packages/frontend-release/deployment-http';
import { prepareVerifiedRelease } from '../../../../packages/frontend-release/http';
import { afterEach, describe, expect, test } from 'bun:test';
import { cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { safeStringify } from '../../../../core/protocol/serialization';
import { SURFACE_IDS, type SurfaceId } from '../../../../packages/frontend-release/surfaces';
import { assembleCandidateRelease } from '../../../../frontend/scripts/release/candidate-release';
import { requestedReleasePath, serveCandidateReleaseFile } from '../../../../packages/frontend-release/serve';
import {
  DEPLOYMENT_CANDIDATE_STATE,
  activateDeploymentCandidate,
  deploymentReleaseDirectory,
  readDeploymentCandidateState,
  resolveDeploymentRoot,
  rollbackDeploymentCandidate,
  stageDeploymentCandidateRelease,
  verifyDeploymentCandidateState,
} from '../../../../packages/frontend-release/deployment';

const temporaryRoots: string[] = [];

const writeSurface = async (frontendRoot: string, surface: SurfaceId, marker: string): Promise<void> => {
  const artifactRoot = join(frontendRoot, '.artifacts', surface);
  const assetPath = `assets/${surface}/index.js`;
  await mkdir(join(artifactRoot, `assets/${surface}`), { recursive: true });
  await writeFile(join(artifactRoot, 'index.html'), `<script type="module" src="/${assetPath}"></script>\n`);
  await writeFile(join(artifactRoot, assetPath), `document.body.dataset.release = '${marker}-${surface}';\n`);
  await writeFile(join(artifactRoot, 'manifest.json'), `${safeStringify({
    'index.html': { file: assetPath, name: 'index', src: 'index.html', isEntry: true },
  }, 2)}\n`);
};

const createReleasePair = async () => {
  const root = await mkdtemp(join(tmpdir(), 'xln-deployment-candidate-'));
  temporaryRoots.push(root);
  const frontendRoot = join(root, 'frontend');
  await mkdir(frontendRoot, { recursive: true });
  for (const surface of SURFACE_IDS) await writeSurface(frontendRoot, surface, 'first');
  const first = await assembleCandidateRelease(frontendRoot, []);
  await writeSurface(frontendRoot, 'wallet', 'second');
  const second = await assembleCandidateRelease(frontendRoot, []);
  return { root, deploymentRoot: join(root, 'deployment'), first, second };
};

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('isolated deployment candidate selection', () => {
  test('a live HTTP reader switches whole releases and rejects stale activation and rollback', async () => {
    const fixture = await createReleasePair();
    await activateDeploymentCandidate(fixture.first.releaseDirectory, fixture.deploymentRoot, null);
    const reader = await prepareVerifiedDeployment(fixture.deploymentRoot);
    const request = () => new Request('http://localhost/app');
    expect((await reader.serve(request()))?.headers.get('x-xln-deployment-release')).toBe(fixture.first.releaseId);
    await expect(
      activateDeploymentCandidate(fixture.second.releaseDirectory, fixture.deploymentRoot, fixture.second.releaseId),
    ).rejects.toThrow('DEPLOYMENT_CANDIDATE_ACTIVE_CHANGED');
    await activateDeploymentCandidate(fixture.second.releaseDirectory, fixture.deploymentRoot, fixture.first.releaseId);
    expect((await reader.serve(request()))?.headers.get('x-xln-deployment-release')).toBe(fixture.second.releaseId);
    await expect(rollbackDeploymentCandidate(fixture.deploymentRoot, fixture.first.releaseId)).rejects.toThrow(
      'DEPLOYMENT_CANDIDATE_ACTIVE_CHANGED',
    );
    await rollbackDeploymentCandidate(fixture.deploymentRoot, fixture.second.releaseId);
    expect((await reader.serve(request()))?.headers.get('x-xln-deployment-release')).toBe(fixture.first.releaseId);
    await writeFile(
      join(deploymentReleaseDirectory(fixture.deploymentRoot, fixture.first.releaseId), 'apps/wallet/index.html'),
      'corrupt',
    );
    await expect(reader.serve(request())).rejects.toThrow('CANDIDATE_RELEASE_FILE_MISMATCH');
  });

  test('serves exact release routes and asset hashes while rejecting unknown paths and changed bytes', async () => {
    const { first } = await createReleasePair();
    const routes = new Map([
      ['/', 'site'],
      ['/docs', 'docs'],
      ['/app', 'wallet'],
      ['/address/0x123', 'wallet'],
      ['/health', 'ops'],
    ]);
    for (const [route, surface] of routes) {
      expect(requestedReleasePath(route, first.manifest)).toBe(`apps/${surface}/index.html`);
      const response = await serveCandidateReleaseFile(first.releaseDirectory, first.manifest, route);
      expect(response.headers.get('x-xln-deployment-release')).toBe(first.releaseId);
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(await response.text()).toBe(
        await readFile(join(first.releaseDirectory, `apps/${surface}/index.html`), 'utf8'),
      );
    }
    const asset = first.manifest.files.find(file => file.path === 'assets/wallet/index.js');
    const response = await serveCandidateReleaseFile(first.releaseDirectory, first.manifest, '/assets/wallet/index.js');
    expect(response.headers.get('x-xln-content-sha256')).toBe(asset?.sha256);
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    for (const path of [
      '/unknown',
      '/assets/wallet/missing.js',
      '/__app/wallet/src/main.tsx',
      '/%2e%2e/secret',
      '/assets//wallet/index.js',
      '/assets/%5csecret',
      '/%invalid',
      '/api/private',
    ]) {
      expect(requestedReleasePath(path, first.manifest)).toBeNull();
      expect((await serveCandidateReleaseFile(first.releaseDirectory, first.manifest, path)).status).toBe(404);
    }
    await writeFile(join(first.releaseDirectory, 'assets/wallet/index.js'), 'changed');
    await expect(
      serveCandidateReleaseFile(first.releaseDirectory, first.manifest, '/assets/wallet/index.js'),
    ).rejects.toThrow('CANDIDATE_RELEASE_FILE_MISMATCH:assets/wallet/index.js');
  });

  test('verified HTTP serving preserves edge ownership and rejects corruption without a static fallback', async () => {
    const { first } = await createReleasePair();
    const release = await prepareVerifiedRelease(first.releaseDirectory);
    const request = (path: string, method = 'GET') => new Request(`http://localhost:8080${path}`, { method });
    const head = await release.serve(request('/app', 'HEAD'));
    expect(head?.status).toBe(200);
    expect(head?.headers.get('x-xln-deployment-release')).toBe(first.releaseId);
    expect(await head?.text()).toBe('');
    expect((await release.serve(request('/app', 'POST')))?.status).toBe(405);
    expect(await release.serve(request('/api/tokens'))).toBeNull();
    expect(await release.serve(request('/rpc', 'POST'))).toBeNull();
    expect((await release.serve(request('/unknown')))?.status).toBe(404);
    expect((await release.serve(request('/runtime.js')))?.status).toBe(404);
    expect((await release.serve(request('/admin')))?.headers.get('location')).toBe('/health');
    expect((await release.serve(request('/radapter?token=forbidden')))?.status).toBe(400);
    expect((await release.serve(request('/resetdb')))?.headers.get('clear-site-data')).toBe('"*"');
    await writeFile(join(first.releaseDirectory, 'apps/wallet/index.html'), 'corrupt');
    await expect(release.serve(request('/app'))).rejects.toThrow('CANDIDATE_RELEASE_FILE_MISMATCH');
    await expect(prepareVerifiedRelease(first.releaseDirectory)).rejects.toThrow('CANDIDATE_RELEASE_FILE_MISMATCH');
  });

  test('atomically activates two exact releases and rolls back the whole release', async () => {
    const fixture = await createReleasePair();
    const firstSourceBefore = await readFile(join(fixture.first.releaseDirectory, 'release-manifest.json'));
    const first = await activateDeploymentCandidate(fixture.first.releaseDirectory, fixture.deploymentRoot);
    const second = await activateDeploymentCandidate(fixture.second.releaseDirectory, fixture.deploymentRoot);
    const rolledBack = await rollbackDeploymentCandidate(fixture.deploymentRoot);

    expect(first.state).toEqual({
      schemaVersion: 1,
      activeReleaseId: fixture.first.releaseId,
      rollbackReleaseId: null,
    });
    expect(second.state.activeReleaseId).toBe(fixture.second.releaseId);
    expect(second.state.rollbackReleaseId).toBe(fixture.first.releaseId);
    expect(rolledBack.state.activeReleaseId).toBe(fixture.first.releaseId);
    expect(rolledBack.state.rollbackReleaseId).toBe(fixture.second.releaseId);
    expect(await readFile(join(fixture.first.releaseDirectory, 'release-manifest.json'))).toEqual(firstSourceBefore);
    expect(await readFile(join(rolledBack.activeDirectory, 'apps/wallet/index.html')))
      .toEqual(await readFile(join(fixture.first.releaseDirectory, 'apps/wallet/index.html')));
    await expect(activateDeploymentCandidate(fixture.first.releaseDirectory, fixture.deploymentRoot))
      .rejects.toThrow('DEPLOYMENT_CANDIDATE_ALREADY_ACTIVE');
    expect((await verifyDeploymentCandidateState(fixture.deploymentRoot)).state).toEqual(rolledBack.state);
  });

  test('reuses exact staged releases and refuses stored corruption without repair', async () => {
    const fixture = await createReleasePair();
    const created = await stageDeploymentCandidateRelease(fixture.first.releaseDirectory, fixture.deploymentRoot);
    const reused = await stageDeploymentCandidateRelease(fixture.first.releaseDirectory, fixture.deploymentRoot);
    const storedAsset = join(created.releaseDirectory, 'assets/wallet/index.js');
    await writeFile(storedAsset, 'corrupt\n');

    expect(created.status).toBe('created');
    expect(reused.status).toBe('reused');
    await expect(stageDeploymentCandidateRelease(fixture.first.releaseDirectory, fixture.deploymentRoot))
      .rejects.toThrow('CANDIDATE_RELEASE_FILE_MISMATCH:assets/wallet/index.js');
    expect(await readFile(storedAsset, 'utf8')).toBe('corrupt\n');
  });

  test('rejects mixed, missing, and symlinked candidates before state changes', async () => {
    const fixture = await createReleasePair();
    const active = await activateDeploymentCandidate(fixture.first.releaseDirectory, fixture.deploymentRoot);
    const stateBefore = await readFile(join(fixture.deploymentRoot, DEPLOYMENT_CANDIDATE_STATE));
    const invalidRoot = join(fixture.root, 'invalid');
    const mixed = join(invalidRoot, fixture.second.releaseId);
    await cp(fixture.second.releaseDirectory, mixed, { recursive: true });
    await cp(
      join(fixture.first.releaseDirectory, 'assets/wallet/index.js'),
      join(mixed, 'assets/wallet/index.js'),
    );
    await expect(activateDeploymentCandidate(mixed, fixture.deploymentRoot))
      .rejects.toThrow('CANDIDATE_RELEASE_FILE_MISMATCH:assets/wallet/index.js');
    await rm(join(mixed, 'release-manifest.json'));
    await expect(activateDeploymentCandidate(mixed, fixture.deploymentRoot))
      .rejects.toThrow('CANDIDATE_RELEASE_MANIFEST_READ_FAILED');
    const linkRoot = join(fixture.root, 'links');
    await mkdir(linkRoot);
    const linked = join(linkRoot, fixture.second.releaseId);
    await symlink(fixture.second.releaseDirectory, linked);
    await expect(activateDeploymentCandidate(linked, fixture.deploymentRoot))
      .rejects.toThrow('CANDIDATE_RELEASE_ROOT_INVALID');

    expect(await readFile(join(fixture.deploymentRoot, DEPLOYMENT_CANDIDATE_STATE))).toEqual(stateBefore);
    expect((await verifyDeploymentCandidateState(fixture.deploymentRoot)).state).toEqual(active.state);
  });

  test('fails closed on malformed state, unavailable rollback, and an activation lock', async () => {
    const fixture = await createReleasePair();
    await expect(rollbackDeploymentCandidate(fixture.deploymentRoot))
      .rejects.toThrow('DEPLOYMENT_CANDIDATE_STATE_READ_FAILED');
    await activateDeploymentCandidate(fixture.first.releaseDirectory, fixture.deploymentRoot);
    await expect(rollbackDeploymentCandidate(fixture.deploymentRoot))
      .rejects.toThrow('DEPLOYMENT_CANDIDATE_ROLLBACK_UNAVAILABLE');
    await mkdir(join(fixture.deploymentRoot, '.deployment-candidate.lock'));
    await expect(activateDeploymentCandidate(fixture.second.releaseDirectory, fixture.deploymentRoot))
      .rejects.toThrow('DEPLOYMENT_CANDIDATE_ACTIVATION_BUSY');
    await rm(join(fixture.deploymentRoot, '.deployment-candidate.lock'), { recursive: true });
    await writeFile(join(fixture.deploymentRoot, DEPLOYMENT_CANDIDATE_STATE), '{}\n');
    await expect(readDeploymentCandidateState(fixture.deploymentRoot))
      .rejects.toThrow('DEPLOYMENT_CANDIDATE_STATE_KEYS_INVALID');
    expect(() => deploymentReleaseDirectory(fixture.deploymentRoot, '../escape'))
      .toThrow('DEPLOYMENT_CANDIDATE_RELEASE_ID_INVALID');
    expect(() => resolveDeploymentRoot('/')).toThrow('DEPLOYMENT_CANDIDATE_ROOT_UNSAFE');
    expect((await lstat(deploymentReleaseDirectory(fixture.deploymentRoot, fixture.second.releaseId))).isDirectory())
      .toBe(true);
  });
});
