import { createHash } from 'node:crypto';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { safeStringify } from '../../../core/protocol/serialization';
import { nativeRecoveryUrl } from '../../../ui/src/native/recovery-address';
import { snapshotRegularTree, type RegularTreeFile } from '../policy/regular-tree';

const root = path.resolve(import.meta.dir, '../../..');
const ui = path.join(root, 'ui');
const defaultArtifactDirectory = path.join(ui, 'native-dist');
const defaultResourcesDirectory = path.join(root, 'frontend/ios/App/App/public');
const releaseIdPattern = /^sha256-[0-9a-f]{64}$/u;

type IosHeadlessRuntimeOptions = Readonly<{
  artifactDirectory: string;
  resourcesDirectory: string;
  capacitorConfigPath: string;
  capacitorPackagePath: string;
  apiBase: string;
  recoveryUrl: string;
  sourceReleaseId: `sha256-${string}` | null;
}>;

export type IosHeadlessRuntimeArtifact = Readonly<{
  kind: 'ios-headless-runtime';
  artifactId: `sha256-${string}`;
  sourceReleaseId: `sha256-${string}` | null;
  network: Readonly<{ apiBase: string; recoveryUrl: string }>;
  files: readonly RegularTreeFile[];
  path: string;
}>;

type BuildIosRuntimeOptions = Readonly<{
  reuse?: boolean;
  resourcesDirectory?: string;
  capacitorConfigPath?: string;
  capacitorPackagePath?: string;
  sourceReleaseId?: `sha256-${string}`;
}>;

const parseNetwork = (pathname: string): Readonly<{ apiBase: string; recoveryUrl: string }> => {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(pathname, 'utf8')) as unknown;
  } catch {
    throw new Error('IOS_RUNTIME_NETWORK_INVALID');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('IOS_RUNTIME_NETWORK_INVALID');
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(',') !== 'apiBase,recoveryUrl' ||
    typeof record['apiBase'] !== 'string' ||
    typeof record['recoveryUrl'] !== 'string'
  ) {
    throw new Error('IOS_RUNTIME_NETWORK_INVALID');
  }
  return { apiBase: record['apiBase'], recoveryUrl: record['recoveryUrl'] };
};

const updatedCapacitorConfig = (pathname: string): string => {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(pathname, 'utf8')) as unknown;
  } catch {
    throw new Error('IOS_RUNTIME_CAPACITOR_CONFIG_INVALID');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('IOS_RUNTIME_CAPACITOR_CONFIG_INVALID');
  }
  const config = value as Record<string, unknown>;
  if (!Array.isArray(config['packageClassList']) || config['packageClassList'].some(name => typeof name !== 'string')) {
    throw new Error('IOS_RUNTIME_CAPACITOR_PLUGINS_INVALID');
  }
  const packageClassList = config['packageClassList'].filter(
    name => !['StatusBarPlugin', 'KeyboardPlugin', 'SplashScreenPlugin'].includes(name),
  );
  return `${safeStringify({ ...config, packageClassList }, 2)}\n`;
};

const updatedCapacitorPackage = (pathname: string): string | null => {
  const source = readFileSync(pathname, 'utf8');
  if (!source.includes('.iOS(.v26)')) return null;
  if (source.startsWith('// swift-tools-version: 6.2\n')) return null;
  if (!source.startsWith('// swift-tools-version: 5.9\n')) {
    throw new Error('IOS_RUNTIME_SWIFT_TOOLS_VERSION_INVALID');
  }
  return source.replace('// swift-tools-version: 5.9\n', '// swift-tools-version: 6.2\n');
};

const validateHeadlessArtifact = (
  options: IosHeadlessRuntimeOptions,
): Readonly<{ apiBase: string; recoveryUrl: string }> => {
  if (options.sourceReleaseId !== null && !releaseIdPattern.test(options.sourceReleaseId)) {
    throw new Error('IOS_RUNTIME_SOURCE_RELEASE_INVALID');
  }
  for (const file of ['index.html', 'runtime.js', 'account-worker.js', 'native-network.json']) {
    if (!existsSync(path.join(options.artifactDirectory, file))) {
      throw new Error(`IOS_RUNTIME_ARTIFACT_MISSING:${file}`);
    }
  }
  const html = readFileSync(path.join(options.artifactDirectory, 'index.html'), 'utf8');
  if (![...html.matchAll(/\bid\s*=\s*(["'])runtime\1/giu)].length) throw new Error('IOS_RUNTIME_ROOT_MISSING');
  if ([...html.matchAll(/\bid\s*=\s*(["'])root\1/giu)].length) {
    throw new Error('IOS_RUNTIME_GENERIC_ROOT_FORBIDDEN');
  }
  const network = parseNetwork(path.join(options.artifactDirectory, 'native-network.json'));
  if (network.apiBase !== options.apiBase || network.recoveryUrl !== options.recoveryUrl) {
    throw new Error('IOS_RUNTIME_NETWORK_MISMATCH: rebuild for the selected network');
  }
  return network;
};

const installHeadlessArtifact = async (
  options: IosHeadlessRuntimeOptions,
  files: readonly RegularTreeFile[],
  configText: string,
  packageText: string | null,
): Promise<void> => {
  rmSync(options.resourcesDirectory, { recursive: true, force: true });
  cpSync(options.artifactDirectory, options.resourcesDirectory, { recursive: true });
  writeFileSync(options.capacitorConfigPath, configText);
  if (packageText !== null) writeFileSync(options.capacitorPackagePath, packageText);
  const stagedFiles = await snapshotRegularTree(options.resourcesDirectory);
  if (safeStringify(stagedFiles) !== safeStringify(files)) throw new Error('IOS_RUNTIME_STAGE_MISMATCH');
};

/** Replaces a copied generic Wallet web root with the hidden runtime used by SwiftUI. */
export const stageIosHeadlessRuntime = async (
  options: IosHeadlessRuntimeOptions,
): Promise<IosHeadlessRuntimeArtifact> => {
  const network = validateHeadlessArtifact(options);
  const configText = updatedCapacitorConfig(options.capacitorConfigPath);
  const packageText = updatedCapacitorPackage(options.capacitorPackagePath);
  const files = await snapshotRegularTree(options.artifactDirectory);
  const artifactId = `sha256-${createHash('sha256')
    .update(
      safeStringify({
        kind: 'ios-headless-runtime',
        sourceReleaseId: options.sourceReleaseId,
        network,
        files,
      }),
    )
    .digest('hex')}` as const;
  await installHeadlessArtifact(options, files, configText, packageText);
  return {
    kind: 'ios-headless-runtime',
    artifactId,
    sourceReleaseId: options.sourceReleaseId,
    network,
    files,
    path: options.resourcesDirectory,
  };
};

const assertNetworkOrigin = (apiBase: string): void => {
  const endpoint = new URL(apiBase);
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/' ||
    (endpoint.protocol !== 'https:' &&
      !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)))
  ) {
    throw new Error('IOS_NETWORK_ORIGIN_INVALID');
  }
};

const compileIosRuntime = (apiBase: string, recoveryUrl: string): void => {
  const env = { ...process.env, XLN_UI_STACK_ORIGIN: apiBase, VITE_XLN_WATCHTOWER_URL: recoveryUrl };
  for (const cmd of [
    ['bun', 'run', 'runtime:bundle'],
    ['bunx', 'vite', 'build', '--mode', 'ios'],
  ]) {
    const result = Bun.spawnSync(cmd, { cwd: ui, env, stdout: 'inherit', stderr: 'inherit' });
    if (result.exitCode !== 0) throw new Error(`IOS_RUNTIME_BUILD_FAILED:${cmd.join(' ')}:${result.exitCode}`);
  }
  writeFileSync(
    path.join(defaultArtifactDirectory, 'native-network.json'),
    `${safeStringify({ apiBase, recoveryUrl }, 2)}\n`,
  );
};

/** Builds and stages the iOS-only headless host; all visible UI remains SwiftUI. */
export const buildIosRuntime = async (options: BuildIosRuntimeOptions = {}): Promise<IosHeadlessRuntimeArtifact> => {
  const apiBase = process.env['XLN_UI_STACK_ORIGIN'] || 'https://xln.finance';
  assertNetworkOrigin(apiBase);
  const recoveryUrl = nativeRecoveryUrl(apiBase, process.env['VITE_XLN_WATCHTOWER_URL']);
  if (!options.reuse) compileIosRuntime(apiBase, recoveryUrl);
  const resourcesDirectory = options.resourcesDirectory ?? defaultResourcesDirectory;
  const iosAppDirectory = path.join(resourcesDirectory, '../..');
  const result = await stageIosHeadlessRuntime({
    artifactDirectory: defaultArtifactDirectory,
    resourcesDirectory,
    capacitorConfigPath: options.capacitorConfigPath ?? path.join(resourcesDirectory, '../capacitor.config.json'),
    capacitorPackagePath: options.capacitorPackagePath ?? path.join(iosAppDirectory, 'CapApp-SPM/Package.swift'),
    apiBase,
    recoveryUrl,
    sourceReleaseId: options.sourceReleaseId ?? null,
  });
  console.log(`iOS runtime resources: ${resourcesDirectory}`);
  return result;
};

if (import.meta.main) {
  buildIosRuntime({ reuse: process.argv.includes('--no-build') }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
