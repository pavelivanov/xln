#!/usr/bin/env bun
import {
  createNativeReleaseBuild,
  requireNativeWorkspace,
  verifyNativeReleaseBuildInputs,
  verifyNativeDesktopCopy,
  type NativeReleaseBuild,
} from './native-release-build';
import { verifyCandidateReleaseDirectory } from '../../packages/frontend-release/verify';

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Platform = 'ios' | 'android' | 'desktop' | 'extension';
type ArtifactStatus = 'built' | 'synced' | 'reused';
type NativeArtifact = {
	target: Platform | 'runtime' | 'frontend';
	kind: string;
	status: ArtifactStatus;
	path?: string;
	releaseTrust?: 'signed' | 'signed-notarized';
	proofPath?: string;
};
type NativeBuildOptions = {
  frontendRelease?: string;
  flags: Set<string>;
  targets: Platform[];
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FRONTEND = path.join(ROOT, 'frontend');
const NATIVE_DIR = path.join(ROOT, 'native');
const DIST_DIR = path.join(NATIVE_DIR, 'dist');
const ARTIFACT_MANIFEST = path.join(DIST_DIR, 'native-artifacts.json');
const APP_NAME = 'xln finance';
const DESKTOP_BUNDLE_ID = 'finance.xln.wallet.desktop';

function printHelp(): void {
	console.log(`XLN native build pipeline

Usage:
  bun scripts/native/build-platforms.ts [mobile|ios|android|desktop|extension|all] --frontend-release <verified-directory> [--open] [--smoke] [--package]

Targets:
  mobile     Sync iOS + Android in copied Wallet shell workspaces
  ios        Build/sync Capacitor iOS
  android    Build/sync Capacitor Android
  desktop    Prepare Electron shell; --open launches it
  extension  Prepare the verified browser companion extension workspace
  all        mobile + desktop + extension

Flags:
  --frontend-release <directory>  Required verified release; never rebuild application bytes
  --open         Open the native IDE/shell after sync
  --smoke        Launch desktop shell once and exit
  --package      Produce signed release packages; missing signing/notarization fails closed

Examples:
  bun run native:mobile -- --frontend-release <directory>
  bun run native:mobile -- --frontend-release <directory> --package
  bun run native:package -- --frontend-release <directory>
  bun run native:ios -- --frontend-release <directory> --open
  bun run native desktop --frontend-release <directory> --open
`);
}

function run(command: string, commandArgs: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): void {
	const pretty = [command, ...commandArgs].join(' ');
	console.log(`\n$ ${pretty}`);
	const result = spawnSync(command, commandArgs, {
		cwd,
		env,
		stdio: 'inherit',
		shell: false,
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(`${pretty} failed with exit code ${result.status ?? 'unknown'}`);
	}
}

function existingJavaHome(): string | null {
  const candidates = [
    process.env['JAVA_HOME'],
    '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
    '/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home',
    '/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
    '/usr/local/opt/openjdk/libexec/openjdk.jdk/Contents/Home',
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'bin/java'))) return candidate;
  }
  return null;
}

function javaEnv(): NodeJS.ProcessEnv {
  const javaHome = existingJavaHome();
  if (!javaHome) return process.env;
  return {
    ...process.env,
    JAVA_HOME: javaHome,
    PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env['PATH'] || ''}`,
  };
}

function existingAndroidHome(): string | null {
  const candidates = [
    process.env['ANDROID_HOME'],
    process.env['ANDROID_SDK_ROOT'],
    path.join(process.env['HOME'] || '', 'Library/Android/sdk'),
    '/opt/homebrew/share/android-commandlinetools',
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  for (const candidate of candidates) {
    if (
      existsSync(path.join(candidate, 'platforms/android-36')) &&
      existsSync(path.join(candidate, 'build-tools/36.0.0'))
    ) {
      return candidate;
    }
  }
  return null;
}

function androidEnv(): NodeJS.ProcessEnv {
  const base = javaEnv();
  const androidHome = existingAndroidHome();
  if (!androidHome) return base;
  return {
    ...base,
    ANDROID_HOME: androidHome,
    ANDROID_SDK_ROOT: androidHome,
    PATH: `${path.join(androidHome, 'platform-tools')}${path.delimiter}${base['PATH'] || ''}`,
  };
}

function runCapture(
  command: string,
  commandArgs: string[],
  cwd = ROOT,
  env: NodeJS.ProcessEnv = process.env,
): { status: number | null; output: string; error: Error | undefined } {
  const result = spawnSync(command, commandArgs, {
    cwd,
    env: command === 'java' ? javaEnv() : env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  return {
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`.trim(),
    error: result.error,
  };
}

export function expandTargets(input: string[]): Platform[] {
	const selected = input.length === 0 ? ['mobile'] : input;
	const platforms: Platform[] = [];
	const add = (...items: Platform[]) => {
		for (const item of items) {
			if (!platforms.includes(item)) platforms.push(item);
		}
	};

	for (const token of selected) {
		if (token === 'all') add('ios', 'android', 'desktop', 'extension');
		else if (token === 'mobile') add('ios', 'android');
		else if (token === 'ios' || token === 'android' || token === 'desktop' || token === 'extension') add(token);
		else throw new Error(`Unknown native target: ${token}`);
	}
	return platforms;
}

export function parseNativeBuildOptions(argv: string[]): NativeBuildOptions {
  const flags = new Set<string>();
  const tokens: string[] = [];
  let frontendRelease: string | undefined;
  const allowedFlags = new Set(['--help', '-h', '--open', '--smoke', '--package']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--frontend-release' || arg.startsWith('--frontend-release=')) {
      if (frontendRelease !== undefined) throw new Error('NATIVE_FRONTEND_RELEASE_DUPLICATE');
      const value = arg === '--frontend-release' ? argv[++index] : arg.slice('--frontend-release='.length);
      if (!value?.trim() || value.startsWith('-')) throw new Error('NATIVE_FRONTEND_RELEASE_REQUIRED');
      frontendRelease = path.resolve(value);
    } else if (arg.startsWith('-')) {
      if (!allowedFlags.has(arg)) throw new Error(`Unknown native flag: ${arg}`);
      flags.add(arg);
    } else tokens.push(arg);
  }
  return { flags, targets: expandTargets(tokens), ...(frontendRelease ? { frontendRelease } : {}) };
}

export function requiredNativeToolCommands(targets: Platform[], flags: Set<string>): string[] {
	const required = new Set<string>();
	if (flags.has('--open') && targets.includes('ios')) required.add('xcodebuild');
	if (!flags.has('--package')) return [...required].sort();
	if (targets.includes('android')) {
		required.add('android-sdk');
		required.add('java');
	}
	if (targets.includes('ios')) required.add('xcodebuild');
	if (targets.includes('ios') && flags.has('--package')) required.add('codesign');
	if (targets.includes('desktop') && process.platform === 'darwin') {
		required.add('codesign');
		required.add('xcrun');
		required.add('spctl');
	}
	return [...required].sort();
}

function commandVersionArgs(command: string): string[] {
	if (command === 'xcodebuild') return ['-version'];
	if (command === 'java') return ['-version'];
	return ['--version'];
}

function commandAvailable(command: string): boolean {
	if (command === 'android-sdk') return existingAndroidHome() !== null;
	const result = spawnSync(command, commandVersionArgs(command), {
		env: command === 'java' ? javaEnv() : process.env,
		stdio: 'ignore',
		shell: false,
	});
	return !result.error && result.status === 0;
}

function nativeToolMissingReason(command: string): string {
	if (command === 'android-sdk') {
		return 'Android SDK platform android-36 and build-tools 36.0.0 are required; install with sdkmanager "platforms;android-36" "build-tools;36.0.0"';
	}
	const result = runCapture(command, commandVersionArgs(command));
	const output = result.output.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 3).join(' ');
	if (command === 'xcodebuild') {
		return output || 'full Xcode is required; CommandLineTools is not enough for iOS packaging';
	}
	if (command === 'java') {
		return output || 'JDK is required for Android Gradle packaging';
	}
	return output || `${command} is not available`;
}

function assertNativeToolingAvailable(targets: Platform[], flags: Set<string>): void {
	const missing = requiredNativeToolCommands(targets, flags).filter(command => !commandAvailable(command));
	if (missing.length === 0) return;
	throw new Error(
		`Missing native platform tooling: ${missing.map(nativeToolMissingReason).join(' | ')}. ` +
		'Install a JDK for Android packaging and full Xcode for iOS packaging/opening, or rerun without --package/--open.',
	);
}

const requiredEnvironment = (names: readonly string[]): void => {
	const missing = names.filter(name => !String(process.env[name] || '').trim());
	if (missing.length > 0) throw new Error(`NATIVE_RELEASE_CREDENTIALS_MISSING:${missing.join(',')}`);
};

export const assertNativeReleaseCredentials = (targets: Platform[], flags: Set<string>): void => {
  if (!flags.has('--package')) return;
  if (targets.includes('android')) {
    requiredEnvironment([
      'XLN_ANDROID_KEYSTORE_PATH',
      'XLN_ANDROID_KEYSTORE_PASSWORD',
      'XLN_ANDROID_KEY_ALIAS',
      'XLN_ANDROID_KEY_PASSWORD',
      'XLN_ANDROID_SIGNER_CERT_SHA256',
    ]);
    const keystore = String(process.env['XLN_ANDROID_KEYSTORE_PATH']);
    if (!existsSync(keystore)) throw new Error(`ANDROID_RELEASE_KEYSTORE_MISSING:${keystore}`);
  }
  if (targets.includes('ios')) {
    requiredEnvironment(['XLN_IOS_DEVELOPMENT_TEAM']);
  }
  if (targets.includes('desktop') && process.platform === 'darwin') {
    requiredEnvironment([
      'XLN_MACOS_CODESIGN_IDENTITY',
      'XLN_MACOS_NOTARY_KEY_PATH',
      'XLN_MACOS_NOTARY_KEY_ID',
      'XLN_MACOS_NOTARY_ISSUER_ID',
    ]);
    const notaryKey = String(process.env['XLN_MACOS_NOTARY_KEY_PATH']);
    if (!existsSync(notaryKey)) throw new Error(`MACOS_NOTARY_KEY_MISSING:${notaryKey}`);
  }
};

function syncCapacitorPlatform(platform: 'ios' | 'android', build: NativeReleaseBuild): NativeArtifact {
  const workspace = requireNativeWorkspace(build, 'capacitor');
  run(path.join(FRONTEND, 'node_modules/.bin/cap'), ['sync', platform], workspace);
  return { target: platform, kind: 'capacitor-sync', status: 'synced', path: path.join(workspace, platform) };
}

export function resolveIosXcodebuildProjectArgs(iosAppDir = path.join(FRONTEND, 'ios/App')): string[] {
	if (existsSync(path.join(iosAppDir, 'App.xcworkspace'))) return ['-workspace', 'App.xcworkspace'];
	if (existsSync(path.join(iosAppDir, 'App.xcodeproj'))) return ['-project', 'App.xcodeproj'];
	throw new Error(`Missing iOS Xcode project in ${iosAppDir}`);
}

function resolveIosSigningArgs(): string[] {
  const envTeam = String(process.env['XLN_IOS_DEVELOPMENT_TEAM'] || '').trim();
  if (envTeam) return ['-allowProvisioningUpdates', `DEVELOPMENT_TEAM=${envTeam}`, 'CODE_SIGN_STYLE=Automatic'];
  throw new Error('Missing iOS release signing team. Set XLN_IOS_DEVELOPMENT_TEAM=<TEAM_ID> for release packaging.');
}

const fileSha256 = (file: string): string => createHash('sha256').update(readFileSync(file)).digest('hex');

const writeReleaseProof = (
	artifactPath: string,
	proof: Record<string, unknown>,
): string => {
	const proofPath = `${artifactPath}.release-proof.json`;
	writeFileSync(proofPath, `${JSON.stringify({
		schema: 'xln:native-release-proof',
		artifact: path.basename(artifactPath),
		sha256: fileSha256(artifactPath),
		version: packageJsonVersion(),
		release: true,
		...proof,
	}, null, 2)}\n`);
	return proofPath;
};

const assertCapacitorPackageTools = (platform: 'ios' | 'android'): void => {
	const requiredTools = platform === 'android' ? ['java', 'android-sdk'] : ['xcodebuild'];
	const missingTools = requiredTools.filter(tool => !commandAvailable(tool));
	if (missingTools.length > 0) {
		const reason = missingTools.map(nativeToolMissingReason).join(' | ');
		throw new Error(`Cannot package ${platform}: ${reason}`);
	}
};

const androidReleaseVersionCode = (version: string): number => {
	const parts = version.split('.').map(value => Number(value));
	if (parts.length !== 3 || !parts.every(Number.isSafeInteger)) {
		throw new Error(`ANDROID_RELEASE_VERSION_INVALID:${version}`);
	}
	return (parts[0]! * 1_000_000) + (parts[1]! * 1_000) + parts[2]!;
};

const verifyAndroidRelease = (source: string, version: string, env: NodeJS.ProcessEnv): string => {
  const androidHome = existingAndroidHome();
  if (!androidHome) throw new Error('ANDROID_RELEASE_SDK_MISSING');
  const apkSigner = path.join(androidHome, 'build-tools/36.0.0/apksigner');
  const aapt2 = path.join(androidHome, 'build-tools/36.0.0/aapt2');
  if (!existsSync(apkSigner)) throw new Error(`ANDROID_APKSIGNER_MISSING:${apkSigner}`);
  if (!existsSync(aapt2)) throw new Error(`ANDROID_AAPT2_MISSING:${aapt2}`);
  const signer = runCapture(apkSigner, ['verify', '--verbose', '--print-certs', source], ROOT, env);
  if (signer.error || signer.status !== 0) throw new Error(`ANDROID_RELEASE_SIGNATURE_INVALID:${signer.output}`);
  if (/android debug/i.test(signer.output)) throw new Error('ANDROID_RELEASE_DEBUG_CERTIFICATE_FORBIDDEN');
  const digest = signer.output
    .match(/certificate SHA-256 digest:\s*([0-9a-f:]+)/i)?.[1]
    ?.replaceAll(':', '')
    .toLowerCase();
  if (!digest || !/^[0-9a-f]{64}$/.test(digest)) throw new Error('ANDROID_RELEASE_CERTIFICATE_DIGEST_MISSING');
  const expectedDigest = String(process.env['XLN_ANDROID_SIGNER_CERT_SHA256'] || '')
    .replaceAll(':', '')
    .toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expectedDigest) || digest !== expectedDigest) {
    throw new Error(`ANDROID_RELEASE_CERTIFICATE_MISMATCH:expected=${expectedDigest}:actual=${digest}`);
  }
  const badging = runCapture(aapt2, ['dump', 'badging', source], ROOT, env);
  if (badging.error || badging.status !== 0) throw new Error(`ANDROID_RELEASE_MANIFEST_INVALID:${badging.output}`);
  if (badging.output.includes('application-debuggable')) throw new Error('ANDROID_RELEASE_DEBUGGABLE_FORBIDDEN');
  if (!badging.output.includes("package: name='finance.xln.wallet'"))
    throw new Error('ANDROID_RELEASE_PACKAGE_ID_INVALID');
  if (!badging.output.includes(`versionName='${version}'`))
    throw new Error(`ANDROID_RELEASE_VERSION_MISMATCH:${version}`);
  return digest;
};

const packageAndroidRelease = (build: NativeReleaseBuild): NativeArtifact => {
  const workspace = requireNativeWorkspace(build, 'capacitor');
  const version = packageJsonVersion();
  const env = {
    ...androidEnv(),
    XLN_ANDROID_VERSION_NAME: version,
    XLN_ANDROID_VERSION_CODE: String(androidReleaseVersionCode(version)),
  };
  run('./gradlew', ['assembleRelease'], path.join(workspace, 'android'), env);
  const source = path.join(workspace, 'android/app/build/outputs/apk/release/app-release.apk');
  if (!existsSync(source)) throw new Error(`Signed Android release APK was not produced at ${source}`);
  const certificateDigest = verifyAndroidRelease(source, version, env);
  const destination = path.join(build.outputDirectory, `android/xln-finance-${version}-android-release-signed.apk`);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  const proofPath = writeReleaseProof(destination, {
    frontendReleaseId: build.releaseId,
    platform: 'android',
    signed: true,
    notarized: false,
    debuggable: false,
    applicationId: 'finance.xln.wallet',
    signerCertificateSha256: certificateDigest,
  });
  return {
    target: 'android',
    kind: 'release-apk',
    status: 'built',
    path: destination,
    releaseTrust: 'signed',
    proofPath,
  };
};

const packageIosRelease = (build: NativeReleaseBuild): NativeArtifact => {
  const workspace = requireNativeWorkspace(build, 'capacitor');
  const derivedDataPath = path.join(build.outputDirectory, 'ios-derived-data');
  const iosAppDir = path.join(workspace, 'ios/App');
  rmSync(derivedDataPath, { recursive: true, force: true });
  run(
    'xcodebuild',
    [
      ...resolveIosXcodebuildProjectArgs(iosAppDir),
      '-scheme',
      'App',
      '-configuration',
      'Release',
      '-destination',
      'generic/platform=iOS',
      '-derivedDataPath',
      derivedDataPath,
      ...resolveIosSigningArgs(),
      'build',
    ],
    iosAppDir,
  );
  const appPath = path.join(derivedDataPath, 'Build/Products/Release-iphoneos/App.app');
  if (!existsSync(appPath)) throw new Error(`Signed iOS release app was not produced at ${appPath}`);
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], ROOT);
  const signature = runCapture('codesign', ['-dv', '--verbose=4', appPath]);
  const teamId = signature.output.match(/TeamIdentifier=([A-Z0-9]+)/)?.[1];
  if (signature.status !== 0 || !teamId || teamId !== String(process.env['XLN_IOS_DEVELOPMENT_TEAM'])) {
    throw new Error(`IOS_RELEASE_SIGNATURE_IDENTITY_INVALID:${signature.output}`);
  }
  return { target: 'ios', kind: 'release-ios-app', status: 'built', path: appPath, releaseTrust: 'signed' };
};

function packageCapacitorPlatform(platform: 'ios' | 'android', build: NativeReleaseBuild): NativeArtifact {
  assertCapacitorPackageTools(platform);
  return platform === 'android' ? packageAndroidRelease(build) : packageIosRelease(build);
}

export const validateNativeReleaseVersions = (versions: Readonly<Record<string, string>>): string => {
  const selected = versions['VERSION'];
  if (!selected || !/^\d+\.\d+\.\d+$/.test(selected)) throw new Error('NATIVE_RELEASE_VERSION_INVALID:VERSION');
  if (Object.values(versions).some(version => version !== selected)) {
    throw new Error(`NATIVE_RELEASE_VERSION_MISMATCH:${JSON.stringify(versions)}`);
  }
  return selected;
};

function packageJsonVersion(): string {
  const paths = [
    'package.json',
    'frontend/package.json',
    'native/extension/manifest.json',
    'packages/npm/xlnfinance/package.json',
  ];
  const versions = Object.fromEntries(
    paths.map(file => {
      const value = JSON.parse(readFileSync(path.join(ROOT, file), 'utf8')) as { version?: unknown };
      return [file, String(value.version || '')];
    }),
  );
  return validateNativeReleaseVersions({
    VERSION: readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim(),
    ...versions,
  });
}

function setPlistString(plist: string, key: string, value: string): string {
	const escapedValue = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	const pattern = new RegExp(`(<key>${key}</key>\\s*)<string>[^<]*</string>`);
	if (pattern.test(plist)) return plist.replace(pattern, `$1<string>${escapedValue}</string>`);
	return insertBeforeRootDictClose(plist, `\t<key>${key}</key>\n\t<string>${escapedValue}</string>\n`);
}

function insertBeforeRootDictClose(plist: string, block: string): string {
	const closeIndex = plist.lastIndexOf('</dict>');
	if (closeIndex === -1) throw new Error('Invalid Info.plist: root dict close tag not found');
	return `${plist.slice(0, closeIndex)}${block}${plist.slice(closeIndex)}`;
}

function ensureDesktopUrlScheme(plist: string): string {
	if (plist.includes('<string>xln</string>')) return plist;
	const urlTypes = [
		'\t<key>CFBundleURLTypes</key>',
		'\t<array>',
		'\t\t<dict>',
		'\t\t\t<key>CFBundleURLName</key>',
		`\t\t\t<string>${DESKTOP_BUNDLE_ID}</string>`,
		'\t\t\t<key>CFBundleURLSchemes</key>',
		'\t\t\t<array>',
		'\t\t\t\t<string>xln</string>',
		'\t\t\t</array>',
		'\t\t</dict>',
		'\t</array>',
	].join('\n');
	return insertBeforeRootDictClose(plist, `${urlTypes}\n`);
}

function updateDesktopInfoPlist(appPath: string): void {
	const plistPath = path.join(appPath, 'Contents/Info.plist');
	let plist = readFileSync(plistPath, 'utf8');
	plist = setPlistString(plist, 'CFBundleName', APP_NAME);
	plist = setPlistString(plist, 'CFBundleDisplayName', APP_NAME);
	plist = setPlistString(plist, 'CFBundleIdentifier', DESKTOP_BUNDLE_ID);
	plist = setPlistString(plist, 'CFBundleShortVersionString', packageJsonVersion());
	plist = setPlistString(plist, 'CFBundleVersion', packageJsonVersion());
	plist = ensureDesktopUrlScheme(plist);
	writeFileSync(plistPath, plist);
}

async function packageDesktopApp(build: NativeReleaseBuild): Promise<NativeArtifact[]> {
  const desktopDirectory = path.join(requireNativeWorkspace(build, 'packaged'), 'desktop');
  if (process.platform !== 'darwin') {
    throw new Error(`MACOS_RELEASE_REQUIRES_DARWIN:current=${process.platform}`);
  }

  const electronApp = path.join(ROOT, 'node_modules/electron/dist/Electron.app');
  if (!existsSync(electronApp)) {
    run('bunx', ['electron', '--version'], ROOT);
  }
  if (!existsSync(electronApp)) {
    throw new Error(`Electron bootstrap completed without creating ${electronApp}`);
  }
  const platformTag = `mac-${process.arch}`;
  const outputDir = path.join(build.outputDirectory, 'desktop', platformTag);
  const appPath = path.join(outputDir, `${APP_NAME}.app`);
  const resourcesApp = path.join(appPath, 'Contents/Resources/app');
  rmSync(appPath, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  cpSync(electronApp, appPath, { recursive: true });
  rmSync(resourcesApp, { recursive: true, force: true });
  mkdirSync(resourcesApp, { recursive: true });
  cpSync(desktopDirectory, resourcesApp, { recursive: true });
  await verifyNativeDesktopCopy(build, resourcesApp);
  updateDesktopInfoPlist(appPath);
  const identity = String(process.env['XLN_MACOS_CODESIGN_IDENTITY']);
  run('codesign', ['--deep', '--force', '--options', 'runtime', '--timestamp', '--sign', identity, appPath], ROOT);
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], ROOT);
  const submissionZip = path.join(build.outputDirectory, 'desktop', `.notary-submission-${process.arch}.zip`);
  rmSync(submissionZip, { force: true });
  run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, submissionZip], ROOT);
  run(
    'xcrun',
    [
      'notarytool',
      'submit',
      submissionZip,
      '--key',
      String(process.env['XLN_MACOS_NOTARY_KEY_PATH']),
      '--key-id',
      String(process.env['XLN_MACOS_NOTARY_KEY_ID']),
      '--issuer',
      String(process.env['XLN_MACOS_NOTARY_ISSUER_ID']),
      '--wait',
    ],
    ROOT,
  );
  run('xcrun', ['stapler', 'staple', appPath], ROOT);
  run('xcrun', ['stapler', 'validate', appPath], ROOT);
  const assessment = runCapture('spctl', ['--assess', '--type', 'execute', '--verbose=2', appPath]);
  if (assessment.error || assessment.status !== 0 || !/source=Notarized Developer ID/i.test(assessment.output)) {
    throw new Error(`MACOS_NOTARIZATION_ASSESSMENT_INVALID:${assessment.output}`);
  }
  const signature = runCapture('codesign', ['-dv', '--verbose=4', appPath]);
  const teamId = signature.output.match(/TeamIdentifier=([A-Z0-9]+)/)?.[1];
  const identityTeamId = identity.match(/\(([A-Z0-9]+)\)\s*$/)?.[1];
  if (
    signature.status !== 0 ||
    !teamId ||
    !identity.startsWith('Developer ID Application:') ||
    identityTeamId !== teamId
  ) {
    throw new Error(`MACOS_RELEASE_SIGNATURE_IDENTITY_INVALID:${signature.output}`);
  }
  rmSync(submissionZip, { force: true });
  const zipPath = path.join(
    build.outputDirectory,
    'desktop',
    `xln-finance-${packageJsonVersion()}-mac-${process.arch}-signed-notarized.zip`,
  );
  rmSync(zipPath, { force: true });
  run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zipPath], ROOT);
  const proofPath = writeReleaseProof(zipPath, {
    frontendReleaseId: build.releaseId,
    platform: `macos-${process.arch}`,
    signed: true,
    notarized: true,
    debuggable: false,
    teamId,
    codesignIdentity: identity,
  });
  return [
    { target: 'desktop', kind: 'mac-app', status: 'built', path: appPath, releaseTrust: 'signed-notarized' },
    {
      target: 'desktop',
      kind: 'mac-zip',
      status: 'built',
      path: zipPath,
      releaseTrust: 'signed-notarized',
      proofPath,
    },
  ];
}

function desktopLaunchCommand(artifact: NativeArtifact | null, desktopDirectory: string): [string, string[], string] {
  if (artifact?.status === 'built' && artifact.path && process.platform === 'darwin') {
    const executable = path.join(artifact.path, 'Contents/MacOS/Electron');
    if (existsSync(executable)) return [executable, [], ROOT];
  }
  return [path.join(ROOT, 'node_modules/.bin/electron'), ['native/desktop/main.cjs'], desktopDirectory];
}

async function prepareDesktop(flags: Set<string>, build: NativeReleaseBuild): Promise<NativeArtifact[]> {
  const desktopDirectory = path.join(requireNativeWorkspace(build, 'packaged'), 'desktop');
  const main = path.join(desktopDirectory, 'native', 'desktop/main.cjs');
  if (!existsSync(main)) throw new Error(`Missing ${main}`);
  const artifacts: NativeArtifact[] = [];
  const packageArtifacts = flags.has('--package') ? await packageDesktopApp(build) : [];
  artifacts.push(...packageArtifacts);
  console.log(`\nDesktop shell ready: ${main}`);
  if (flags.has('--open') || flags.has('--smoke')) {
    const appArtifact = packageArtifacts.find(artifact => artifact.kind === 'mac-app') || null;
    const [command, commandArgs, cwd] = desktopLaunchCommand(appArtifact, desktopDirectory);
    run(command, commandArgs, cwd, {
      ...process.env,
      ...(flags.has('--smoke') ? { XLN_ELECTRON_SMOKE: '1' } : {}),
    });
  }
  if (packageArtifacts.length === 0) {
    artifacts.push({ target: 'desktop', kind: 'electron-shell', status: 'synced', path: main });
  }
  return artifacts;
}

function prepareExtension(flags: Set<string>, build: NativeReleaseBuild): NativeArtifact[] {
  const distDir = path.join(requireNativeWorkspace(build, 'packaged'), 'extension');
  const artifacts: NativeArtifact[] = [
    { target: 'extension', kind: 'chrome-extension-unpacked', status: 'built', path: distDir },
  ];
  if (flags.has('--package')) {
    const zipPath = path.join(build.outputDirectory, `chrome/xln-finance-chrome-${packageJsonVersion()}.zip`);
    mkdirSync(path.dirname(zipPath), { recursive: true });
    rmSync(zipPath, { force: true });
    run('zip', ['-q', '-r', zipPath, '.'], distDir);
    artifacts.push({ target: 'extension', kind: 'chrome-extension-zip', status: 'built', path: zipPath });
  }
  console.log(`\nChrome extension ready: ${distDir}`);
  return artifacts;
}

function writeArtifactManifest(
  targets: Platform[],
  flags: Set<string>,
  artifacts: NativeArtifact[],
  build: NativeReleaseBuild,
): void {
  mkdirSync(DIST_DIR, { recursive: true });
  const unavailableTools = requiredNativeToolCommands(targets, flags)
    .filter(command => !commandAvailable(command))
    .map(command => ({ command, reason: nativeToolMissingReason(command) }));
  writeFileSync(
    ARTIFACT_MANIFEST,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        repoRoot: ROOT,
        frontendRelease: build,
        targets,
        flags: [...flags].sort(),
        artifacts,
        unavailableTools,
      },
      null,
      2,
    ),
  );
  copyFileSync(ARTIFACT_MANIFEST, path.join(build.outputDirectory, 'native-artifacts.json'));
  console.log(`\nArtifact manifest: ${ARTIFACT_MANIFEST}`);
}

async function main(): Promise<void> {
  const { flags, targets, frontendRelease } = parseNativeBuildOptions(process.argv.slice(2));
  if (flags.has('--help') || flags.has('-h')) {
    printHelp();
    return;
  }

  if (!frontendRelease) throw new Error('NATIVE_FRONTEND_RELEASE_REQUIRED: --frontend-release <verified-directory>');
  await verifyCandidateReleaseDirectory(frontendRelease);
  if (flags.has('--package')) packageJsonVersion();
  assertNativeToolingAvailable(targets, flags);
  assertNativeReleaseCredentials(targets, flags);
  const build = await createNativeReleaseBuild(frontendRelease, targets);
  await verifyNativeReleaseBuildInputs(build);
  const artifacts: NativeArtifact[] = [
    { target: 'frontend', kind: 'verified-wallet-release', status: 'reused', path: build.stagingDirectory },
    {
      target: 'runtime',
      kind: 'browser-runtime',
      status: 'reused',
      path: path.join(build.stagingDirectory, 'runtime.js'),
    },
  ];

  for (const target of targets) {
    if (target === 'ios' || target === 'android') {
      artifacts.push(syncCapacitorPlatform(target, build));
      await verifyNativeReleaseBuildInputs(build);
      if (flags.has('--package')) artifacts.push(packageCapacitorPlatform(target, build));
      if (flags.has('--open'))
        run(path.join(FRONTEND, 'node_modules/.bin/cap'), ['open', target], requireNativeWorkspace(build, 'capacitor'));
    } else if (target === 'desktop') {
      artifacts.push(...(await prepareDesktop(flags, build)));
    } else if (target === 'extension') {
      artifacts.push(...prepareExtension(flags, build));
    }
  }

  await verifyNativeReleaseBuildInputs(build);
  writeArtifactManifest(targets, flags, artifacts, build);
  console.log(`\nxln native pipeline complete: ${targets.join(', ')}`);
}

if (import.meta.main) {
	main().catch(error => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
