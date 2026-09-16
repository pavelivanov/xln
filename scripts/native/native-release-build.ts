import { cp, mkdir, mkdtemp, symlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { safeStringify } from '../../core/protocol/serialization';
import { snapshotRegularTree } from './policy/regular-tree';
import { verifyCandidateReleaseDirectory } from '../../packages/frontend-release/verify';
import { materializeNativeWalletCandidate } from './stage-wallet-candidate';
import { verifyNativeWalletCandidateDirectory } from './wallet-candidate-manifest';
import { createNativeCapacitorConfig } from './capacitor-candidate';
import { copyCapacitorShellCandidate } from './copy-capacitor-shell-candidate';
import { copyPackagedShellCandidate } from './copy-packaged-shell-candidate';
import {
  verifyCapacitorShellCandidateDirectory,
  verifyCopiedWebRoot,
  verifyCapacitorGeneratedConfig,
} from './capacitor-shell-candidate-manifest';
import { verifyPackagedShellCandidateDirectory } from './packaged-shell-candidate-manifest';

export type NativeReleaseBuild = Readonly<{
  releaseDirectory: string;
  releaseId: `sha256-${string}`;
  stagingDirectory: string;
  outputDirectory: string;
  capacitor?: Readonly<{ sourceDirectory: string; buildDirectory: string }>;
  packagedDirectory?: string;
}>;

const ROOT = resolve(import.meta.dir, '../..');

export const createNativeReleaseBuild = async (
  releaseDirectory: string,
  targets: readonly string[],
): Promise<NativeReleaseBuild> => {
  const stage = await materializeNativeWalletCandidate(releaseDirectory, join(ROOT, 'native/dist/candidates'));
  const outputRoot = join(ROOT, 'native/dist/releases', stage.releaseId);
  await mkdir(outputRoot, { recursive: true });
  const outputDirectory = await mkdtemp(join(outputRoot, 'build-'));
  let capacitor: NativeReleaseBuild['capacitor'];
  if (targets.some(target => target === 'ios' || target === 'android')) {
    const source = await copyCapacitorShellCandidate(stage.stagingDirectory);
    // A sibling preserves the verified config's relative webDir. Native tools
    // may mutate this working copy, never the content-addressed source shell.
    const buildDirectory = await mkdtemp(join(dirname(source.workspaceDirectory), '.build-'));
    await cp(source.workspaceDirectory, buildDirectory, { recursive: true });
    await symlink(join(ROOT, 'frontend/node_modules'), join(buildDirectory, 'node_modules'), 'dir');
    capacitor = { sourceDirectory: source.workspaceDirectory, buildDirectory };
  }
  const packaged = targets.some(target => target === 'desktop' || target === 'extension')
    ? await copyPackagedShellCandidate(stage.stagingDirectory)
    : undefined;
  return {
    releaseDirectory: resolve(releaseDirectory),
    releaseId: stage.releaseId,
    stagingDirectory: stage.stagingDirectory,
    outputDirectory,
    ...(capacitor ? { capacitor } : {}),
    ...(packaged ? { packagedDirectory: packaged.workspaceDirectory } : {}),
  };
};

export const requireNativeWorkspace = (build: NativeReleaseBuild, kind: 'capacitor' | 'packaged'): string => {
  const directory = kind === 'capacitor' ? build.capacitor?.buildDirectory : build.packagedDirectory;
  if (!directory) throw new Error(`NATIVE_RELEASE_WORKSPACE_MISSING:${kind}`);
  return directory;
};

export const verifyNativeReleaseBuildInputs = async (build: NativeReleaseBuild): Promise<void> => {
  const release = await verifyCandidateReleaseDirectory(build.releaseDirectory);
  if (release.releaseId !== build.releaseId) throw new Error('NATIVE_BUILD_RELEASE_CHANGED');
  await verifyNativeWalletCandidateDirectory(build.stagingDirectory, build.releaseId);
  if (build.capacitor) {
    await verifyCapacitorShellCandidateDirectory(build.capacitor.sourceDirectory, build.stagingDirectory);
    await verifyCopiedWebRoot(build.stagingDirectory, join(build.capacitor.buildDirectory, 'ios/App/App/public'));
    await verifyCopiedWebRoot(
      build.stagingDirectory,
      join(build.capacitor.buildDirectory, 'android/app/src/main/assets/public'),
    );
    const config = createNativeCapacitorConfig(build.capacitor.buildDirectory, build.stagingDirectory);
    await verifyCapacitorGeneratedConfig(
      join(build.capacitor.buildDirectory, 'ios/App/App/capacitor.config.json'),
      config,
      true,
    );
    await verifyCapacitorGeneratedConfig(
      join(build.capacitor.buildDirectory, 'android/app/src/main/assets/capacitor.config.json'),
      config,
      false,
    );
  }
  if (build.packagedDirectory) {
    await verifyPackagedShellCandidateDirectory(build.packagedDirectory, build.stagingDirectory);
  }
};

export const verifyNativeDesktopCopy = async (build: NativeReleaseBuild, copiedDirectory: string): Promise<void> => {
  const sourceDirectory = join(requireNativeWorkspace(build, 'packaged'), 'desktop');
  const [source, copied] = await Promise.all([
    snapshotRegularTree(sourceDirectory),
    snapshotRegularTree(copiedDirectory),
  ]);
  if (safeStringify(source) !== safeStringify(copied)) throw new Error('NATIVE_DESKTOP_COPY_MISMATCH');
};
