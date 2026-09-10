import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { verifyCandidateReleaseDirectory } from './release/candidate-release-verifier';

const [rawDirectory, ...args] = Bun.argv.slice(2);
if (!rawDirectory || rawDirectory.startsWith('-')) throw new Error('ARTIFACT_BROWSER_DIRECTORY_REQUIRED');
const directory = resolve(rawDirectory);
const before = await verifyCandidateReleaseDirectory(directory);
const manifestPath = `${directory}/release-manifest.json`;
const beforeBytes = await readFile(manifestPath);
const git = Bun.spawn(['git', 'rev-parse', 'HEAD'], { stdout: 'pipe', stderr: 'inherit' });
const sourceSha = (await new Response(git.stdout).text()).trim();
if ((await git.exited) !== 0 || !/^[0-9a-f]{40}$/.test(sourceSha))
  throw new Error('ARTIFACT_BROWSER_SOURCE_SHA_REQUIRED');
console.info(`ARTIFACT_BROWSER_START source=${sourceSha} release=${before.releaseId} files=${before.files.length}`);
const child = Bun.spawn(['bunx', 'playwright', 'test', '--config', 'playwright.artifact.config.ts', ...args], {
  cwd: resolve(import.meta.dir, '..'),
  env: { ...process.env, XLN_REACT_ARTIFACT_DIRECTORY: directory, XLN_REACT_ARTIFACT_SOURCE_SHA: sourceSha },
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
});
const stop = () => child.kill('SIGTERM');
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
const code = await child.exited;
const after = await verifyCandidateReleaseDirectory(directory);
if (after.releaseId !== before.releaseId || !beforeBytes.equals(await readFile(manifestPath))) {
  throw new Error('ARTIFACT_BROWSER_RELEASE_CHANGED');
}
console.info(`ARTIFACT_BROWSER_VERIFIED source=${sourceSha} release=${after.releaseId} exit=${code}`);
process.exit(code);
