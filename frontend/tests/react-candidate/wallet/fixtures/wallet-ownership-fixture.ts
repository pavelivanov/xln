import { getCertifiedBoardStackKey, getCertifiedBoardNodeStore, resolveObserverCertifiedBoardRecord } from '../../../../../core/jurisdiction/machine/board-registry';
import { registrationEvidenceKey } from '../../../../../core/jurisdiction/machine/registration-evidence';
import * as runtime from '../../../../../core/runtime';
import type { JAdapter, RuntimeReplica, ConsensusConfig } from '../../../../../core/api/public/runtime-module';
import { signAccountFrame } from '../../../../../core/account/crypto';
import { buildQuorumHanko } from '../../../../../core/hanko/signing';
import { createTestEntityImportRuntimeTx } from '../../../../../core/qa/entity-creation-fixture';
import { ENTITY_SHARE_SUPPLY } from '../../../../src/lib/components/Entity/ownership/ownership-flow';
import { waitForWalletFixtureState } from './wallet-recovery-fixture';

const registerOwnershipEntity = async (
  env: RuntimeReplica,
  adapter: JAdapter,
  config: ConsensusConfig,
  commit: (input: Parameters<typeof runtime.enqueueRuntimeInput>[1]) => Promise<void>,
  profileName: string,
  entitySeed: string,
  isProposer = true,
  replicaSignerId = '',
  peerReplica: Readonly<{ signerId: string; isProposer: boolean }> | null = null,
) => {
  const signerId = replicaSignerId || config.validators[0];
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
  const imports = peerReplica ? [
    createTestEntityImportRuntimeTx(env, {
      entityId,
      signerId: peerReplica.signerId,
      data: { config, isProposer: peerReplica.isProposer, profileName },
    }),
    createTestEntityImportRuntimeTx(env, {
      entityId,
      signerId,
      data: { config, isProposer, profileName },
    }),
  ] : [runtime.importEntity({
    entityId, signerId, entitySeed,
    data: { config, isProposer, profileName },
  })];
  await commit({ runtimeTxs: imports, entityInputs: [] });
  const readReplica = () => [...env.state.eReplicas.values()].find(replica => (
    replica.state.entityId === entityId && replica.signerId.toLowerCase() === signerId.toLowerCase()
  ));
  await adapter.pollNow();
  await waitForWalletFixtureState('Ownership observer certified board', () => {
    const replica = readReplica();
    return Boolean(replica && resolveObserverCertifiedBoardRecord(replica.state, getCertifiedBoardNodeStore(env), entityId)?.boardHash === boardHash);
  });
  return { entityId, signerId, readReplica };
};

export async function createWalletOwnershipFixtures(
  env: RuntimeReplica,
  adapter: JAdapter,
  config: ConsensusConfig,
  commit: (input: Parameters<typeof runtime.enqueueRuntimeInput>[1]) => Promise<void>,
) {
  const released = await registerOwnershipEntity(
    env, adapter, config, commit, 'Browser Share Company', 'isolated-browser-ownership-fixture',
  );
  const slots = ['mobile-390x844', 'laptop-1366x900', 'wide-1920x1080'] as const;
  const unreleased: Awaited<ReturnType<typeof registerOwnershipEntity>>[] = [];
  for (const slot of slots) {
    unreleased.push(await registerOwnershipEntity(
      env, adapter, config, commit, `Browser New Share Company ${slot}`, `isolated-browser-ownership-release-fixture:${slot}`,
    ));
  }
  await commit({ runtimeTxs: [], entityInputs: [{ entityId: released.entityId, signerId: released.signerId, entityTxs: [{ type: 'entityProviderReleaseControlShares',
    data: { recipientAddress: adapter.addresses.depository, controlAmount: 80n, dividendAmount: 40n, purpose: 'browser-ownership-evidence' } }] }] });
  await waitForWalletFixtureState('Ownership share release confirmation', () => (released.readReplica()?.state.entityProviderActionState?.confirmedNonce ?? 0n) > 0n);
  const registry = await adapter.getTokenRegistry();
  const shareToken = (externalTokenId: bigint) => {
    const token = registry.find(entry => entry.tokenType === 2 && entry.address.toLowerCase() === adapter.addresses.entityProvider.toLowerCase() && entry.externalTokenId === externalTokenId);
    if (!token) throw new Error(`OWNERSHIP_FIXTURE_SHARE_TOKEN_MISSING:${externalTokenId}`);
    return token.tokenId;
  };
  const controlTokenId = shareToken(BigInt(released.entityId));
  const dividendTokenId = shareToken(BigInt(released.entityId) | (1n << 255n));
  await waitForWalletFixtureState('Ownership committed share reserves', () => released.readReplica()?.state.reserves.get(controlTokenId) === 80n && released.readReplica()?.state.reserves.get(dividendTokenId) === 40n);
  return {
    released: { entityId: released.entityId, control: '80', dividend: '40' },
    unreleased: Object.fromEntries(unreleased.map((entity, index) => [
      slots[index],
      { entityId: entity.entityId, control: '0', dividend: '0' },
    ])),
  };
}

export async function createWalletOwnershipGovernanceFixture(
  env: RuntimeReplica,
  adapter: JAdapter,
  config: ConsensusConfig,
  commit: (input: Parameters<typeof runtime.enqueueRuntimeInput>[1]) => Promise<void>,
  slot: string,
  targetProposerSignerId: string,
) {
  const signerId = config.validators[0];
  if (!signerId) throw new Error('OWNERSHIP_GOVERNANCE_FIXTURE_SIGNER_REQUIRED');
  const shareholder = await registerOwnershipEntity(
    env, adapter, config, commit, `Browser CONTROL Holder ${slot}`, `isolated-browser-ownership-governance-shareholder:${slot}`,
  );
  const targetConfig: ConsensusConfig = {
    ...structuredClone(config),
    threshold: 2n,
    validators: [targetProposerSignerId, signerId],
    shares: { [signerId]: 1n, [targetProposerSignerId]: 1n },
  };
  const target = await registerOwnershipEntity(
    env,
    adapter,
    targetConfig,
    commit,
    `Browser Takeover Target ${slot}`,
    `isolated-browser-ownership-governance-target:${slot}`,
    false,
    signerId,
    { signerId: targetProposerSignerId, isProposer: true },
  );
  const purpose = `browser-control-takeover:${slot}`;
  const releaseHash = String(await adapter.entityProvider.computeReleaseControlSharesHankoHash(
    BigInt(target.entityId), adapter.addresses.depository, ENTITY_SHARE_SUPPLY, 0n, purpose, 1n,
  )).toLowerCase();
  const releaseHanko = await buildQuorumHanko(
    env,
    target.entityId,
    releaseHash,
    [
      { signerId: targetProposerSignerId, signature: signAccountFrame(env, targetProposerSignerId, releaseHash) },
      { signerId, signature: signAccountFrame(env, signerId, releaseHash) },
    ],
    targetConfig,
    target.readReplica()?.state,
  );
  const releaseReceipt = await (await adapter.entityProvider.releaseControlShares(
    BigInt(target.entityId), adapter.addresses.depository, ENTITY_SHARE_SUPPLY, 0n, purpose, releaseHanko,
  )).wait();
  if (releaseReceipt?.status !== 1) throw new Error('OWNERSHIP_GOVERNANCE_SHARE_RELEASE_FAILED');
  await adapter.pollNow?.();
  const registry = await adapter.getTokenRegistry();
  const controlToken = registry.find(entry => entry.tokenType === 2
    && entry.address.toLowerCase() === adapter.addresses.entityProvider.toLowerCase()
    && entry.externalTokenId === BigInt(target.entityId));
  if (!controlToken) throw new Error(`OWNERSHIP_GOVERNANCE_CONTROL_TOKEN_MISSING:${target.entityId}`);
  await waitForWalletFixtureState('Takeover target CONTROL reserve', () => (
    target.readReplica()?.state.reserves.get(controlToken.tokenId) ?? 0n
  ) === ENTITY_SHARE_SUPPLY);
  await adapter.debugFundReserves(shareholder.entityId, controlToken.tokenId, ENTITY_SHARE_SUPPLY);
  await adapter.pollNow?.();
  await waitForWalletFixtureState('Shareholder CONTROL reserve', () => (
    shareholder.readReplica()?.state.reserves.get(controlToken.tokenId) ?? 0n
  ) === ENTITY_SHARE_SUPPLY);
  const successorConfig = {
    ...structuredClone(targetConfig),
    threshold: 1n,
    validators: [signerId],
    shares: { [signerId]: 1n },
  };
  return {
    shareholderEntityId: shareholder.entityId,
    targetEntityId: target.entityId,
    targetName: `Browser Takeover Target ${slot}`,
    successorSignerId: signerId,
    expectedBoardHash: runtime.hashBoard(runtime.encodeBoard(successorConfig, env)).toLowerCase(),
  };
}

export async function createWalletOwnershipActivatedFixture(
  env: RuntimeReplica,
  adapter: JAdapter,
  config: ConsensusConfig,
  commit: (input: Parameters<typeof runtime.enqueueRuntimeInput>[1]) => Promise<void>,
  slot: string,
) {
  const signerId = config.validators[0];
  if (!signerId) throw new Error('OWNERSHIP_ACTIVATED_FIXTURE_SIGNER_REQUIRED');
  const shareholder = await registerOwnershipEntity(
    env,
    adapter,
    config,
    commit,
    `Browser CONTROL Holder active-${slot}`,
    `isolated-browser-ownership-active-shareholder:${slot}`,
  );
  const target = await registerOwnershipEntity(
    env,
    adapter,
    config,
    commit,
    `Browser Activated Target ${slot}`,
    `isolated-browser-ownership-active-target:${slot}`,
  );
  return {
    shareholderEntityId: shareholder.entityId,
    targetEntityId: target.entityId,
    targetName: `Browser Activated Target ${slot}`,
    successorSignerId: signerId,
    expectedBoardHash: runtime.hashBoard(runtime.encodeBoard(config, env)).toLowerCase(),
  };
}
