import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { Wallet, hexlify } from 'ethers';

export const WALLET_RECOVERY_FIXTURE_MNEMONIC =
  'test test test test test test test test test test test junk';

export type WalletRecoveryFixture = Readonly<{
  runtimeId: string;
  runtimeHeight: number;
  towerUrl: string;
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
  const [runtime, commandAuthority, serialization, watchtower] = await Promise.all([
    import('../../../core/runtime'),
    import('../../../core/runtime/command/frontier-auth'),
    import('../../../core/protocol/serialization'),
    import('../../../core/watchtower/standalone-server'),
  ]);
  const seed = WALLET_RECOVERY_FIXTURE_MNEMONIC;
  const recoveryEnv = runtime.createEmptyEnv(seed);
  const runtimeId = String(recoveryEnv.runtimeId || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(runtimeId)) {
    throw new Error('WALLET_RECOVERY_FIXTURE_RUNTIME_ID_INVALID');
  }
  recoveryEnv.dbNamespace = `${runtimeId}-react-recovery-${fixturePort}`;
  recoveryEnv.quietRuntimeLogs = true;
  runtime.enqueueRuntimeInput(recoveryEnv, {
    runtimeTxs: [commandAuthority.markLocalRuntimeAdapterCommandTx({
      type: 'recordRuntimeAdapterCommand',
      data: {
        laneId: `0x${'61'.repeat(32)}`,
        sequence: 1,
        commandId: 'react-recovery-01',
        inputHash: `0x${'62'.repeat(32)}`,
        expiresAtMs: null,
      },
    })],
    entityInputs: [],
  });
  await runtime.processRuntime(recoveryEnv);

  const bundle = runtime.buildRuntimeRecoveryBundle(recoveryEnv, {
    signers: [{
      index: 0,
      derivationIndex: 0,
      address: runtimeId,
      name: 'Signer 1',
    }],
  });
  const encrypted = await runtime.encryptRuntimeRecoveryBundle(bundle, seed);
  const signedAt = Date.now();
  const wallet = new Wallet(hexlify(runtime.deriveSignerKeySync(seed, '1')));
  const signature = await wallet.signMessage(runtime.buildTowerAppointmentOwnerMessage(
    runtimeId,
    'blind_backup',
    encrypted.lookupKey,
    0,
    encrypted,
    signedAt,
    undefined,
  ));
  const towerRoot = `/tmp/xln-react-wallet-recovery-tower-${fixturePort}`;
  const towerPort = fixturePort + 1;
  if (towerPort > 65_535) throw new Error('WALLET_RECOVERY_FIXTURE_PORT_INVALID');
  await rm(towerRoot, { recursive: true, force: true });
  const tower = watchtower.startStandaloneWatchtowerServer({
    host: '127.0.0.1',
    port: towerPort,
    towerId: 'react-wallet-recovery',
    dbPath: join(towerRoot, 'tower.level'),
    maxStoredBytesPerLookupKey: 4 * 1024 * 1024,
  });
  const towerUrl = `http://127.0.0.1:${tower.server.port}`;
  const response = await fetch(`${towerUrl}/api/tower/appointment`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: serialization.serializeTaggedJson({
      type: 'tower_appointment',
      version: 1,
      towerMode: 'blind_backup',
      lookupKey: encrypted.lookupKey,
      slot: 0,
      bundle: encrypted,
      ownerProof: { runtimeId, signedAt, signature },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    await tower.close();
    throw new Error(`WALLET_RECOVERY_FIXTURE_UPLOAD_FAILED:${response.status}:${detail}`);
  }

  return {
    runtimeId,
    runtimeHeight: bundle.runtimeHeight,
    towerUrl,
    close: async () => {
      await tower.close();
      await runtime.closeRuntimeDb(recoveryEnv);
      await runtime.closeInfraDb(recoveryEnv);
      await rm(towerRoot, { recursive: true, force: true });
    },
  };
};
