import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import {
  buildPaymentPanelView,
  buildPaymentPanelViewFromRuntimeView,
} from '../../../frontend/bridges/wallet/payment-panel-view';
import { hasCertifiedEntityEncryptionKey } from '../../../frontend/bridges/wallet/payment-routing';
import { buildPaymentRuntimeInput } from '../../../frontend/packages/runtime-client/src/payments/payment-command';

const SOURCE = `0x${'11'.repeat(32)}`;
const HUB = `0x${'22'.repeat(32)}`;
const RECIPIENT = `0x${'33'.repeat(32)}`;
const SIGNER = `0x${'44'.repeat(20)}`;

test('payment panel view projects only payment routing state from replicas', () => {
  const delta = { offdelta: 10n };
  const networkGraph = {
    findPaths: async () => [],
  };
  const replicas = new Map([
    [`${SOURCE}:${SIGNER}`, {
      entityId: SOURCE,
      state: {
        entityId: SOURCE,
        entityEncryptionPublicKey: `0x${'55'.repeat(32)}`,
        config: { hiddenFromPaymentView: true },
        reserves: new Map([[1, 100n]]),
        accounts: new Map([
          [HUB, {
            state: {
              leftEntity: SOURCE,
              rightEntity: HUB,
              deltas: new Map([[1, delta]]),
            },
            activeDispute: { reason: 'test' },
          }],
        ]),
      },
    }],
  ]);

  const view = buildPaymentPanelView({
    entityId: SOURCE,
    replicas: replicas as never,
    profiles: [
      { entityId: SOURCE, name: 'Self', accounts: [], publicAccounts: [], metadata: {} },
      { entityId: RECIPIENT, name: 'Recipient', accounts: [], publicAccounts: [], metadata: {} },
    ] as never,
    networkGraph,
  });

  expect(view.knownRecipientEntities).toEqual([RECIPIENT.toLowerCase()]);
  expect(view.blockedCounterpartyIds.has(HUB.toLowerCase())).toBe(true);
  expect(view.networkGraph).toBe(networkGraph);
  expect(view.replicaMap.size).toBe(1);
  const projected = view.replicaMap.get(`${SOURCE}:${SIGNER}`);
  expect((projected?.state as Record<string, unknown>).entityEncryptionPublicKey).toBeUndefined();
  if (!projected) throw new Error('Expected selected payment replica');
  expect(Object.keys(projected.state)).toEqual(['accounts']);
  expect(projected?.state.accounts.get(HUB)?.deltas.get(1)).toBe(delta);
  expect((projected?.state as Record<string, unknown>).config).toBeUndefined();
  expect((projected?.state as Record<string, unknown>).reserves).toBeUndefined();
});

test('payment panel view projects payment routing state from runtime adapter frame', () => {
  const delta = { offdelta: 25n };
  const frame = {
    height: 7,
    head: { latestHeight: 7 },
    entities: [
      { entityId: SOURCE, label: 'Source', height: 7 },
      { entityId: HUB, label: 'Hub', height: 7 },
      { entityId: RECIPIENT, label: 'Recipient', height: 7 },
    ],
    activeEntityId: SOURCE,
    activeEntity: {
      summary: { entityId: SOURCE, label: 'Source', height: 7 },
      core: {
        entityId: SOURCE,
        signerId: SIGNER,
        entityEncryptionPublicKey: `0x${'66'.repeat(32)}`,
      },
      accounts: {
        items: [
          {
            state: {
              leftEntity: SOURCE,
              rightEntity: HUB,
              deltas: new Map([[1, delta]]),
            },
            status: 'disputed',
          },
        ],
        nextCursor: null,
        totalItems: 1,
      },
      books: { items: [], nextCursor: null },
    },
  };

  const view = buildPaymentPanelViewFromRuntimeView({
    entityId: SOURCE,
    frame: frame as never,
  });

  expect(view.knownRecipientEntities).toEqual([HUB.toLowerCase(), RECIPIENT.toLowerCase()]);
  expect(view.blockedCounterpartyIds.has(HUB.toLowerCase())).toBe(true);
  expect(view.networkGraph).toBeNull();
  const projected = view.replicaMap.get(`${SOURCE}:${SIGNER.toLowerCase()}`);
  expect((projected?.state as Record<string, unknown>).entityEncryptionPublicKey).toBeUndefined();
  if (!projected) throw new Error('Expected selected payment replica');
  expect(Object.keys(projected.state)).toEqual(['accounts']);
  expect(projected?.state.accounts.get(HUB.toLowerCase())?.deltas.get(1)).toBe(delta);
});

test('payment key coverage requires one certified Entity encryption key', () => {
  const profile = {
    entityId: HUB,
    entityEncryptionPublicKey: 'invalid',
    runtimeSignature: `0x${'11'.repeat(65)}`,
    metadata: {
      profileHanko: '0x01',
    },
  };
  expect(hasCertifiedEntityEncryptionKey(new Map(), [profile] as never, HUB)).toBe(false);
  profile.entityEncryptionPublicKey = `0x${'21'.repeat(32)}`;
  expect(hasCertifiedEntityEncryptionKey(new Map(), [profile] as never, HUB)).toBe(true);
});

test('the shared payment builder binds the selected Entity and signer to the reviewed route and amounts', () => {
  const path = [SOURCE, HUB, RECIPIENT];
  const command = buildPaymentRuntimeInput({
    entityId: SOURCE,
    signerId: SIGNER,
    targetEntityId: HUB,
    tokenId: 1,
    deliveryMode: 'async',
    description: ' Invoice 7 ',
    route: { path, totalFee: 5n, senderAmount: 105n, recipientAmount: 100n },
  });
  path.pop();
  expect(command).toEqual({
    runtimeTxs: [],
    jInputs: [],
    entityInputs: [
      {
        entityId: SOURCE,
        signerId: SIGNER,
        entityTxs: [
          {
            type: 'htlcPayment',
            data: {
              targetEntityId: RECIPIENT,
              tokenId: 1,
              amount: 100n,
              maxSenderDebit: 105n,
              route: [SOURCE, HUB, RECIPIENT],
              deliveryMode: 'async',
              description: 'Invoice 7',
            },
          },
        ],
      },
    ],
  });
});

test('React payments consume the canonical payment projection instead of owning full env reads', () => {
  const panel = readFileSync('frontend/apps/wallet/src/payments/wallet-payments.tsx', 'utf8');
  const source = readFileSync('frontend/apps/wallet/src/payments/wallet-payment-source.ts', 'utf8');
  const context = readFileSync('frontend/bridges/wallet/canonical/wallet-canonical-account-context.ts', 'utf8');

  expect(source).toContain('projection: WalletPaymentProjection | null');
  expect(source).toContain('decodeWalletPaymentProjection(frame, math)');
  expect(source).toContain('await prepareWalletPaymentCommand(this.requireAdapter(), input)');
  expect(source).toContain('await executeWalletPaymentCommand(this.requireAdapter(), command)');
  expect(source).toContain('signerId: projection.signerId');
  expect(panel).toContain('const projection = snapshot.projection');
  expect(panel).toContain('projection.activeEntityId');
  expect(panel).toContain('snapshot.status === \'loading\'');
  expect(panel).not.toContain("throw new Error('Environment not ready')");
  expect(panel).not.toContain('submitEntityInputs');
  expect(panel).not.toContain('env.state.eReplicas');
  expect(panel).not.toContain('currentEnv?.gossip?.getProfiles');
  expect(panel).not.toContain('getXLN');
  expect(panel).not.toContain('env.gossip');
  expect(panel).not.toContain('infrastructure?.p2p');
  expect(panel).not.toContain('ensureGossipProfiles');
  expect(panel).not.toContain('refreshGossip?.');
  expect(panel).not.toContain('/api/gossip/profile');
  expect(panel).toContain('void source.refresh()');
  expect(panel).toContain('snapshot.command.message');
  expect(source).toContain('Accepted after height ${result.height}. Do not submit a second command while observation is pending.');
  expect(source).toContain('Committed at Runtime height ${result.height}.');
  expect(panel).toContain('<strong>{snapshot.command.status}</strong>');
  expect(panel).not.toContain('Payment confirmed.');
  expect(panel).not.toContain('Payment complete');
  expect(panel).not.toContain('<span>Paid');
  expect(panel).not.toContain('buildNetworkAdjacency(env');
  expect(context).toContain('buildPaymentPanelViewFromRuntimeView({ entityId, frame })');
  expect(context).toContain('networkGraph: env.gossip.getNetworkGraph()');

  const viewSource = readFileSync('frontend/bridges/wallet/payment-panel-view.ts', 'utf8');
  expect(viewSource).not.toContain('RuntimeReplica,');
  expect(viewSource).not.toContain('actionRuntimeEnv');
  expect(viewSource).not.toContain('gossip?.getNetworkGraph');
  expect(viewSource).toContain('networkGraph?: PaymentRuntimeGraph | null');
});

test('React payments invalidate pending reads and release Runtime ownership on destroy', () => {
  const panel = readFileSync('frontend/apps/wallet/src/payments/wallet-payments.tsx', 'utf8');
  const source = readFileSync('frontend/apps/wallet/src/payments/wallet-payment-source.ts', 'utf8');
  expect(panel).toContain('return source.stop;');
  expect(source).toContain('this.generation += 1;');
  expect(source).toContain('this.quoteGeneration += 1;');
  expect(source).toContain('this.releaseRuntime();');
  expect(source).not.toContain('setTimeout(');
});

test('payment gossip refresh is owned by runtime store operation', () => {
  const source = readFileSync('frontend/bridges/runtime/xln-store.ts', 'utf8');

  expect(source).toContain('export async function refreshPaymentRuntimeGossip');
  expect(source).toContain('const xln = env ? await getXLN() : null;');
  expect(source).toContain("if (!env) {");
  expect(source).toContain('PAYMENT_PREFLIGHT_GOSSIP_PROJECTION_ONLY');
  expect(source).toContain('return { profiles: Array.from(mergedProfiles.values()), announced };');
  expect(source).toContain('env.gossip.announce(profile)');
  expect(source).toContain('env.infrastructure?.p2p?.syncProfiles?.()');
  expect(source).toContain('xln?.ensureGossipProfiles');
  expect(source).toContain('xln?.refreshGossip?.(env)');
  expect(source).not.toContain("if (!env) throw new Error('Runtime env is not loaded')");
  expect(source).toContain('export function sendRuntimeDebugEvent');
});
