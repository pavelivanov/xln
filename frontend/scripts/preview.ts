import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReleasePreviewOptions } from './release/preview-options';
import { verifyCandidateReleaseDirectory } from '../../packages/frontend-release/verify';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));
const serverBundle = fileURLToPath(new URL('../.artifacts/tooling/preview-server.mjs', import.meta.url));

const run = async (): Promise<void> => {
  const { directory } = parseReleasePreviewOptions(Bun.argv.slice(2));
  await verifyCandidateReleaseDirectory(directory);
  await mkdir(dirname(serverBundle), { recursive: true });
  // Match the development gateway's Node transport; compile only tooling.
  // The explicit application release is never built, prepared or rewritten.
  const build = Bun.spawn(
    ['bun', 'build', 'scripts/release/preview-server.ts', '--target=node', '--outfile', serverBundle],
    {
      cwd: frontendRoot,
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );
  if ((await build.exited) !== 0) throw new Error('RELEASE_PREVIEW_SERVER_BUILD_FAILED');
  const server = Bun.spawn(['node', serverBundle, directory], {
    cwd: frontendRoot,
    env: process.env,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });
  let stopping = false;
  const stop = (signal: NodeJS.Signals): void => {
    stopping = true;
    server.kill(signal);
  };
  const interrupt = () => stop('SIGINT');
  const terminate = () => stop('SIGTERM');
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', terminate);
  try {
    const exitCode = await server.exited;
    if (!stopping && exitCode !== 0) throw new Error(`RELEASE_PREVIEW_SERVER_EXITED:${exitCode}`);
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', terminate);
  }
};

if (import.meta.main) {
  run().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
