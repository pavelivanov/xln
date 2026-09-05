import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { formatUnits } from 'ethers';

import { formatTokenAmount, parseTokenAmount } from '../../../core/account/financial-utils';
import { deriveDelta, getTokenInfo, isLeftEntity } from '../../../core/account/utils';
import type { RuntimeAdapter } from '../../../core/api/runtime-adapter/types';
import {
  executeWalletPaymentCommand,
  prepareWalletPaymentCommand,
} from '../../../frontend/apps/wallet/src/wallet-payment-command';
import {
  buildWalletPaymentInput,
  decodeWalletPaymentProjection,
  decodeWalletPaymentRoutes,
  type WalletPaymentMath,
} from '../../../frontend/apps/wallet/src/wallet-payment-model';
import { buildWalletOperationTx } from '../../../frontend/apps/wallet/src/wallet-payment-operations-model';
import {
  initialWalletPaymentInvoice,
  readWalletPaymentInvoice,
  requireWalletPaymentQuoteMatchesDraft,
} from '../../../frontend/apps/wallet/src/wallet-payment-draft';

const alice = `0x${'11'.repeat(32)}`;
const bob = `0x${'22'.repeat(32)}`;
const hub = `0x${'33'.repeat(32)}`;
const signer = `0x${'aa'.repeat(20)}`;

const math: WalletPaymentMath = {
  deriveDelta,
  formatTokenAmount,
  getTokenInfo,
  isLeftEntity,
  parseTokenAmount,
};

const delta = {
  tokenId: 1,
  collateral: 100_000_000n,
  ondelta: 20_000_000n,
  offdelta: 0n,
  leftCreditLimit: 30_000_000n,
  rightCreditLimit: 40_000_000n,
  leftAllowance: 0n,
  rightAllowance: 0n,
  leftHold: 0n,
  rightHold: 0n,
};

const account = (rightEntity: string, status: 'active' | 'disputed') => ({
  status,
  state: {
    leftEntity: alice,
    rightEntity,
    deltas: new Map([[1, delta]]),
  },
});

const frame = () => ({
  height: 22,
  entities: [
    { entityId: alice, label: 'Alice', height: 22 },
    { entityId: bob, label: 'Bob', height: 22 },
    { entityId: hub, label: 'Hub', height: 22, isHub: true },
  ],
  activeEntityId: alice,
  activeEntity: {
    core: {
      entityId: alice,
      signerId: signer,
      reserves: new Map([[1, 500_000_000n]]),
    },
    accounts: {
      items: [account(bob, 'active'), account(hub, 'disputed')],
      pageIndex: 0,
      pageCount: 1,
      totalItems: 2,
    },
  },
});

const directRoute = () => ({
  routes: [{
    path: [alice, bob],
    hops: [{ from: alice, to: bob, fee: '0', feePPM: 0 }],
    totalFee: '0',
    senderAmount: '25000000',
    recipientAmount: '25000000',
    probability: 1,
  }],
});

describe('React wallet payments', () => {
  test('rejects submission when the displayed draft or sending Entity changed after quoting', () => {
    const request = { sourceEntityId: alice, targetEntityId: bob, tokenId: 1, recipientAmount: 25_000_000n, deliveryMode: 'direct' as const };
    const draft = { targetEntityId: bob, tokenId: 1, amount: '25.0', deliveryMode: 'direct' as const };
    expect(() => requireWalletPaymentQuoteMatchesDraft(request, draft, alice, parseTokenAmount)).not.toThrow();
    for (const changed of [
      { ...draft, amount: '26' },
      { ...draft, targetEntityId: hub },
      { ...draft, tokenId: 2 },
      { ...draft, deliveryMode: 'instant' as const },
    ]) expect(() => requireWalletPaymentQuoteMatchesDraft(request, changed, alice, parseTokenAmount)).toThrow('Payment details changed');
    expect(() => requireWalletPaymentQuoteMatchesDraft(request, draft, hub, parseTokenAmount)).toThrow('Payment details changed');
  });

  test('opens canonical invoice fields and keeps recipient-owned references intact', () => {
    const projection = decodeWalletPaymentProjection(frame(), math);
    const uri = `${bob}?token=1&amount=12.5&desc=Lunch&u=table-3`;
    const result = readWalletPaymentInvoice(`https://xln.finance/app#pay/${encodeURIComponent(uri)}`, projection);
    expect(result).toMatchObject({ targetEntityId: bob, tokenId: 1, amount: '12.5', description: 'Lunch | uid:table-3', descriptionLocked: true, noteLocked: true });
    expect(initialWalletPaymentInvoice('', projection)).toEqual({ intent: null, error: '' });
    expect(initialWalletPaymentInvoice('https://xln.finance/app#pay/%E0%A4%A', projection)).toEqual({
      intent: null, error: 'Wallet link contains an invalid payment payload',
    });
    expect(() => readWalletPaymentInvoice(`${bob}?token=9999`, projection)).toThrow('Invoice asset is not present');
    expect(() => readWalletPaymentInvoice(hub, projection)).toThrow('blocked by a dispute');
  });

  test('projects command authority, capacity, recipients, and dispute gates', () => {
    const projection = decodeWalletPaymentProjection(frame(), math);
    expect(projection).toMatchObject({
      height: 22,
      activeEntityId: alice,
      activeEntityLabel: 'Alice',
      signerId: signer,
    });
    expect(projection.tokens[0]).toMatchObject({
      tokenId: 1,
      symbol: 'USDC',
      reserve: 500_000_000n,
      spendable: 600_000_000n,
    });
    expect(projection.recipients).toEqual([
      { entityId: bob, label: 'Bob', blocked: false },
      { entityId: hub, label: 'Hub', blocked: true },
    ]);
  });

  test('validates and orders Runtime-owned route quotes without re-quoting them', () => {
    const request = {
      sourceEntityId: alice,
      targetEntityId: bob,
      tokenId: 1,
      recipientAmount: 25_000_000n,
      deliveryMode: 'direct' as const,
    };
    expect(decodeWalletPaymentRoutes(directRoute(), request)[0]).toMatchObject({
      path: [alice, bob],
      totalFee: 0n,
      senderAmount: 25_000_000n,
      recipientAmount: 25_000_000n,
    });

    const wrongFee = directRoute();
    wrongFee.routes[0]!.totalFee = '1';
    wrongFee.routes[0]!.senderAmount = '25000001';
    expect(() => decodeWalletPaymentRoutes(wrongFee, request))
      .toThrow('WALLET_PAYMENT_ROUTE_FEE_MISMATCH');

    const cycle = directRoute();
    cycle.routes[0]!.path = [alice, bob, alice, bob];
    cycle.routes[0]!.hops = [
      { from: alice, to: bob, fee: '0', feePPM: 0 },
      { from: bob, to: alice, fee: '0', feePPM: 0 },
      { from: alice, to: bob, fee: '0', feePPM: 0 },
    ];
    expect(() => decodeWalletPaymentRoutes(cycle, { ...request, deliveryMode: 'instant' }))
      .toThrow('WALLET_PAYMENT_ROUTE_CYCLE');
  });

  test('builds the canonical direct and conditional payment Runtime inputs', () => {
    const projection = decodeWalletPaymentProjection(frame(), math);
    const route = decodeWalletPaymentRoutes(directRoute(), {
      sourceEntityId: alice,
      targetEntityId: bob,
      tokenId: 1,
      recipientAmount: 25_000_000n,
      deliveryMode: 'direct',
    })[0]!;
    expect(buildWalletPaymentInput({
      projection,
      targetEntityId: bob,
      tokenId: 1,
      deliveryMode: 'direct',
      description: 'Lunch',
      route,
    }).entityInputs[0]?.entityTxs[0]).toEqual({
      type: 'directPayment',
      data: {
        targetEntityId: bob,
        tokenId: 1,
        amount: 25_000_000n,
        route: [alice, bob],
        deliveryMode: 'direct',
        description: 'Lunch',
      },
    });

    expect(buildWalletPaymentInput({
      projection,
      targetEntityId: bob,
      tokenId: 1,
      deliveryMode: 'instant',
      description: '',
      route,
    }).entityInputs[0]?.entityTxs[0]).toMatchObject({
      type: 'htlcPayment',
      data: { maxSenderDebit: 25_000_000n, deliveryMode: 'instant' },
    });
  });

  test('retries the same memory-only Runtime command identity after an unresolved response', async () => {
    const projection = decodeWalletPaymentProjection(frame(), math);
    const route = decodeWalletPaymentRoutes(directRoute(), {
      sourceEntityId: alice,
      targetEntityId: bob,
      tokenId: 1,
      recipientAmount: 25_000_000n,
      deliveryMode: 'direct',
    })[0]!;
    const input = buildWalletPaymentInput({
      projection,
      targetEntityId: bob,
      tokenId: 1,
      deliveryMode: 'direct',
      description: '',
      route,
    });
    const sends: Array<Readonly<{ commandId?: string; commandSequence?: number }>> = [];
    const adapter = {
      mode: 'remote',
      runtimeId: 'runtime-payment-test',
      serverFingerprint: `0x${'ab'.repeat(32)}`,
      nextCommandSequence: 7,
      commandLaneKind: 'capability',
      ensureOwnerCommandLane: async () => undefined,
      send: async (_input: unknown, options: Readonly<{ commandId?: string; commandSequence?: number }>) => {
        sends.push(options);
        return { status: 'pending' as const, height: 22, commandSequence: 7 };
      },
    } as unknown as RuntimeAdapter;
    const command = await prepareWalletPaymentCommand(adapter, input);

    expect(command).toMatchObject({ commandSequence: 7, durable: false });
    await executeWalletPaymentCommand(adapter, command);
    await executeWalletPaymentCommand(adapter, command);
    expect(sends).toEqual([
      { commandId: command.commandId, commandSequence: 7 },
      { commandId: command.commandId, commandSequence: 7 },
    ]);
  });

  test('queues embedded Runtime commands without inventing remote command identity', async () => {
    const input = { runtimeTxs: [], entityInputs: [], jInputs: [] } as const;
    const sends: unknown[] = [];
    const adapter = {
      mode: 'embedded',
      runtimeId: 'embedded-payment-test',
      serverFingerprint: null,
      nextCommandSequence: null,
      send: async (_input: unknown, options?: unknown) => {
        sends.push(options);
        return { height: 4 };
      },
    } as unknown as RuntimeAdapter;

    const command = await prepareWalletPaymentCommand(adapter, input);
    expect(command).toMatchObject({
      mode: 'embedded', commandSequence: null, serverFingerprint: null, durable: false,
    });
    expect(await executeWalletPaymentCommand(adapter, command)).toEqual({ height: 4 });
    expect(sends).toEqual([undefined]);
  });

  test('bounds reserve, collateral, and lending operations before command submission', () => {
    const projection = decodeWalletPaymentProjection(frame(), math);
    const base = {
      targetEntityId: bob,
      tokenId: 1,
      amount: '25',
      termId: '1d' as const,
      interestBps: 125,
      intentId: '',
    };
    expect(buildWalletOperationTx({ ...base, kind: 'r2r' }, projection, math)).toMatchObject({
      type: 'r2r', data: { toEntityId: bob, amount: 25_000_000n },
    });
    expect(buildWalletOperationTx({ ...base, kind: 'r2c' }, projection, math)).toMatchObject({
      type: 'r2c', data: { counterpartyId: bob, amount: 25_000_000n },
    });
    expect(buildWalletOperationTx({ ...base, kind: 'c2r', amount: '20' }, projection, math)).toMatchObject({
      type: 'settle_propose',
      data: { counterpartyEntityId: bob, ops: [{ type: 'c2r', amount: 20_000_000n }] },
    });
    expect(buildWalletOperationTx({
      ...base, kind: 'lend', intentId: 'lend-12345678',
    }, projection, math)).toMatchObject({
      type: 'lendingOffer', data: { hubEntityId: bob, termId: '1d', interestBps: 125 },
    });
    expect(() => buildWalletOperationTx({
      ...base, kind: 'r2r', amount: '501',
    }, projection, math)).toThrow('WALLET_OPERATION_RESERVE_EXCEEDED');
    expect(() => buildWalletOperationTx({
      ...base, kind: 'c2r', amount: '101',
    }, projection, math)).toThrow('WALLET_OPERATION_COLLATERAL_EXCEEDED');
  });

  test('withdraws only the caller collateral remaining after canonical holds, on either Account side', () => {
    for (const [owner, peer, leftHold, rightHold, limit] of [
      [alice, bob, 5_000_000n, 0n, 15_000_000n],
      [bob, alice, 5_000_000n, 3_000_000n, 77_000_000n],
      [alice, bob, 21_000_000n, 0n, 0n],
    ] as const) {
      const payload = frame();
      payload.activeEntityId = owner;
      payload.activeEntity.core.entityId = owner;
      payload.activeEntity.accounts.items = [account(bob, 'active')];
      payload.activeEntity.accounts.items[0]!.state.deltas.set(1, { ...delta, leftHold, rightHold });
      const projection = decodeWalletPaymentProjection(payload, math);
      const draft = {
        kind: 'c2r' as const, targetEntityId: peer, tokenId: 1,
        amount: formatUnits(limit + 1n, 6), termId: '1d' as const, interestBps: 0, intentId: '',
      };
      expect(() => buildWalletOperationTx(draft, projection, math)).toThrow('WALLET_OPERATION_COLLATERAL_EXCEEDED');
      if (limit > 0n) expect(buildWalletOperationTx({ ...draft, amount: formatUnits(limit, 6) }, projection, math))
        .toMatchObject({ type: 'settle_propose', data: { executorIsLeft: owner === alice, ops: [{ amount: limit }] } });
    }
  });

  test('keeps write identity, reconnect retry, and cleanup at the explicit adapter boundary', () => {
    const source = readFileSync('frontend/apps/wallet/src/wallet-payment-source.ts', 'utf8');
    const command = readFileSync('frontend/apps/wallet/src/wallet-payment-command.ts', 'utf8');
    const boundary = readFileSync('frontend/apps/wallet/src/wallet-runtime-read-boundary.ts', 'utf8');
    const view = readFileSync('frontend/apps/wallet/src/wallet-payments.tsx', 'utf8');
    expect(source).toContain("adapter.read('payment-routes'");
    expect(source).toContain('prepareWalletPaymentCommand');
    expect(source).toContain('executeWalletPaymentCommand');
    expect(source).toContain('Do not submit a second command');
    expect(source).toContain('this.releaseAdapter?.()');
    expect(command).toContain('resolveRemoteRuntimeCommandIntent');
    expect(command).toContain('commandId: command.commandId');
    expect(command).toContain('commandSequence: command.commandSequence');
    expect(boundary).toContain('signRuntimeAdapterOwnerBinding');
    expect(view).toContain('useSyncExternalStore');
    expect(source).not.toContain('setInterval');
    expect(source).not.toContain('Math.random');
  });
});
