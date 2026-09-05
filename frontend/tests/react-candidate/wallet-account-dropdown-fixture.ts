import { waitForWalletFixtureState } from './wallet-recovery-fixture';

// Dedicated Entities keep the large Account list independent of the payment
// fixture. Every relationship is opened through the real Runtime transition.
export async function createAccountDropdownFixture(fixturePort: number) {
  const runtime = await import('../../../core/runtime');
  const { deriveSignerAddressSync, deriveSignerKeySync, registerSignerKey } = await import('../../../core/account/crypto');
  const { defaultAccountDisputeConfigForParties } = await import('../../../core/account/config/dispute-config');
  const { createJAdapter } = await import('../../../core/jurisdiction/adapter/kernel/factory');
  const scenario = await import('../../../core/scenarios/harness/boot');
  const seed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const env = runtime.createEmptyEnv(seed);
  const runtimeId = String(env.runtimeId);
  env.dbNamespace = `${runtimeId}-react-account-dropdown-${fixturePort}`;
  env.quietRuntimeLogs = true;
  const chain = await createJAdapter({ mode: 'browservm', chainId: 31_337 });
  const name = 'Account dropdown fixture';
  scenario.bindScenarioJReplica(env, scenario.createJReplica(env, name, chain.addresses.depository), chain);
  const jurisdiction = scenario.createJurisdictionConfig(name, chain.addresses.depository, chain.addresses.entityProvider, 'browservm://', 31_337);
  runtime.startRuntimeLoop(env);
  const participants = Array.from({ length: 27 }, (_, index) => {
    const signerIndex = String(100 + index);
    const signerId = deriveSignerAddressSync(seed, signerIndex).toLowerCase();
    registerSignerKey(env, signerId, deriveSignerKeySync(seed, signerIndex));
    return { signerId, entityId: runtime.generateLazyEntityId([signerId], 1n), name: index === 0 ? 'Dropdown owner' : `Dropdown peer ${index}` };
  });
  const owner = participants[0];
  if (!owner) throw new Error('ACCOUNT_DROPDOWN_FIXTURE_OWNER_REQUIRED');
  const commit = async (submitted: Parameters<typeof runtime.enqueueRuntimeInput>[1]) => {
    const afterHeight = env.state.height;
    runtime.enqueueRuntimeInput(env, submitted);
    await runtime.waitForRuntimeInputCommitted({ env, submitted, afterHeight,
      readPersistedFrame: height => runtime.readPersistedStorageFrameRecord(env, height), timeoutMs: 20_000 });
  };
  await commit({ runtimeTxs: participants.map(peer => runtime.importEntity({
    entityId: peer.entityId, signerId: peer.signerId, entitySeed: `${seed}:${peer.name}`,
    data: { isProposer: true, profileName: peer.name, config: {
      mode: 'proposer-based', jurisdiction, validators: [peer.signerId], threshold: 1n, shares: { [peer.signerId]: 1n },
    } },
  })), entityInputs: [] });
  await commit({ runtimeTxs: [], entityInputs: participants.map(peer => ({
    entityId: peer.entityId, signerId: peer.signerId, entityTxs: [{ type: 'profile-update', data: {
      profile: { entityId: peer.entityId, name: peer.name, avatar: '', bio: '', website: '' },
    } }],
  })) });
  await commit({ runtimeTxs: [], entityInputs: [{ entityId: owner.entityId, signerId: owner.signerId,
    entityTxs: participants.slice(1).map(peer => ({ type: 'openAccount', data: {
      targetEntityId: peer.entityId,
      disputeConfig: defaultAccountDisputeConfigForParties(owner.entityId, false, peer.entityId, false),
    } })),
  }] });
  await waitForWalletFixtureState('dropdown-accounts-open', () => participants.slice(1).every(peer => {
    const replica = [...env.state.eReplicas.values()].find(item => item.state.entityId === peer.entityId);
    return Boolean(replica?.state.accounts.has(owner.entityId));
  }));
  return { env, runtimeId, entityId: owner.entityId, close: async () => {
    await runtime.stopRuntimeLoopAndWait(env);
    await runtime.closeRuntimeDb(env);
    await runtime.closeInfraDb(env);
    await chain.close();
  } };
}
