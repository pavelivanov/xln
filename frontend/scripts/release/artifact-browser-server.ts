import { createVerifiedReleaseServer } from './verified-release-server';

const directory = process.env['XLN_REACT_ARTIFACT_DIRECTORY'];
if (!directory) throw new Error('ARTIFACT_BROWSER_DIRECTORY_REQUIRED');
const port = Number(process.env['PLAYWRIGHT_ARTIFACT_PORT'] ?? '19180');
const fixturePort = Number(process.env['XLN_REACT_WALLET_FIXTURE_PORT'] ?? '19192');
for (const value of [port, fixturePort]) {
  if (!Number.isSafeInteger(value) || value < 1024 || value > 65531) throw new Error('ARTIFACT_BROWSER_PORT_INVALID');
}
const { server, manifest, close } = await createVerifiedReleaseServer({
  directory,
  target: `http://127.0.0.1:${fixturePort}`,
  relayTarget: `http://127.0.0.1:${fixturePort + 3}`,
  identityPath: '/__xln-artifact/identity',
  ...(process.env['XLN_REACT_ARTIFACT_SOURCE_SHA'] ? { sourceSha: process.env['XLN_REACT_ARTIFACT_SOURCE_SHA'] } : {}),
});
server.listen(port, '127.0.0.1', () =>
  console.info(`ARTIFACT_BROWSER_READY release=${manifest.releaseId} port=${port}`),
);
const stop = () => {
  void close().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
};
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
