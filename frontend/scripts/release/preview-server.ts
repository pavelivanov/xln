import { parseReleasePreviewOptions } from './preview-options';
import { createVerifiedReleaseServer } from './verified-release-server';

const options = parseReleasePreviewOptions(process.argv.slice(2));
const { server, manifest, close } = await createVerifiedReleaseServer(options);
server.listen(options.port, '127.0.0.1', () => {
  console.info(
    `RELEASE_PREVIEW_READY origin=http://127.0.0.1:${options.port} release=${manifest.releaseId} files=${manifest.files.length}`,
  );
});
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  void close().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
};
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
