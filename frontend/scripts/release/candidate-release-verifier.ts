import { verifyCandidateReleaseDirectory } from '../../../packages/frontend-release/verify';

const run = async (): Promise<void> => {
  const releaseDirectory = Bun.argv[2];
  if (!releaseDirectory || Bun.argv.length !== 3) throw new Error('CANDIDATE_RELEASE_DIRECTORY_REQUIRED');
  const manifest = await verifyCandidateReleaseDirectory(releaseDirectory);
  console.info(`FRONTEND_CANDIDATE_VERIFY_OK release=${manifest.releaseId} files=${manifest.files.length} path=${releaseDirectory}`);
};

if (import.meta.main) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
