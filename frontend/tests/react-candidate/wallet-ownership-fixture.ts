import { getCertifiedBoardStackKey, getCertifiedBoardNodeStore, resolveObserverCertifiedBoardRecord } from '../../../core/jurisdiction/machine/board-registry';
import { registrationEvidenceKey } from '../../../core/jurisdiction/machine/registration-evidence';
import * as runtime from '../../../core/runtime';
import type { JAdapter, RuntimeReplica, ConsensusConfig } from '../../../core/api/public/runtime-module';
import { waitForWalletFixtureState } from './wallet-recovery-fixture';

export async function createWalletOwnershipFixture(
  env: RuntimeReplica,
  adapter: JAdapter,
  config: ConsensusConfig,
  commit: (input: Parameters<typeof runtime.enqueueRuntimeInput>[1]) => Promise<void>,
) {
  const signerId = config.validators[0];
  if (!signerId) throw new Error('OWNERSHIP_FIXTURE_SIGNER_REQUIRED');
  const number = await adapter.entityProvider.nextNumber();
  const registration = await adapter.entityProvider.registerNumberedEntity(runtime.encodeBoard(config, env));
  const receipt = await registration.wait();
  if (receipt?.status !== 1) throw new Error('OWNERSHIP_FIXTURE_REGISTRATION_FAILED');
  const entityId = runtime.generateNumberedEntityId(Number(number));
  if (!config.jurisdiction || !adapter.pollNow) throw new Error('OWNERSHIP_FIXTURE_WATCHER_REQUIRED');
  await adapter.pollNow();
  const evidenceKey = registrationEvidenceKey(getCertifiedBoardStackKey(config.jurisdiction), entityId);
  const boardHash = runtime.hashBoard(runtime.encodeBoard(config, env)).toLowerCase();
  await waitForWalletFixtureState('Ownership registration authority', () => {
    const evidence = env.infrastructure?.certifiedRegistrationEvidence?.get(evidenceKey);
    return evidence?.boardHash === boardHash && evidence.activationHeight === Number(receipt.blockNumber);
  });
  await commit({ runtimeTxs: [runtime.importEntity({
    entityId, signerId, entitySeed: 'isolated-browser-ownership-fixture',
    data: { config, isProposer: true, profileName: 'Browser Share Company' },
  })], entityInputs: [] });
  const readReplica = () => [...env.state.eReplicas.values()].find(replica => replica.state.entityId === entityId);
  await adapter.pollNow();
  await waitForWalletFixtureState('Ownership observer certified board', () => {
    const replica = readReplica();
    return Boolean(replica && resolveObserverCertifiedBoardRecord(replica.state, getCertifiedBoardNodeStore(env), entityId)?.boardHash === boardHash);
  });
  await commit({ runtimeTxs: [], entityInputs: [{ entityId, signerId, entityTxs: [{
    type: 'entityProviderReleaseControlShares',
    data: { recipientAddress: adapter.addresses.depository, controlAmount: 80n, dividendAmount: 40n, purpose: 'browser-ownership-evidence' },
  }] }] });
  await waitForWalletFixtureState('Ownership share release confirmation', () => (readReplica()?.state.entityProviderActionState?.confirmedNonce ?? 0n) > 0n);
  const registry = await adapter.getTokenRegistry();
  const shareToken = (externalTokenId: bigint) => {
    const token = registry.find(entry => entry.tokenType === 2 && entry.address.toLowerCase() === adapter.addresses.entityProvider.toLowerCase() && entry.externalTokenId === externalTokenId);
    if (!token) throw new Error(`OWNERSHIP_FIXTURE_SHARE_TOKEN_MISSING:${externalTokenId}`);
    return token.tokenId;
  };
  const controlTokenId = shareToken(BigInt(entityId));
  const dividendTokenId = shareToken(BigInt(entityId) | (1n << 255n));
  await waitForWalletFixtureState('Ownership committed share reserves', () => readReplica()?.state.reserves.get(controlTokenId) === 80n && readReplica()?.state.reserves.get(dividendTokenId) === 40n);
  return { entityId, control: '80', dividend: '40' };
}
