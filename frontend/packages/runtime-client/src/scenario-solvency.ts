import { calculateSolvency } from '@xln/core/api/public/public-utilities';
import type { EnvSnapshot, RuntimeAdapterSolvencySummary, RuntimeReplica } from '@xln/core/api/public/runtime-module';

export const projectScenarioSolvency = (recordedRuntime: RuntimeReplica, snapshot: EnvSnapshot): RuntimeAdapterSolvencySummary => {
  // The completed recording owns this Runtime envelope. Only its committed
  // state is selected for the canonical read; no Runtime is started or mutated.
  const solvency = calculateSolvency({ ...recordedRuntime, state: snapshot.state });
  return { ok: true, height: snapshot.state.height, entityCount: solvency.entityCount, accountViews: solvency.accountViews,
    assets: [...solvency.byAsset.values()].sort((a, b) => a.stackId.localeCompare(b.stackId) || a.tokenId - b.tokenId), isValid: solvency.isValid };
};
