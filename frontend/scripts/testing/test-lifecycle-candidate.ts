import { resolve } from 'node:path';
import { readLifecycleReleaseInputs, verifyLifecycleReleaseInputs } from '../release/lifecycle-release-inputs';

const [kind, install, update, ...args] = Bun.argv.slice(2);
if (kind !== 'pwa' && kind !== 'deployment') throw new Error('LIFECYCLE_KIND_REQUIRED:pwa|deployment');
if (!install || !update || install.startsWith('-') || update.startsWith('-'))
  throw new Error('LIFECYCLE_RELEASE_DIRECTORIES_REQUIRED:install update');
const inputs = await readLifecycleReleaseInputs([resolve(install), resolve(update)]);
console.info(
  `LIFECYCLE_START kind=${kind} install=${inputs.install.manifest.releaseId} update=${inputs.update.manifest.releaseId}`,
);
const child = Bun.spawn(['bunx', 'playwright', 'test', '--config', `playwright.${kind}.config.ts`, ...args], {
  cwd: resolve(import.meta.dir, '../..'),
  env: {
    ...process.env,
    XLN_LIFECYCLE_INSTALL_DIRECTORY: inputs.install.directory,
    XLN_LIFECYCLE_UPDATE_DIRECTORY: inputs.update.directory,
  },
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
});
const stop = () => child.kill('SIGTERM');
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
const code = await child.exited;
await verifyLifecycleReleaseInputs(inputs);
console.info(
  `LIFECYCLE_VERIFIED kind=${kind} install=${inputs.install.manifest.releaseId} update=${inputs.update.manifest.releaseId} exit=${code}`,
);
process.exit(code);
