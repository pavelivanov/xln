import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import { parseReleasePreviewOptions } from './preview-options';
import { verifyCandidateReleaseDirectory } from '../../../packages/frontend-release/verify';

const frontendRoot = fileURLToPath(new URL('../..', import.meta.url));
const options = parseReleasePreviewOptions(Bun.argv.slice(2));
const before = await verifyCandidateReleaseDirectory(options.directory);
const beforeBytes = await readFile(join(options.directory, 'release-manifest.json'));
const scratch = await mkdtemp(join(tmpdir(), 'xln-preview-consumer-'));
const copy = join(scratch, basename(options.directory));
const origin = `http://127.0.0.1:${options.port}`;
const env = { ...process.env, XLN_REACT_GATEWAY_PORT: String(options.port) };
const sha256 = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');

const launch = (directory: string) =>
  Bun.spawn(['bun', 'scripts/preview.ts', directory], {
    cwd: frontendRoot,
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  });
const waitUntilReady = async (child: ReturnType<typeof launch>): Promise<void> => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`PREVIEW_CHECK_STARTUP_EXIT:${child.exitCode}`);
    try {
      const response = await fetch(`${origin}/__xln-release/identity`);
      if (response.ok) {
        assert.equal((await response.json()).releaseId, before.releaseId);
        return;
      }
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ConnectionRefused') throw error;
    }
    await Bun.sleep(50);
  }
  throw new Error('PREVIEW_CHECK_STARTUP_TIMEOUT');
};

let child: ReturnType<typeof launch> | undefined;
try {
  // Bind to a copied, verified release with no per-app build directories nearby.
  await cp(options.directory, copy, { recursive: true });
  child = launch(copy);
  await waitUntilReady(child);
  for (const file of before.files) {
    const response = await fetch(`${origin}/${file.path}`);
    assert.equal(response.status, 200, file.path);
    assert.equal(response.headers.get('x-xln-deployment-release'), before.releaseId);
    assert.equal(sha256(new Uint8Array(await response.arrayBuffer())), file.sha256, file.path);
  }
  for (const [route, app] of [
    ['/', 'site'],
    ['/docs?doc=readme', 'docs'],
    ['/address/example', 'wallet'],
    ['/embed', 'ops'],
  ]) {
    const response = await fetch(`${origin}${route}`);
    assert.equal(response.status, 200, route);
    assert.equal(
      sha256(new Uint8Array(await response.arrayBuffer())),
      before.files.find(file => file.path === `apps/${app}/index.html`)?.sha256,
    );
  }
  assert.equal(
    (await fetch(`${origin}/app`, { method: 'HEAD' })).headers.get('x-xln-deployment-release'),
    before.releaseId,
  );
  assert.equal(await (await fetch(`${origin}/app`, { method: 'HEAD' })).text(), '');
  assert.equal((await fetch(`${origin}/app`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${origin}/not-a-release-route`)).status, 404);
  const redirect = await fetch(`${origin}/admin`, { redirect: 'manual' });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/health');
  assert.equal((await fetch(`${origin}/radapter?token=forbidden`)).status, 400);
  assert.equal((await fetch(`${origin}/resetdb`)).headers.get('clear-site-data'), '"*"');
  // Corrupt only the disposable copy: a running server must reject changed bytes.
  const entry = join(copy, 'apps/wallet/index.html');
  await writeFile(entry, 'corrupted release bytes');
  const corrupt = await fetch(`${origin}/app`);
  assert.equal(corrupt.status, 500);
  assert.match(await corrupt.text(), /CANDIDATE_RELEASE_FILE_MISMATCH/);
  child.kill('SIGTERM');
  assert.equal(await child.exited, 0);
  child = undefined;
  const restart = launch(copy);
  assert.notEqual(await restart.exited, 0, 'corrupt release must fail before listening');
  const missing = launch(join(scratch, 'missing'));
  assert.notEqual(await missing.exited, 0, 'missing release must fail before listening');
  assert.equal((await verifyCandidateReleaseDirectory(options.directory)).releaseId, before.releaseId);
  assert.deepEqual(await readFile(join(options.directory, 'release-manifest.json')), beforeBytes);
  console.info(
    `RELEASE_PREVIEW_CHECK_OK release=${before.releaseId} files=${before.files.length} routes=4 corruption=rejected missing=rejected shutdown=clean`,
  );
} finally {
  if (child) {
    child.kill('SIGTERM');
    await child.exited;
  }
  await rm(scratch, { recursive: true, force: true });
}
