import { afterEach, describe, expect, test } from 'bun:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  readLifecycleReleaseInputs,
  requireLifecycleReleaseDirectories,
  verifyLifecycleReleaseInputs,
} from '../../../../frontend/scripts/release/lifecycle-release-inputs';

import { SURFACE_IDS } from '../../../../packages/frontend-release/surfaces';
import { assembleCandidateRelease } from '../../../../frontend/scripts/release/candidate-release';
import {
  createPwaCandidatePlan,
  PWA_CANDIDATE_CACHE_PREFIX,
  PWA_CANDIDATE_RELEASE_PATH,
  PWA_CANDIDATE_SCOPE,
} from '../../../../frontend/scripts/pwa/pwa-candidate';

const roots: string[] = [];

const waitForProcessExit = (child: ChildProcess): Promise<number | null> => {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(child.exitCode);
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (exitCode) => resolve(exitCode));
  });
};

const createRelease = async (walletMarker: string) => {
  const frontendRoot = await mkdtemp(join(tmpdir(), 'xln-pwa-candidate-'));
  roots.push(frontendRoot);
  for (const surface of SURFACE_IDS) {
    const artifact = join(frontendRoot, '.artifacts', surface);
    const asset = `assets/${surface}/index.js`;
    await mkdir(join(artifact, 'assets', surface), { recursive: true });
    await writeFile(
      join(artifact, 'index.html'),
      `<!doctype html><body>${surface === 'wallet' ? walletMarker : surface}<script src="/${asset}"></script></body>`,
    );
    await writeFile(
      join(artifact, 'manifest.json'),
      `${JSON.stringify({
        'index.html': { file: asset, isEntry: true },
      })}\n`,
    );
    await writeFile(join(artifact, asset), `export default ${JSON.stringify(surface)};\n`);
  }
  return assembleCandidateRelease(frontendRoot, []);
};

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('isolated PWA candidate plan', () => {
  test('pins one verified whole release to one deterministic cache and root scope', async () => {
    const release = await createRelease('install');
    const first = await createPwaCandidatePlan(release.releaseDirectory);
    const second = await createPwaCandidatePlan(release.releaseDirectory);

    expect(second).toEqual(first);
    expect(first.releaseId).toBe(release.releaseId);
    expect(first.scope).toBe(PWA_CANDIDATE_SCOPE);
    expect(first.cacheName).toBe(`${PWA_CANDIDATE_CACHE_PREFIX}${release.releaseId}`);
    expect(first.files).toHaveLength(release.manifest.files.length + 1);
    expect(first.files.map(({ path }) => path)).toContain('release-manifest.json');
    expect(first.serviceWorkerSource).toContain(`${PWA_CANDIDATE_RELEASE_PATH}/${release.releaseId}/`);
    expect(() => new Function(first.serviceWorkerSource)).not.toThrow();
  });

  test('gives distinct verified releases distinct worker and cache identities', async () => {
    const [install, update] = await Promise.all([createRelease('install'), createRelease('update')]);
    const [installPlan, updatePlan] = await Promise.all([
      createPwaCandidatePlan(install.releaseDirectory),
      createPwaCandidatePlan(update.releaseDirectory),
    ]);

    expect(updatePlan.releaseId).not.toBe(installPlan.releaseId);
    expect(updatePlan.cacheName).not.toBe(installPlan.cacheName);
    expect(updatePlan.serviceWorkerSha256).not.toBe(installPlan.serviceWorkerSha256);
    expect(updatePlan.serviceWorkerSource).toContain('PWA_RELEASE_FILE_MISMATCH:');
    expect(updatePlan.serviceWorkerSource).toContain('requestUrl.origin !== self.location.origin');
    expect(updatePlan.serviceWorkerSource).toContain('self.clients.claim()');
  });

  test('rejects candidate corruption before generating a service worker', async () => {
    const release = await createRelease('corrupt');
    await writeFile(join(release.releaseDirectory, 'apps/wallet/index.html'), 'corrupt\n');
    await expect(createPwaCandidatePlan(release.releaseDirectory)).rejects.toThrow(
      'CANDIDATE_RELEASE_FILE_MISMATCH:apps/wallet/index.html',
    );
  });
});

describe('explicit immutable lifecycle inputs', () => {
  test('requires two distinct verified releases and detects changed bytes after acceptance', async () => {
    expect(() => requireLifecycleReleaseDirectories({})).toThrow('LIFECYCLE_RELEASE_DIRECTORIES_REQUIRED');
    const install = await createRelease('install');
    const update = await createRelease('update');
    await expect(readLifecycleReleaseInputs([install.releaseDirectory, install.releaseDirectory])).rejects.toThrow(
      'LIFECYCLE_RELEASE_IDENTITIES_EQUAL',
    );
    await expect(
      readLifecycleReleaseInputs([install.releaseDirectory, join(update.releaseDirectory, 'missing')]),
    ).rejects.toThrow();
    const inputs = await readLifecycleReleaseInputs([install.releaseDirectory, update.releaseDirectory]);
    await verifyLifecycleReleaseInputs(inputs);
    await writeFile(join(update.releaseDirectory, 'apps/wallet/index.html'), 'mutated');
    await expect(verifyLifecycleReleaseInputs(inputs)).rejects.toThrow('CANDIDATE_RELEASE_FILE_MISMATCH');
    await expect(readLifecycleReleaseInputs([install.releaseDirectory, update.releaseDirectory])).rejects.toThrow(
      'CANDIDATE_RELEASE_FILE_MISMATCH',
    );
  });

  for (const kind of ['pwa', 'deployment'] as const) {
    test(`${kind} serves explicit releases with every mutable build directory removed`, async () => {
      const install = await createRelease('install');
      const update = await createRelease('update');
      for (const root of roots)
        for (const surface of SURFACE_IDS) await rm(join(root, '.artifacts', surface), { recursive: true });
      const inputs = await readLifecycleReleaseInputs([install.releaseDirectory, update.releaseDirectory]);
      const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('reserved') });
      const port = reservation.port;
      await reservation.stop(true);
      const child = spawn(process.execPath, [resolve(`frontend/scripts/${kind}/${kind}-candidate-smoke-server.ts`)], {
        cwd: roots[0],
        stdio: 'inherit',
        env: {
          ...process.env,
          XLN_LIFECYCLE_INSTALL_DIRECTORY: install.releaseDirectory,
          XLN_LIFECYCLE_UPDATE_DIRECTORY: update.releaseDirectory,
          [`XLN_${kind.toUpperCase()}_SMOKE_PORT`]: String(port),
        },
      });
      try {
        let response: Response | null = null;
        const deadline = Date.now() + 4000;
        while (Date.now() < deadline && child.exitCode === null) {
          try {
            response = await fetch(`http://127.0.0.1:${port}/__xln-${kind}/state`);
          } catch (error: unknown) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ConnectionRefused') throw error;
          }
          if (response) break;
          await Bun.sleep(20);
        }
        if (!response) throw new Error(`LIFECYCLE_SERVER_NOT_READY:${kind}:${child.exitCode}`);
        expect(response.status).toBe(200);
        const state = await response.text();
        expect(state).toContain(install.releaseId);
        expect(state).toContain(update.releaseId);
      } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
        await waitForProcessExit(child);
      }
      await verifyLifecycleReleaseInputs(inputs);
    });
  }
});
