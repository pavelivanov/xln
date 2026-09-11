import { buffersEqual } from '../../../core/protocol/serialization';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyCandidateReleaseDirectory } from './candidate-release-verifier';

export const requireLifecycleReleaseDirectories = (env = process.env): readonly [string, string] => {
  const install = env['XLN_LIFECYCLE_INSTALL_DIRECTORY'];
  const update = env['XLN_LIFECYCLE_UPDATE_DIRECTORY'];
  if (!install || !update) throw new Error('LIFECYCLE_RELEASE_DIRECTORIES_REQUIRED');
  return [resolve(install), resolve(update)];
};

const readReleaseInput = async (directory: string) => ({
  directory,
  manifest: await verifyCandidateReleaseDirectory(directory),
  manifestBytes: await readFile(resolve(directory, 'release-manifest.json')),
});

export const readLifecycleReleaseInputs = async (directories = requireLifecycleReleaseDirectories()) => {
  const [install, update] = await Promise.all(directories.map(readReleaseInput));
  if (!install || !update) throw new Error('LIFECYCLE_RELEASE_DIRECTORIES_REQUIRED');
  if (install.manifest.releaseId === update.manifest.releaseId) throw new Error('LIFECYCLE_RELEASE_IDENTITIES_EQUAL');
  return { install, update };
};

export const verifyLifecycleReleaseInputs = async (
  inputs: Awaited<ReturnType<typeof readLifecycleReleaseInputs>>,
): Promise<void> => {
  for (const before of [inputs.install, inputs.update]) {
    const after = await readReleaseInput(before.directory);
    if (
      before.manifest.releaseId !== after.manifest.releaseId ||
      !buffersEqual(before.manifestBytes, after.manifestBytes)
    )
      throw new Error('LIFECYCLE_RELEASE_CHANGED');
  }
};
