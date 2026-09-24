import { deploymentReleaseDirectory, readDeploymentCandidateState, verifyDeploymentCandidateState } from './deployment';
import { prepareVerifiedRelease } from './http';

export const prepareVerifiedDeployment = async (deploymentRoot: string) => {
  const initial = await verifyDeploymentCandidateState(deploymentRoot);
  let key = `${initial.state.activeReleaseId}:${initial.state.rollbackReleaseId}`;
  let selected = prepareVerifiedRelease(initial.activeDirectory);
  await selected;
  return {
    serve: async (request: Request): Promise<Response | null> => {
      const state = await readDeploymentCandidateState(deploymentRoot);
      if (!state) throw new Error('DEPLOYMENT_CANDIDATE_STATE_REQUIRED');
      const nextKey = `${state.activeReleaseId}:${state.rollbackReleaseId}`;
      if (nextKey !== key) {
        key = nextKey;
        selected = (async () => {
          if (state.rollbackReleaseId) {
            await prepareVerifiedRelease(deploymentReleaseDirectory(deploymentRoot, state.rollbackReleaseId));
          }
          return prepareVerifiedRelease(deploymentReleaseDirectory(deploymentRoot, state.activeReleaseId));
        })();
      }
      // Each request holds one verified selection even if activation overlaps it.
      // Changed bytes still fail their per-file hash check; checkout substitution is forbidden.
      return (await selected).serve(request);
    },
  };
};
