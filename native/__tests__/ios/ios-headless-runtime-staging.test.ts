import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { stageIosHeadlessRuntime } from '../../../scripts/native/session/build-ios-runtime';

const roots: string[] = [];
const sourceReleaseId = `sha256-${'a'.repeat(64)}` as const;
const apiBase = 'https://xln.finance';
const recoveryUrl = 'https://xln.finance/api/recovery/tower';

const createFixture = async (rootId: 'runtime' | 'root') => {
  const root = await mkdtemp(join(tmpdir(), 'xln-ios-headless-runtime-'));
  roots.push(root);
  const artifactDirectory = join(root, 'artifact');
  const resourcesDirectory = join(root, 'workspace/ios/App/App/public');
  const capacitorConfigPath = join(root, 'workspace/ios/App/App/capacitor.config.json');
  const capacitorPackagePath = join(root, 'workspace/ios/App/CapApp-SPM/Package.swift');
  await mkdir(artifactDirectory, { recursive: true });
  await mkdir(resourcesDirectory, { recursive: true });
  await mkdir(join(root, 'workspace/ios/App/CapApp-SPM'), { recursive: true });
  await writeFile(
    join(artifactDirectory, 'index.html'),
    `<!doctype html><html><body><div id="${rootId}"></div><script type="module" src="/runtime.js"></script></body></html>\n`,
  );
  await writeFile(join(artifactDirectory, 'runtime.js'), 'window.xlnNative = { run: async () => ({ ok: true }) };\n');
  await writeFile(join(artifactDirectory, 'account-worker.js'), 'self.onmessage = () => {};\n');
  await writeFile(join(artifactDirectory, 'native-network.json'), `${JSON.stringify({ apiBase, recoveryUrl })}\n`);
  await writeFile(join(resourcesDirectory, 'index.html'), '<div id="root"></div>\n');
  await writeFile(
    capacitorConfigPath,
    `${JSON.stringify({
      packageClassList: ['StatusBarPlugin', 'WalletPlugin', 'KeyboardPlugin', 'SplashScreenPlugin'],
    })}\n`,
  );
  await writeFile(
    capacitorPackagePath,
    '// swift-tools-version: 5.9\nimport PackageDescription\nlet package = Package(platforms: [.iOS(.v26)])\n',
  );
  return { artifactDirectory, resourcesDirectory, capacitorConfigPath, capacitorPackagePath };
};

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('iOS headless runtime staging', () => {
  test('replaces the generic wallet with the network-bound headless runtime and records derived provenance', async () => {
    const fixture = await createFixture('runtime');
    const result = await stageIosHeadlessRuntime({ ...fixture, apiBase, recoveryUrl, sourceReleaseId });

    expect(result.kind).toBe('ios-headless-runtime');
    expect(result.sourceReleaseId).toBe(sourceReleaseId);
    expect(result.artifactId).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(result.files.map(({ path }) => path)).toEqual([
      'account-worker.js',
      'index.html',
      'native-network.json',
      'runtime.js',
    ]);
    expect(await readFile(join(fixture.resourcesDirectory, 'index.html'), 'utf8')).toContain('id="runtime"');
    expect(JSON.parse(await readFile(join(fixture.resourcesDirectory, 'native-network.json'), 'utf8'))).toEqual({
      apiBase,
      recoveryUrl,
    });
    expect(JSON.parse(await readFile(fixture.capacitorConfigPath, 'utf8')).packageClassList).toEqual(['WalletPlugin']);
    expect(await readFile(fixture.capacitorPackagePath, 'utf8')).toStartWith('// swift-tools-version: 6.2\n');
  });

  test('rejects the generic React root as an iOS headless host', async () => {
    const fixture = await createFixture('root');
    await expect(stageIosHeadlessRuntime({ ...fixture, apiBase, recoveryUrl, sourceReleaseId })).rejects.toThrow(
      'IOS_RUNTIME_ROOT_MISSING',
    );
  });
});
