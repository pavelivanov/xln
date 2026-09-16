import { closeSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import { verifyCandidateReleaseDirectory } from '../dist/frontend-verifier.js';
import { ensureJurisdictionsConfig, openDaemonLog, PACKAGE_ROOT } from './state.js';

export const readFrontendReleaseDirectory = () => {
  const pointer = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'dist', 'frontend-release.json'), 'utf8'));
  if (
    !pointer ||
    typeof pointer !== 'object' ||
    Array.isArray(pointer) ||
    Object.keys(pointer).sort().join(',') !== 'releaseId,schemaVersion' ||
    pointer.schemaVersion !== 1 ||
    typeof pointer.releaseId !== 'string' ||
    !/^sha256-[0-9a-f]{64}$/.test(pointer.releaseId)
  ) {
    throw new Error('XLNFINANCE_FRONTEND_RELEASE_INVALID');
  }
  return join(PACKAGE_ROOT, 'app', pointer.releaseId);
};

export const requireDistributionAssets = async paths => {
  if (!existsSync(paths.server)) throw new Error(`XLN_SERVER_BUNDLE_MISSING:${paths.server}`);
  if (!existsSync(paths.brainvaultWorker)) {
    throw new Error(`XLN_BRAINVAULT_WORKER_BUNDLE_MISSING:${paths.brainvaultWorker}`);
  }
  if (!existsSync(paths.launcherClient)) {
    throw new Error(`XLNFINANCE_LAUNCHER_CLIENT_BUNDLE_MISSING:${paths.launcherClient}`);
  }
  await verifyCandidateReleaseDirectory(readFrontendReleaseDirectory());
};

export const spawnDaemon = async ({ instanceId, version, runtimeSeed, authSeed, controlToken, paths }) => {
  const frontendRelease = readFrontendReleaseDirectory();
  const jurisdictions = await ensureJurisdictionsConfig(paths);
  if (jurisdictions.warning) {
    console.warn(`xlnfinance: live testnet config unavailable; using last verified cache (${jurisdictions.warning})`);
  }
  const arrakisRpc = String(jurisdictions.config?.jurisdictions?.arrakis?.rpc || '');
  const logDescriptor = openDaemonLog(paths);
  const child = spawn(process.execPath, [
    paths.server,
    '--host', '127.0.0.1',
    '--port', '8080',
    '--frontend-release', frontendRelease,
    '--server-id', paths.mode === 'dev' ? 'xlnfinance-dev' : 'xlnfinance-testnet',
  ], {
    cwd: PACKAGE_ROOT,
    detached: true,
    stdio: ['ignore', logDescriptor, logDescriptor],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      RUNTIME_VERBOSE_LOGS: '0',
      XLN_DB_PATH: paths.database,
      XLN_JURISDICTIONS_PATH: jurisdictions.path,
      XLN_DISTRIBUTION_VERSION: version,
      XLN_LOCAL_CONTROL_TOKEN: controlToken,
      XLN_LOCAL_INSTANCE_ID: instanceId,
      XLN_LOCAL_OWNER_PROFILE_NAME: 'xln',
      XLN_BRAINVAULT_OWNER_PATH: paths.brainvaultOwner,
      XLN_BRAINVAULT_WORKER_PATH: paths.brainvaultWorker,
      XLN_RADAPTER_AUTH_SEED: authSeed,
      XLN_RADAPTER_REQUIRE_AUTH_SEED: '1',
      XLN_RUNTIME_SEED: runtimeSeed,
      ...(paths.mode === 'dev' ? {
        USE_ANVIL: 'false',
        XLN_LOCAL_SIMULATION: 'true',
        RELAY_URL: 'ws://localhost:8080/relay',
      } : {
        USE_ANVIL: 'true',
        XLN_LOCAL_SIMULATION: 'false',
        ANVIL_RPC: arrakisRpc,
        XLN_USE_PREDEPLOYED_ADDRESSES: 'true',
        XLN_PREDEPLOYED_JURISDICTION_KEY: 'arrakis',
        RELAY_URL: 'wss://xln.finance/relay',
      }),
      XLN_SKIP_SERVER_BOOTSTRAP: '1',
    },
  });
  child.unref();
  closeSync(logDescriptor);
  if (!child.pid) throw new Error('XLN_DAEMON_PID_MISSING');
  return child.pid;
};

export const openSystemBrowser = (url) => {
  const command = process.platform === 'darwin'
    ? ['open', url]
    : process.platform === 'win32'
      ? ['cmd', '/c', 'start', '', url]
      : ['xdg-open', url];
  const child = spawn(command[0], command.slice(1), { detached: true, stdio: 'ignore' });
  child.unref();
};

export const stopDaemonProcess = (pid) => {
  if (!Number.isSafeInteger(pid) || pid <= 1) throw new Error(`XLN_DAEMON_PID_INVALID:${pid}`);
  process.kill(pid, 'SIGTERM');
};
