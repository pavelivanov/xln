#!/usr/bin/env bun
import { cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readCliOption } from '../../core/config/cli';
import { verifyCandidateReleaseDirectory } from '../../packages/frontend-release/verify';

const archiveArg = readCliOption(Bun.argv.slice(2), '--archive');
if (!archiveArg) throw new Error('XLNFINANCE_FRONTEND_CHECK_ARCHIVE_REQUIRED');
const archive = resolve(archiveArg);
const outputArg = readCliOption(Bun.argv.slice(2), '--output');
const output = outputArg ? resolve(outputArg) : undefined;
const workspace = await mkdtemp(join(tmpdir(), 'xlnfinance-frontend-check-'));
const stateRoot = join(workspace, 'state');
const receipts: Array<{ label: string; code: number }> = [];

const run = async (label: string, args: string[], expectedError?: string): Promise<void> => {
  const child = Bun.spawn(['bun', ...args], {
    cwd: workspace,
    env: { ...process.env, XLNFINANCE_STATE_DIR: stateRoot },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (expectedError ? code === 0 || !(stdout + stderr).includes(expectedError) : code !== 0) {
    throw new Error(`XLNFINANCE_FRONTEND_CHECK_FAILED:${label}:exit=${code}\n${stdout}${stderr}`);
  }
  receipts.push({ label, code });
};

const assertNoState = async (): Promise<void> => {
  try {
    await stat(stateRoot);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }
  throw new Error('XLNFINANCE_FRONTEND_CHECK_UNEXPECTED_STATE');
};

try {
  await writeFile(join(workspace, 'package.json'), '{"private":true}\n');
  await run('offline-install', ['add', '--offline', archive]);
  // Mutate only this owned copy: Bun may hard-link cached package files during install.
  const installed = join(workspace, 'node_modules/xlnfinance');
  const packaged = join(workspace, 'package-under-test');
  await cp(installed, packaged, { recursive: true });
  const pointerPath = join(packaged, 'dist/frontend-release.json');
  const pointerBytes = await readFile(pointerPath);
  const pointer = JSON.parse(pointerBytes.toString()) as { releaseId: string };
  const releaseDirectory = join(packaged, 'app', pointer.releaseId);
  const manifest = await verifyCandidateReleaseDirectory(releaseDirectory);
  const installedManifest = await verifyCandidateReleaseDirectory(join(installed, 'app', pointer.releaseId));
  const executable = join(packaged, 'bin/xln.js');
  const probe = join(packaged, 'preflight.mjs');
  await writeFile(
    probe,
    "import { requireDistributionAssets } from './lib/process.js';\nimport { DEV_PATHS } from './lib/state.js';\nawait requireDistributionAssets(DEV_PATHS);\n",
  );
  await run('verified-preflight', [probe]);
  await assertNoState();
  for (const [label, value] of [
    ['null-pointer', null],
    ['path-escape', { schemaVersion: 1, releaseId: '../../outside' }],
    ['extra-pointer-key', { ...pointer, schemaVersion: 1, path: '/outside' }],
  ] as const) {
    try {
      await writeFile(pointerPath, JSON.stringify(value));
      await run(label, [executable, 'daemon', '--dev'], 'XLNFINANCE_FRONTEND_RELEASE_INVALID');
      await assertNoState();
    } finally {
      await writeFile(pointerPath, pointerBytes);
    }
  }
  const entryPath = join(releaseDirectory, 'apps/wallet/index.html');
  const entryBytes = await readFile(entryPath);
  try {
    await writeFile(entryPath, 'corrupted frontend entry');
    await run('corrupt-entry', [executable, 'daemon', '--dev'], 'CANDIDATE_RELEASE_FILE_MISMATCH');
    await assertNoState();
  } finally {
    await writeFile(entryPath, entryBytes);
  }
  const manifestPath = join(releaseDirectory, 'release-manifest.json');
  const manifestBytes = await readFile(manifestPath);
  try {
    await rm(manifestPath);
    await run('missing-manifest', [executable, 'daemon', '--dev'], 'ENOENT');
    await assertNoState();
  } finally {
    await writeFile(manifestPath, manifestBytes);
  }
  await run('restored-preflight', [probe]);
  await assertNoState();
  await verifyCandidateReleaseDirectory(releaseDirectory);
  await verifyCandidateReleaseDirectory(join(installed, 'app', installedManifest.releaseId));
  if (output)
    await writeFile(
      output,
      `${JSON.stringify({ archive, releaseId: manifest.releaseId, files: manifest.files.length, receipts, stateCreated: false }, null, 2)}\n`,
    );
  console.info(
    `XLNFINANCE_FRONTEND_CHECK_OK cases=${receipts.length} files=${manifest.files.length} stateCreated=false`,
  );
} finally {
  await rm(workspace, { recursive: true, force: true });
}
