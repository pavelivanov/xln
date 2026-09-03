import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { Wallet, hexlify } from 'ethers';

import { createBrowserVmRpcFixture } from './browser-vm-rpc-fixture';

export const WALLET_RECOVERY_FIXTURE_MNEMONIC =
  'test test test test test test test test test test test junk';
export const WALLET_BRAINVAULT_FIXTURE_MNEMONIC =
  'milk click novel require across cousin good chair street mouse crash movie same daughter air quote total pride crop mention focus sick slice hole';

export type WalletRecoveryFixture = Readonly<{
  backupFileContents: string;
  entityId: string;
  runtimeId: string;
  runtimeHeight: number;
  towerUrl: string;
  rpcUrl: string;
  external: Readonly<{
    recipient: string;
    tokenAddress: string;
    tokenSymbol: 'USDC';
    initialBalance: string;
  }>;
  brainVault: Readonly<{
    backupFileContents: string;
    runtimeId: string;
    runtimeHeight: number;
  }>;
  close: () => Promise<void>;
}>;

export const waitForWalletFixtureState = async (
  label: string,
  predicate: () => boolean,
): Promise<void> => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await Bun.sleep(25);
  }
  throw new Error(`WALLET_RUNTIME_FIXTURE_STATE_TIMEOUT:${label}`);
};

export const createWalletRecoveryFixture = async (
  fixturePort: number,
): Promise<WalletRecoveryFixture> => {
  const [runtime, commandAuthority, serialization, watchtower, liveJAdapters] = await Promise.all([
    import('../../../core/runtime'),
    import('../../../core/runtime/command/frontier-auth'),
    import('../../../core/protocol/serialization'),
    import('../../../core/watchtower/standalone-server'),
    import('../../../core/runtime/j-submit/live-jadapters'),
  ]);
  const chainId = 31_337;
  const rpcPort = fixturePort + 2;
  if (rpcPort > 65_535) throw new Error('WALLET_RECOVERY_FIXTURE_PORT_INVALID');
  const rpcFixture = await createBrowserVmRpcFixture(rpcPort);
  const { chainAdapter, rpcUrl } = rpcFixture;
  const createAppointment = async (seed: string, suffix: string) => {
    const env = runtime.createEmptyEnv(seed);
    const runtimeId = String(env.runtimeId || '').trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(runtimeId)) {
      throw new Error('WALLET_RECOVERY_FIXTURE_RUNTIME_ID_INVALID');
    }
    env.dbNamespace = `${runtimeId}-react-recovery-${fixturePort}-${suffix}`;
    env.quietRuntimeLogs = true;
    runtime.enqueueRuntimeInput(env, {
      runtimeTxs: [commandAuthority.markLocalRuntimeAdapterCommandTx({
        type: 'recordRuntimeAdapterCommand',
        data: {
          laneId: `0x${'61'.repeat(32)}`,
          sequence: 1,
          commandId: `react-recovery-${suffix}`,
          inputHash: `0x${'62'.repeat(32)}`,
          expiresAtMs: null,
        },
      })],
      entityInputs: [],
    });
    await runtime.processRuntime(env);
    const jurisdictionName = `React Recovery ${suffix}`;
    runtime.enqueueRuntimeInput(env, {
      runtimeTxs: [{
        type: 'importJ',
        data: {
          name: jurisdictionName,
          chainId,
          ticker: 'SIM',
          rpcs: [rpcUrl],
          contracts: { ...chainAdapter.addresses },
          entityProviderDeploymentBlock: chainAdapter.entityProviderDeploymentBlock,
        },
      }],
      entityInputs: [],
    });
    await runtime.processRuntime(env);
    await runtime.processRuntime(env);
    const jReplica = env.state.jReplicas.get(jurisdictionName);
    if (!jReplica?.contracts?.depository || !jReplica.contracts.entityProvider) {
      throw new Error('WALLET_RECOVERY_FIXTURE_JURISDICTION_MISSING');
    }
    const jurisdiction = {
      name: jurisdictionName,
      chainId,
      address: rpcUrl,
      depositoryAddress: jReplica.contracts.depository,
      entityProviderAddress: jReplica.contracts.entityProvider,
    };
    const entityId = runtime.generateLazyEntityId([runtimeId], 1n);
    runtime.enqueueRuntimeInput(env, {
      runtimeTxs: [runtime.importEntity({
        entityId,
        signerId: runtimeId,
        entitySeed: seed,
        data: {
          isProposer: true,
          profileName: `Recovery ${suffix}`,
          config: {
            mode: 'proposer-based',
            threshold: 1n,
            validators: [runtimeId],
            shares: { [runtimeId]: 1n },
            jurisdiction,
          },
        },
      })],
      entityInputs: [],
    });
    await runtime.processRuntime(env);
    const bundle = runtime.buildRuntimeRecoveryBundle(env, {
      signers: [{
        index: 0,
        derivationIndex: 0,
        address: runtimeId,
        name: 'Signer 1',
        entityId,
        jurisdiction: jurisdictionName,
      }],
    });
    const encrypted = await runtime.encryptRuntimeRecoveryBundle(bundle, seed);
    const signedAt = Date.now();
    const wallet = new Wallet(hexlify(runtime.deriveSignerKeySync(seed, '1')));
    const signature = await wallet.signMessage(runtime.buildTowerAppointmentOwnerMessage(
      runtimeId, 'blind_backup', encrypted.lookupKey, 0, encrypted, signedAt, undefined,
    ));
    return { env, runtimeId, entityId, bundle, encrypted, ownerProof: { runtimeId, signedAt, signature } };
  };
  const [mnemonic, brainVault] = await Promise.all([
    createAppointment(WALLET_RECOVERY_FIXTURE_MNEMONIC, 'mnemonic'),
    createAppointment(WALLET_BRAINVAULT_FIXTURE_MNEMONIC, 'brainvault'),
  ]);
  const initialExternalBalance = 125_000_000n;
  if (!chainAdapter.fundSignerWallet) throw new Error('WALLET_RECOVERY_FIXTURE_FAUCET_REQUIRED');
  await chainAdapter.fundSignerWallet(mnemonic.runtimeId, initialExternalBalance, 'USDC');
  const token = (await chainAdapter.getTokenRegistry()).find(({ symbol }) => symbol === 'USDC');
  if (!token) throw new Error('WALLET_RECOVERY_FIXTURE_USDC_REQUIRED');
  const fundedExternalBalance = await chainAdapter.getErc20Balance(token.address, mnemonic.runtimeId);
  const externalRecipient = new Wallet(`0x${'77'.repeat(32)}`).address.toLowerCase();
  const closeAppointments = async (): Promise<void> => {
    for (const appointment of [mnemonic, brainVault]) {
      for (const { adapter } of liveJAdapters.getLiveJAdapterEntries(appointment.env)) {
        await adapter.close();
      }
      await runtime.closeRuntimeDb(appointment.env);
      await runtime.closeInfraDb(appointment.env);
    }
  };
  const towerRoot = `/tmp/xln-react-wallet-recovery-tower-${fixturePort}`;
  const towerPort = fixturePort + 1;
  if (towerPort > 65_535) throw new Error('WALLET_RECOVERY_FIXTURE_PORT_INVALID');
  await rm(towerRoot, { recursive: true, force: true });
  const tower = watchtower.startStandaloneWatchtowerServer({
    host: '127.0.0.1',
    port: towerPort,
    towerId: 'react-wallet-recovery',
    dbPath: join(towerRoot, 'tower.level'),
    enablePushWake: true,
    pushDbPath: join(towerRoot, 'push.level'),
    pushSweepIntervalMs: 24 * 60 * 60 * 1000,
    maxStoredBytesPerLookupKey: 4 * 1024 * 1024,
  });
  const towerUrl = `http://127.0.0.1:${tower.server.port}`;
  for (const appointment of [mnemonic, brainVault]) {
    const response = await fetch(`${towerUrl}/api/tower/appointment`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: serialization.serializeTaggedJson({
        type: 'tower_appointment',
        version: 1,
        towerMode: 'blind_backup',
        lookupKey: appointment.encrypted.lookupKey,
        slot: 0,
        bundle: appointment.encrypted,
        ownerProof: appointment.ownerProof,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      await tower.close();
      await closeAppointments();
      await rm(towerRoot, { recursive: true, force: true });
      throw new Error(`WALLET_RECOVERY_FIXTURE_UPLOAD_FAILED:${response.status}:${detail}`);
    }
  }

  return {
    backupFileContents: serialization.serializeTaggedJson({
      version: 1,
      bundles: [mnemonic.encrypted],
    }),
    entityId: mnemonic.entityId,
    runtimeId: mnemonic.runtimeId,
    runtimeHeight: mnemonic.bundle.runtimeHeight,
    towerUrl,
    rpcUrl,
    external: {
      recipient: externalRecipient,
      tokenAddress: token.address.toLowerCase(),
      tokenSymbol: 'USDC',
      initialBalance: fundedExternalBalance.toString(),
    },
    brainVault: {
      backupFileContents: serialization.serializeTaggedJson({
        version: 1,
        bundles: [brainVault.encrypted],
      }),
      runtimeId: brainVault.runtimeId,
      runtimeHeight: brainVault.bundle.runtimeHeight,
    },
    close: async () => {
      await tower.close();
      await closeAppointments();
      await rpcFixture.close();
      await rm(towerRoot, { recursive: true, force: true });
    },
  };
};
